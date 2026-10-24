import {
  type DensityFunctionResult,
  DensityOctaveIndex,
  type DensityOldBlendedNoise,
  type DensityOldBlendedNoiseOctaveSource,
  type DensityPosition,
  DensityScale,
  DensityValue,
  type DensityValue as DensityValueType,
} from './density-function-types.js'
import { PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { Result } from 'effect'
import { requireFiniteNumber } from './number-validation.js'

const BASE_SCALE = 684.412
const BLEND_LOWER_BOUND = 0
const BLEND_UPPER_BOUND = 1
const FACTOR_DIVISOR = 2
const FACTOR_START = 1
const HALF = 0.5
const OCTAVE_STEP = 1
const MAIN_OCTAVE_COUNT = 8
const LIMIT_OCTAVE_COUNT = 16
const MAIN_VALUE_NORMALIZER = 10
const LIMIT_VALUE_NORMALIZER = 512
const OUTPUT_SCALE = 128
const WRAP_PERIOD = 33_554_432

type ScaledCoordinates = Readonly<{
  readonly factoredSmear: DensityScale
  readonly factoredX: PositionAxis
  readonly factoredY: PositionAxis
  readonly factoredZ: PositionAxis
  readonly scaledX: PositionAxis
  readonly scaledY: PositionAxis
  readonly scaledZ: PositionAxis
  readonly smear: DensityScale
}>

type LimitSampleCoordinates = Readonly<{
  readonly smear: DensityScale
  readonly x: PositionAxis
  readonly y: PositionAxis
  readonly yMax: PositionAxis
  readonly z: PositionAxis
}>

type LimitValues = Readonly<{
  readonly maxValue: number
  readonly minValue: number
}>

type LimitNoiseOctaveInput = Readonly<{
  readonly blend: number
  readonly coordinates: ScaledCoordinates
  readonly density: DensityOldBlendedNoise
  readonly factor: number
  readonly octaveIndex: number
}>

const wrap = (value: number): number =>
  value - Math.floor(value / WRAP_PERIOD + HALF) * WRAP_PERIOD

const clampedLerp = (start: number, end: number, delta: number): number => {
  const clampedDelta = Math.max(
    BLEND_LOWER_BOUND,
    Math.min(BLEND_UPPER_BOUND, delta),
  )
  return start + (end - start) * clampedDelta
}

const requirePositionAxis = (name: string, value: number): Result.Result<PositionAxis, RangeError> =>
  Result.map(requireFiniteNumber(value, () => `${name} must be finite`), PositionAxis)

const requireDensityScale = (name: string, value: number): Result.Result<DensityScale, RangeError> =>
  Result.map(requireFiniteNumber(value, () => `${name} must be finite`), DensityScale)

const requireNoiseSample = (
  name: string,
  value: unknown,
): DensityFunctionResult<number> => {
  if (typeof value !== 'number') {
    return Result.fail(new TypeError(`${name} must be a number`))
  }
  return requireFiniteNumber(value, () => `${name} must be finite`)
}

const createScaledCoordinates = (
  density: DensityOldBlendedNoise,
  position: DensityPosition,
): DensityFunctionResult<ScaledCoordinates> =>
  Result.gen(function* resultGenerator() {
    const scaledX = yield* requirePositionAxis('old blended noise x', position.x * BASE_SCALE * density.xzScale)
    const scaledY = yield* requirePositionAxis('old blended noise y', position.y * BASE_SCALE * density.yScale)
    const scaledZ = yield* requirePositionAxis('old blended noise z', position.z * BASE_SCALE * density.xzScale)
    const smear = yield* requireDensityScale(
      'old blended noise smear',
      BASE_SCALE * density.yScale * density.smearScaleMultiplier,
    )
    const factoredSmear = yield* requireDensityScale(
      'old blended noise factored smear',
      smear / density.yFactor,
    )
    const factoredX = yield* requirePositionAxis(
      'old blended noise factored x',
      scaledX / density.xzFactor,
    )
    const factoredY = yield* requirePositionAxis(
      'old blended noise factored y',
      scaledY / density.yFactor,
    )
    const factoredZ = yield* requirePositionAxis(
      'old blended noise factored z',
      scaledZ / density.xzFactor,
    )
    return { factoredSmear, factoredX, factoredY, factoredZ, scaledX, scaledY, scaledZ, smear }
  })

const octaveIndex = (index: number) => DensityOctaveIndex(index)

const sampleMainOctave = (
  source: DensityOldBlendedNoiseOctaveSource,
  index: number,
  factor: number,
  coordinates: ScaledCoordinates,
): DensityFunctionResult<number> =>
  Result.gen(function* resultGenerator() {
    const octave = source(octaveIndex(index))
    if (typeof octave === 'undefined') {
      return BLEND_LOWER_BOUND
    }
    const sample = octave.sample(
      yield* requirePositionAxis('old blended noise octave x', wrap(coordinates.factoredX * factor)),
      yield* requirePositionAxis('old blended noise octave y', wrap(coordinates.factoredY * factor)),
      yield* requirePositionAxis('old blended noise octave z', wrap(coordinates.factoredZ * factor)),
      yield* requireDensityScale('old blended noise octave yScale', coordinates.factoredSmear * factor),
      yield* requirePositionAxis('old blended noise octave yMax', coordinates.factoredY * factor),
    )
    const normalizedSample = yield* requireNoiseSample('old blended noise octave result', sample)
    return yield* requireFiniteNumber(
      normalizedSample / factor,
      () => 'old blended noise octave result must be finite',
    )
  })

const sampleMainNoise = (
  source: DensityOldBlendedNoiseOctaveSource,
  coordinates: ScaledCoordinates,
): DensityFunctionResult<number> =>
  Result.gen(function* resultGenerator() {
    let value = 0
    let factor = FACTOR_START
    for (let index = 0; index < MAIN_OCTAVE_COUNT; index += OCTAVE_STEP) {
      value += yield* sampleMainOctave(source, index, factor, coordinates)
      value = yield* requireFiniteNumber(value, () => 'old blended noise main sum must be finite')
      factor /= FACTOR_DIVISOR
    }
    return value
  })

const createLimitSampleCoordinates = (
  coordinates: ScaledCoordinates,
  factor: number,
): DensityFunctionResult<LimitSampleCoordinates> =>
  Result.gen(function* resultGenerator() {
    return {
      smear: yield* requireDensityScale('old blended noise limit smear', coordinates.smear * factor),
      x: yield* requirePositionAxis('old blended noise limit x', wrap(coordinates.scaledX * factor)),
      y: yield* requirePositionAxis('old blended noise limit y', wrap(coordinates.scaledY * factor)),
      yMax: yield* requirePositionAxis('old blended noise limit yMax', coordinates.scaledY * factor),
      z: yield* requirePositionAxis('old blended noise limit z', wrap(coordinates.scaledZ * factor)),
    }
  })

const sampleLimitOctave = (
  source: DensityOldBlendedNoiseOctaveSource,
  index: number,
  factor: number,
  coordinates: LimitSampleCoordinates,
): DensityFunctionResult<number> =>
  Result.gen(function* resultGenerator() {
    const octave = source(octaveIndex(index))
    if (typeof octave === 'undefined') {
      return BLEND_LOWER_BOUND
    }
    const sample = octave.sample(
      coordinates.x,
      coordinates.y,
      coordinates.z,
      coordinates.smear,
      coordinates.yMax,
    )
    const normalizedSample = yield* requireNoiseSample('old blended noise octave result', sample)
    return yield* requireFiniteNumber(
      normalizedSample / factor,
      () => 'old blended noise octave result must be finite',
    )
  })

const sampleLimitNoiseOctave = (
  input: LimitNoiseOctaveInput,
): DensityFunctionResult<LimitValues> =>
  Result.gen(function* resultGenerator() {
    const { blend, coordinates, density, factor, octaveIndex: index } = input
    const sampleCoordinates = yield* createLimitSampleCoordinates(coordinates, factor)
    let maxValue = BLEND_LOWER_BOUND
    let minValue = BLEND_LOWER_BOUND
    if (blend > BLEND_LOWER_BOUND) {
      maxValue = yield* sampleLimitOctave(
        density.source.maxLimitNoise,
        index,
        factor,
        sampleCoordinates,
      )
    }
    if (blend < BLEND_UPPER_BOUND) {
      minValue = yield* sampleLimitOctave(
        density.source.minLimitNoise,
        index,
        factor,
        sampleCoordinates,
      )
    }
    return { maxValue, minValue }
  })

const addLimitValues = (
  current: LimitValues,
  added: LimitValues,
): Result.Result<LimitValues, RangeError> =>
  Result.gen(function* addLimitValuesResult() {
    const maxValue = yield* requireFiniteNumber(
      current.maxValue + added.maxValue,
      () => 'old blended noise max sum must be finite',
    )
    const minValue = yield* requireFiniteNumber(
      current.minValue + added.minValue,
      () => 'old blended noise min sum must be finite',
    )
    return { maxValue, minValue }
  })

const sampleLimitNoise = (
  density: DensityOldBlendedNoise,
  blend: number,
  coordinates: ScaledCoordinates,
): DensityFunctionResult<LimitValues> =>
  Result.gen(function* resultGenerator() {
    let totals: LimitValues = { maxValue: BLEND_LOWER_BOUND, minValue: BLEND_LOWER_BOUND }
    let factor = FACTOR_START
    for (let index = 0; index < LIMIT_OCTAVE_COUNT; index += OCTAVE_STEP) {
      const octaveValues = yield* sampleLimitNoiseOctave({
        blend,
        coordinates,
        density,
        factor,
        octaveIndex: index,
      })
      totals = yield* addLimitValues(totals, octaveValues)
      factor /= FACTOR_DIVISOR
    }
    return totals
  })

export const evaluateOldBlendedNoise = (
  density: DensityOldBlendedNoise,
  position: DensityPosition,
): DensityFunctionResult<DensityValueType> =>
  Result.gen(function* resultGenerator() {
    const coordinates = yield* createScaledCoordinates(density, position)
    const main = yield* sampleMainNoise(density.source.mainNoise, coordinates)
    const blend = (main / MAIN_VALUE_NORMALIZER + BLEND_UPPER_BOUND) / FACTOR_DIVISOR
    const { maxValue, minValue } = yield* sampleLimitNoise(density, blend, coordinates)
    // Finite limit sums are divided by 512 before interpolation and by 128 afterward.
    const value = clampedLerp(
      minValue / LIMIT_VALUE_NORMALIZER,
      maxValue / LIMIT_VALUE_NORMALIZER,
      blend,
    ) / OUTPUT_SCALE
    return DensityValue(value)
  })
