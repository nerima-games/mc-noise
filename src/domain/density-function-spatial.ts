import {
  type DensityFunction,
  type DensityFunctionResult,
  type DensityRangeChoiceOptions,
  type DensityValue,
} from './density-function-types.js'
import { type Spline, createSpline } from './spline.js'
import {
  boundsForClamp,
  boundsForRangeChoice,
  boundsForSpline,
  boundsForYClampedGradient,
} from './density-function-bounds.js'
import type { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { Result } from 'effect'

const freezeDensity = <DensityNode extends DensityFunction>(density: DensityNode): DensityNode =>
  Object.freeze(density)

export const densityClamp = (
  input: DensityFunction,
  min: DensityValue,
  max: DensityValue,
): DensityFunctionResult<DensityFunction> => {
  if (min > max) {
    return Result.fail(new RangeError(`min must not exceed max, received ${min} and ${max}`))
  }
  const bounds = boundsForClamp(input, min, max)
  return Result.succeed(
    freezeDensity({
      input,
      kind: 'clamp',
      max,
      maxValue: bounds.maxValue,
      min,
      minValue: bounds.minValue,
    }),
  )
}

export const densityRangeChoice = (
  input: DensityFunction,
  options: DensityRangeChoiceOptions,
  inRange: DensityFunction,
  outOfRange: DensityFunction,
): DensityFunctionResult<DensityFunction> => {
  const { minInclusive, maxExclusive } = options
  if (minInclusive > maxExclusive) {
    return Result.fail(
      new RangeError(
        `minInclusive must not exceed maxExclusive, received ${minInclusive} and ${maxExclusive}`,
      ),
    )
  }
  const bounds = boundsForRangeChoice(inRange, outOfRange)
  return Result.succeed(
    freezeDensity({
      inRange,
      input,
      kind: 'range-choice',
      maxExclusive,
      maxValue: bounds.maxValue,
      minInclusive,
      minValue: bounds.minValue,
      outOfRange,
    }),
  )
}

export const densityYClampedGradient = (
  fromY: BlockAxis,
  toY: BlockAxis,
  fromValue: DensityValue,
  toValue: DensityValue,
): DensityFunctionResult<DensityFunction> => {
  if (fromY === toY) {
    return Result.fail(new RangeError('fromY and toY must differ'))
  }
  const bounds = boundsForYClampedGradient(fromValue, toValue)
  return Result.succeed(
    freezeDensity({
      fromValue,
      fromY,
      kind: 'y-clamped-gradient',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      toValue,
      toY,
    }),
  )
}

export const densitySpline = (
  input: DensityFunction,
  spline: Spline,
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* densitySplineResult() {
    const normalizedSpline = yield* createSpline(spline)
    const bounds = boundsForSpline(normalizedSpline)
    return freezeDensity({
      input,
      kind: 'spline',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      spline: normalizedSpline,
    })
  })
