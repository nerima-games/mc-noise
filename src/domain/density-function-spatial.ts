import type {
  DensityFunction,
  DensityRangeChoiceOptions,
} from './density-function-types.js'
import { type Spline, createSpline } from './spline.js'
import {
  boundsForClamp,
  boundsForRangeChoice,
  boundsForSpline,
  boundsForYClampedGradient,
} from './density-function-bounds.js'
import { requireFiniteNumber } from './number-validation.js'

const freezeDensity = <DensityNode extends DensityFunction>(density: DensityNode): DensityNode =>
  Object.freeze(density)

export const densityClamp = (
  input: DensityFunction,
  min: number,
  max: number,
): DensityFunction => {
  const minimum = requireFiniteNumber('min', min)
  const maximum = requireFiniteNumber('max', max)
  if (minimum > maximum) {
    throw new RangeError(`min must not exceed max, received ${minimum} and ${maximum}`)
  }
  const bounds = boundsForClamp(input, minimum, maximum)
  return freezeDensity({
    input,
    kind: 'clamp',
    max: maximum,
    maxValue: bounds.maxValue,
    min: minimum,
    minValue: bounds.minValue,
  })
}

export const densityRangeChoice = (
  input: DensityFunction,
  options: DensityRangeChoiceOptions,
  inRange: DensityFunction,
  outOfRange: DensityFunction,
): DensityFunction => {
  const minInclusive = requireFiniteNumber('minInclusive', options.minInclusive)
  const maxExclusive = requireFiniteNumber('maxExclusive', options.maxExclusive)
  if (minInclusive > maxExclusive) {
    throw new RangeError(
      `minInclusive must not exceed maxExclusive, received ${minInclusive} and ${maxExclusive}`,
    )
  }
  const bounds = boundsForRangeChoice(inRange, outOfRange)
  return freezeDensity({
    inRange,
    input,
    kind: 'range-choice',
    maxExclusive,
    maxValue: bounds.maxValue,
    minInclusive,
    minValue: bounds.minValue,
    outOfRange,
  })
}

export const densityYClampedGradient = (
  fromY: number,
  toY: number,
  fromValue: number,
  toValue: number,
): DensityFunction => {
  const firstY = requireFiniteNumber('fromY', fromY)
  const lastY = requireFiniteNumber('toY', toY)
  const firstValue = requireFiniteNumber('fromValue', fromValue)
  const lastValue = requireFiniteNumber('toValue', toValue)
  if (firstY === lastY) {
    throw new RangeError('fromY and toY must differ')
  }
  const bounds = boundsForYClampedGradient(firstValue, lastValue)
  return freezeDensity({
    fromValue: firstValue,
    fromY: firstY,
    kind: 'y-clamped-gradient',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    toValue: lastValue,
    toY: lastY,
  })
}

export const densitySpline = (input: DensityFunction, spline: Spline): DensityFunction => {
  const normalizedSpline = createSpline(spline)
  const bounds = boundsForSpline(normalizedSpline)
  return freezeDensity({
    input,
    kind: 'spline',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    spline: normalizedSpline,
  })
}
