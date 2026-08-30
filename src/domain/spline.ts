import { requireFiniteNumber } from './number-validation.js'

export type ControlPoint = readonly [input: number, value: number]

export type Spline = ReadonlyArray<ControlPoint>

const EMPTY_SPLINE_VALUE = 0
const SEGMENT_START_INDEX = 1
const INDEX_OFFSET = 1

const validateControlPoint = (input: number, value: number, index: number): number => {
  const finiteInput = requireFiniteNumber(`spline[${index}][0]`, input)
  requireFiniteNumber(`spline[${index}][1]`, value)
  return finiteInput
}

const validateControlPoints = (controlPoints: Spline): void => {
  let previousInput: number | null = null

  controlPoints.forEach(([input, value], index) => {
    const finiteInput = validateControlPoint(input, value, index)
    if (previousInput !== null && finiteInput <= previousInput) {
      throw new RangeError('spline input coordinates must be strictly increasing')
    }
    previousInput = finiteInput
  })
}

const freezeControlPoint = ([input, value]: ControlPoint): ControlPoint =>
  Object.freeze([input, value] as const)

export const createSpline = (controlPoints: Spline): Spline => {
  validateControlPoints(controlPoints)
  const frozenPoints = controlPoints.map(freezeControlPoint)
  return Object.freeze(frozenPoints)
}

const controlPointInput = (spline: Spline, index: number): number => {
  const [input] = spline[index]!
  return input
}

const findUpperIndex = (spline: Spline, input: number): number => {
  let upperIndex = SEGMENT_START_INDEX
  while (
    upperIndex < spline.length - INDEX_OFFSET &&
    input > controlPointInput(spline, upperIndex)
  ) {
    upperIndex += INDEX_OFFSET
  }
  return upperIndex
}

const interpolate = (spline: Spline, input: number, upperIndex: number): number => {
  const [lowerInput, lowerValue] = spline[upperIndex - INDEX_OFFSET]!
  const [upperInput, upperValue] = spline[upperIndex]!
  const ratio = (input - lowerInput) / (upperInput - lowerInput)
  return lowerValue + (upperValue - lowerValue) * ratio
}

const evaluateBoundary = (spline: Spline, input: number): number | null => {
  const [first] = spline
  const last = spline[spline.length - INDEX_OFFSET]!
  const [firstInput, firstValue] = first!
  const [lastInput, lastValue] = last
  if (input <= firstInput) {
    return firstValue
  }
  if (input >= lastInput) {
    return lastValue
  }
  return null
}

export const evaluateSpline = (spline: Spline, input: number): number => {
  requireFiniteNumber('input', input)
  if (spline.length === EMPTY_SPLINE_VALUE) {
    return EMPTY_SPLINE_VALUE
  }

  const boundaryValue = evaluateBoundary(spline, input)
  if (boundaryValue !== null) {
    return boundaryValue
  }

  return interpolate(spline, input, findUpperIndex(spline, input))
}
