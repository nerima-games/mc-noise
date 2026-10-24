import { Brand, Result } from 'effect'
import { DefinedValueName, requireDefined } from './defined.js'

export type SplineInput = number & Brand.Brand<'SplineInput'>
export const SplineInput: Brand.Constructor<SplineInput> = Brand.make<SplineInput>(
  (value) => Number.isFinite(value) || 'spline input must be finite',
)

const readSplineInput = (value: number): Result.Result<SplineInput, RangeError> =>
  Result.mapError(SplineInput.result(value), (error) => new RangeError(error.message))

export type SplineValue = number & Brand.Brand<'SplineValue'>
export const SplineValue: Brand.Constructor<SplineValue> = Brand.make<SplineValue>(
  (value) => Number.isFinite(value) || 'spline value must be finite',
)

const readSplineValue = (value: number): Result.Result<SplineValue, RangeError> =>
  Result.mapError(SplineValue.result(value), (error) => new RangeError(error.message))

export type ControlPoint = readonly [input: SplineInput, value: SplineValue]


export type Spline = ReadonlyArray<ControlPoint>

const EMPTY_SPLINE_VALUE = 0
const SEGMENT_START_INDEX = 1
const INDEX_OFFSET = 1
const CONTROL_POINT_TUPLE_LENGTH = 2

const validateControlPoint = (
  input: unknown,
  value: unknown,
  index: number,
): Result.Result<ControlPoint, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    if (typeof input !== 'number') {
      return yield* Result.fail(new TypeError(`spline[${index}][0] must be a number`))
    }
    if (typeof value !== 'number') {
      return yield* Result.fail(new TypeError(`spline[${index}][1] must be a number`))
    }
    const brandedInput = yield* readSplineInput(input)
    const brandedValue = yield* readSplineValue(value)
    return Object.freeze([brandedInput, brandedValue])
  })

const validateControlPointEntry = (
  candidate: unknown,
  index: number,
): Result.Result<ControlPoint, TypeError | RangeError> =>
  Result.gen(function* validateControlPointEntryResult() {
    if (!Array.isArray(candidate) || candidate.length !== CONTROL_POINT_TUPLE_LENGTH) {
      return yield* Result.fail(new TypeError(`spline[${index}] must contain two values`))
    }
    const [inputValue, controlValue] = candidate
    const input = yield* requireDefined(
      inputValue,
      DefinedValueName('spline control point input'),
    )
    const value = yield* requireDefined(
      controlValue,
      DefinedValueName('spline control point value'),
    )
    return yield* validateControlPoint(input, value, index)
  })

const appendControlPoint = (
  validated: ControlPoint[],
  previousInput: SplineInput | null,
  candidate: unknown,
  index: number,
): Result.Result<SplineInput, TypeError | RangeError> =>
  Result.gen(function* appendControlPointResult() {
    const point = yield* validateControlPointEntry(candidate, index)
    const [pointInput] = point
    if (previousInput !== null && pointInput <= previousInput) {
      return yield* Result.fail(
        new RangeError('spline input coordinates must be strictly increasing'),
      )
    }
    validated.push(point)
    return pointInput
  })

const validateControlPoints = (
  controlPoints: Spline,
): Result.Result<readonly ControlPoint[], TypeError | RangeError> =>
  Result.gen(function* validateControlPointsResult() {
    if (!Array.isArray(controlPoints)) {
      return yield* Result.fail(new TypeError('spline control points must be an array'))
    }
    const validated: ControlPoint[] = []
    let previousInput: SplineInput | null = null
    for (let index = 0; index < controlPoints.length; index += INDEX_OFFSET) {
      const candidate = yield* requireDefined(
        controlPoints[index],
        DefinedValueName('spline control point'),
      )
      previousInput = yield* appendControlPoint(
        validated,
        previousInput,
        candidate,
        index,
      )
    }
    return Object.freeze(validated)
  })

const freezeControlPoint = ([input, value]: ControlPoint): ControlPoint =>
  Object.freeze([input, value])

export const createSpline = (
  controlPoints: Spline,
): Result.Result<Spline, TypeError | RangeError> =>
  Result.map(validateControlPoints(controlPoints), (points) =>
    Object.freeze(points.map(freezeControlPoint)),
  )

const controlPointInput = (
  spline: Spline,
  index: number,
): Result.Result<SplineInput, RangeError> =>
  Result.gen(function* resultGenerator() {
    const [input] = yield* requireDefined(
      spline[index],
      DefinedValueName('spline control point'),
    )
    return input
  })

const findUpperIndex = (
  spline: Spline,
  input: SplineInput,
): Result.Result<number, RangeError> =>
  Result.gen(function* resultGenerator() {
    let upperIndex = SEGMENT_START_INDEX
    while (upperIndex < spline.length - INDEX_OFFSET) {
      const currentInput = yield* controlPointInput(spline, upperIndex)
      if (input <= currentInput) {
        break
      }
      upperIndex += INDEX_OFFSET
    }
    return upperIndex
  })

const interpolate = (
  spline: Spline,
  input: SplineInput,
  upperIndex: number,
): Result.Result<SplineValue, RangeError> =>
  Result.gen(function* resultGenerator() {
    const [lowerInput, lowerValue] = yield* requireDefined(
      spline[upperIndex - INDEX_OFFSET],
      DefinedValueName('spline control point'),
    )
    const [upperInput, upperValue] = yield* requireDefined(
      spline[upperIndex],
      DefinedValueName('spline control point'),
    )
    const ratio = (input - lowerInput) / (upperInput - lowerInput)
    return yield* readSplineValue(
      lowerValue + (upperValue - lowerValue) * ratio,
    )
  })

const evaluateBoundary = (
  spline: Spline,
  input: SplineInput,
): Result.Result<SplineValue | null, RangeError> =>
  Result.gen(function* resultGenerator() {
    const first = yield* requireDefined(
      spline[EMPTY_SPLINE_VALUE],
      DefinedValueName('spline control point'),
    )
    const last = yield* requireDefined(
      spline[spline.length - INDEX_OFFSET],
      DefinedValueName('spline control point'),
    )
    const [firstInput, firstValue] = first
    const [lastInput, lastValue] = last
    if (input <= firstInput) {
      return firstValue
    }
    if (input >= lastInput) {
      return lastValue
    }
    return null
  })

export const evaluateSpline = (
  spline: Spline,
  input: SplineInput,
): Result.Result<SplineValue, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const validatedInput = yield* readSplineInput(input)
    const validatedSpline = yield* validateControlPoints(spline)
    if (validatedSpline.length === EMPTY_SPLINE_VALUE) {
      return SplineValue(EMPTY_SPLINE_VALUE)
    }
    const boundaryValue = yield* evaluateBoundary(validatedSpline, validatedInput)
    if (boundaryValue !== null) {
      return boundaryValue
    }
    const upperIndex = yield* findUpperIndex(validatedSpline, validatedInput)
    return yield* interpolate(validatedSpline, validatedInput, upperIndex)
  })
