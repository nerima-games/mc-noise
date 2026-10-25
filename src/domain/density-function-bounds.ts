import type { BlockAxis, PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import {
  DENSITY_FOUR,
  DENSITY_INFINITY,
  DENSITY_NEGATIVE_INFINITY,
  DENSITY_NEGATIVE_ONE,
  DENSITY_ONE,
  DENSITY_TWENTY_FOUR,
  DENSITY_TWO,
  DENSITY_ZERO,
} from './density-function-constants.js'
import {
  type DensityBinaryOperation,
  DensityBound,
  type DensityBound as DensityBoundValue,
  type DensityBounds,
  type DensityFunction,
  type DensityLinearOperationType,
  type DensityNoiseSource,
  type DensityScale,
  type DensityUnaryOperation,
  type DensityValue,
} from './density-function-types.js'
import { Result } from 'effect'
import type { Spline } from './spline.js'

const UNBOUNDED: DensityBounds = Object.freeze({
  maxValue: DensityBound(DENSITY_INFINITY),
  minValue: DensityBound(DENSITY_NEGATIVE_INFINITY),
})

const makeDensityBounds = (minValue: number, maxValue: number): DensityBounds =>
  Object.freeze({
    maxValue: DensityBound(maxValue),
    minValue: DensityBound(minValue),
  })

export const createDensityBounds = (
  minValue: DensityBoundValue,
  maxValue: DensityBoundValue,
): Result.Result<DensityBounds, RangeError> => {
  if (Number.isNaN(minValue)) {
    return Result.fail(new RangeError('minValue must not be NaN'))
  }
  if (Number.isNaN(maxValue)) {
    return Result.fail(new RangeError('maxValue must not be NaN'))
  }
  if (minValue > maxValue) {
    return Result.fail(
      new RangeError(`minValue must not exceed maxValue, received ${minValue} and ${maxValue}`),
    )
  }
  return Result.succeed(makeDensityBounds(minValue, maxValue))
}

export const densityBounds = (density: DensityFunction): DensityBounds =>
  makeDensityBounds(density.minValue, density.maxValue)

export const boundsForCoordinate = (scale: DensityScale, offset: PositionAxis): DensityBounds => {
  if (scale === DENSITY_ZERO) {
    return makeDensityBounds(offset, offset)
  }
  return UNBOUNDED
}

const createBoundsOrUnbounded = (lower: number, upper: number): DensityBounds => {
  if (Number.isNaN(lower) || Number.isNaN(upper)) {
    return UNBOUNDED
  }
  return makeDensityBounds(Math.min(lower, upper), Math.max(lower, upper))
}

const scaleBounds = (bounds: DensityBounds, scale: number): DensityBounds => {
  if (scale === DENSITY_ZERO) {
    return makeDensityBounds(DENSITY_ZERO, DENSITY_ZERO)
  }
  const lower = bounds.minValue * scale
  const upper = bounds.maxValue * scale
  return createBoundsOrUnbounded(lower, upper)
}

export const boundsForNoise = (source: DensityNoiseSource): DensityBounds => source

export const boundsForScaledNoise = (
  source: DensityNoiseSource,
  scale: DensityScale,
): DensityBounds => scaleBounds(source, scale)

const boundsForAddition = (left: DensityBounds, right: DensityBounds): DensityBounds => {
  const lower = left.minValue + right.minValue
  const upper = left.maxValue + right.maxValue
  return createBoundsOrUnbounded(lower, upper)
}

export const boundsForLinearOperation = (
  operation: DensityLinearOperationType,
  input: DensityBounds,
  argument: DensityValue,
): DensityBounds => {
  if (operation === 'add') {
    return boundsForAddition(input, makeDensityBounds(argument, argument))
  }
  return scaleBounds(input, argument)
}

export const boundsForWeirdScaledSampler = (
  source: DensityNoiseSource,
  maxMultiplier: DensityScale,
): DensityBounds => {
  const maxAbs = Math.max(Math.abs(source.minValue), Math.abs(source.maxValue))
  return createBoundsOrUnbounded(DENSITY_ZERO, maxAbs * maxMultiplier)
}

const boundsForMultiplication = (left: DensityBounds, right: DensityBounds): DensityBounds => {
  const products = [
    left.minValue * right.minValue,
    left.minValue * right.maxValue,
    left.maxValue * right.minValue,
    left.maxValue * right.maxValue,
  ]
  if (products.some(Number.isNaN)) {
    return UNBOUNDED
  }
  return makeDensityBounds(Math.min(...products), Math.max(...products))
}

const boundsForMinimum = (left: DensityBounds, right: DensityBounds): DensityBounds =>
  makeDensityBounds(
    Math.min(left.minValue, right.minValue),
    Math.min(left.maxValue, right.maxValue),
  )

const boundsForMaximum = (left: DensityBounds, right: DensityBounds): DensityBounds =>
  makeDensityBounds(
    Math.max(left.minValue, right.minValue),
    Math.max(left.maxValue, right.maxValue),
  )

export const boundsForBinary = (
  operation: DensityBinaryOperation,
  left: DensityBounds,
  right: DensityBounds,
): DensityBounds => {
  if (operation === 'add') {
    return boundsForAddition(left, right)
  }
  if (operation === 'mul') {
    return boundsForMultiplication(left, right)
  }
  if (operation === 'min') {
    return boundsForMinimum(left, right)
  }
  return boundsForMaximum(left, right)
}

const squeeze = (value: number): number => {
  const clamped = Math.max(DENSITY_NEGATIVE_ONE, Math.min(DENSITY_ONE, value))
  return clamped / DENSITY_TWO - clamped * clamped * clamped / DENSITY_TWENTY_FOUR
}

const halfNegative = (value: number): number => {
  if (value < DENSITY_ZERO) {
    return value / DENSITY_TWO
  }
  return value
}

const quarterNegative = (value: number): number => {
  if (value < DENSITY_ZERO) {
    return value / DENSITY_FOUR
  }
  return value
}

const cube = (value: number): number => value * value * value

const invert = (value: number): number => DENSITY_ONE / value

const unaryValues: Readonly<Record<DensityUnaryOperation, (value: number) => number>> = {
  abs: Math.abs,
  cube,
  'half-negative': halfNegative,
  invert,
  'quarter-negative': quarterNegative,
  square: (value) => value * value,
  squeeze,
}

const unaryValue = (operation: DensityUnaryOperation, value: number): number =>
  unaryValues[operation](value)

const containsZero = (input: DensityBounds): boolean =>
  input.minValue <= DENSITY_ZERO && input.maxValue >= DENSITY_ZERO

const boundsForAbsolute = (input: DensityBounds): DensityBounds => {
  const lower = Math.min(Math.abs(input.minValue), Math.abs(input.maxValue))
  const upper = Math.max(Math.abs(input.minValue), Math.abs(input.maxValue))
  if (containsZero(input)) {
    return makeDensityBounds(DENSITY_ZERO, upper)
  }
  return makeDensityBounds(lower, upper)
}

const boundsForSquare = (input: DensityBounds): DensityBounds => {
  const lower = unaryValue('square', input.minValue)
  const upper = unaryValue('square', input.maxValue)
  if (containsZero(input)) {
    return makeDensityBounds(DENSITY_ZERO, Math.max(lower, upper))
  }
  return createBoundsOrUnbounded(lower, upper)
}

export const boundsForUnary = (
  operation: DensityUnaryOperation,
  input: DensityBounds,
): DensityBounds => {
  if (operation === 'abs') {
    return boundsForAbsolute(input)
  }
  if (operation === 'square') {
    return boundsForSquare(input)
  }
  if (operation === 'invert' && containsZero(input)) {
    return UNBOUNDED
  }
  const lower = unaryValue(operation, input.minValue)
  const upper = unaryValue(operation, input.maxValue)
  return createBoundsOrUnbounded(lower, upper)
}

export const boundsForClamp = (
  input: DensityBounds,
  min: DensityValue,
  max: DensityValue,
): DensityBounds => {
  const lower = Math.max(min, Math.min(max, input.minValue))
  const upper = Math.max(min, Math.min(max, input.maxValue))
  return makeDensityBounds(Math.min(lower, upper), Math.max(lower, upper))
}

export const boundsForRangeChoice = (
  inRange: DensityBounds,
  outOfRange: DensityBounds,
): DensityBounds => makeDensityBounds(
  Math.min(inRange.minValue, outOfRange.minValue),
  Math.max(inRange.maxValue, outOfRange.maxValue),
)

export const boundsForFindTopSurface = (
  upperBound: DensityBounds,
  lowerBound: BlockAxis,
): DensityBounds => makeDensityBounds(
  lowerBound,
  Math.max(lowerBound, upperBound.maxValue),
)

export const boundsForYClampedGradient = (
  fromValue: DensityValue,
  toValue: DensityValue,
): DensityBounds => makeDensityBounds(
  Math.min(fromValue, toValue),
  Math.max(fromValue, toValue),
)

export const boundsForSpline = (spline: Spline): DensityBounds => {
  if (spline.length === DENSITY_ZERO) {
    return makeDensityBounds(DENSITY_ZERO, DENSITY_ZERO)
  }
  let minValue = DENSITY_INFINITY
  let maxValue = DENSITY_NEGATIVE_INFINITY
  for (const [, value] of spline) {
    minValue = Math.min(minValue, value)
    maxValue = Math.max(maxValue, value)
  }
  return makeDensityBounds(minValue, maxValue)
}
