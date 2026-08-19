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
import type {
  DensityBinaryOperation,
  DensityBounds,
  DensityFunction,
  DensityLinearOperationType,
  DensityNoiseSource,
  DensityUnaryOperation,
} from './density-function-types.js'
import type { Spline } from './spline.js'
import { requireFiniteNumber } from './number-validation.js'

const UNBOUNDED: DensityBounds = Object.freeze({
  maxValue: DENSITY_INFINITY,
  minValue: DENSITY_NEGATIVE_INFINITY,
})

const requireDensityBound = (name: string, value: number): number => {
  if (Number.isNaN(value)) {
    throw new RangeError(`${name} must not be NaN`)
  }
  return value
}

export const createDensityBounds = (minValue: number, maxValue: number): DensityBounds => {
  const lower = requireDensityBound('minValue', minValue)
  const upper = requireDensityBound('maxValue', maxValue)
  if (lower > upper) {
    throw new RangeError(`minValue must not exceed maxValue, received ${lower} and ${upper}`)
  }
  return Object.freeze({ maxValue: upper, minValue: lower })
}

export const densityBounds = (density: DensityFunction): DensityBounds =>
  createDensityBounds(density.minValue, density.maxValue)

export const boundsForCoordinate = (scale: number, offset: number): DensityBounds => {
  if (scale === DENSITY_ZERO) {
    return createDensityBounds(offset, offset)
  }
  return UNBOUNDED
}

const createBoundsOrUnbounded = (lower: number, upper: number): DensityBounds => {
  if (Number.isNaN(lower) || Number.isNaN(upper)) {
    return UNBOUNDED
  }
  return createDensityBounds(Math.min(lower, upper), Math.max(lower, upper))
}

const scaleBounds = (bounds: DensityBounds, scale: number): DensityBounds => {
  if (scale === DENSITY_ZERO) {
    return createDensityBounds(DENSITY_ZERO, DENSITY_ZERO)
  }
  const lower = bounds.minValue * scale
  const upper = bounds.maxValue * scale
  return createBoundsOrUnbounded(lower, upper)
}

export const boundsForNoise = (source: DensityNoiseSource): DensityBounds => source

export const boundsForScaledNoise = (
  source: DensityNoiseSource,
  scale: number,
): DensityBounds => scaleBounds(source, scale)

const boundsForAddition = (left: DensityBounds, right: DensityBounds): DensityBounds => {
  const lower = left.minValue + right.minValue
  const upper = left.maxValue + right.maxValue
  return createBoundsOrUnbounded(lower, upper)
}

export const boundsForLinearOperation = (
  operation: DensityLinearOperationType,
  input: DensityBounds,
  argument: number,
): DensityBounds => {
  if (operation === 'add') {
    return boundsForAddition(input, createDensityBounds(argument, argument))
  }
  return scaleBounds(input, argument)
}

export const boundsForWeirdScaledSampler = (
  source: DensityNoiseSource,
  maxMultiplier: number,
): DensityBounds => {
  const maxAbs = Math.max(Math.abs(source.minValue), Math.abs(source.maxValue))
  return createDensityBounds(DENSITY_ZERO, maxAbs * maxMultiplier)
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
  return createDensityBounds(Math.min(...products), Math.max(...products))
}

const boundsForMinimum = (left: DensityBounds, right: DensityBounds): DensityBounds =>
  createDensityBounds(
    Math.min(left.minValue, right.minValue),
    Math.min(left.maxValue, right.maxValue),
  )

const boundsForMaximum = (left: DensityBounds, right: DensityBounds): DensityBounds =>
  createDensityBounds(
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
    return createDensityBounds(DENSITY_ZERO, upper)
  }
  return createDensityBounds(lower, upper)
}

const boundsForSquare = (input: DensityBounds): DensityBounds => {
  const lower = unaryValue('square', input.minValue)
  const upper = unaryValue('square', input.maxValue)
  if (containsZero(input)) {
    return createDensityBounds(DENSITY_ZERO, Math.max(lower, upper))
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
  min: number,
  max: number,
): DensityBounds => {
  const lower = Math.max(min, Math.min(max, input.minValue))
  const upper = Math.max(min, Math.min(max, input.maxValue))
  return createDensityBounds(Math.min(lower, upper), Math.max(lower, upper))
}

export const boundsForRangeChoice = (
  inRange: DensityBounds,
  outOfRange: DensityBounds,
): DensityBounds => createDensityBounds(
  Math.min(inRange.minValue, outOfRange.minValue),
  Math.max(inRange.maxValue, outOfRange.maxValue),
)

export const boundsForYClampedGradient = (
  fromValue: number,
  toValue: number,
): DensityBounds => createDensityBounds(
  Math.min(fromValue, toValue),
  Math.max(fromValue, toValue),
)

export const boundsForSpline = (spline: Spline): DensityBounds => {
  if (spline.length === DENSITY_ZERO) {
    return createDensityBounds(DENSITY_ZERO, DENSITY_ZERO)
  }
  let minValue = DENSITY_INFINITY
  let maxValue = DENSITY_NEGATIVE_INFINITY
  for (const [, value] of spline) {
    const finiteValue = requireFiniteNumber('spline value', value)
    minValue = Math.min(minValue, finiteValue)
    maxValue = Math.max(maxValue, finiteValue)
  }
  return createDensityBounds(minValue, maxValue)
}
