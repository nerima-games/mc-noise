import type {
  DensityOldBlendedNoise,
  DensityOldBlendedNoiseOctaveSource,
  DensityPosition,
} from './density-function-types.js'

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

const wrap = (value: number): number =>
  value - Math.floor(value / WRAP_PERIOD + HALF) * WRAP_PERIOD

const clampedLerp = (start: number, end: number, delta: number): number => {
  const clampedDelta = Math.max(
    BLEND_LOWER_BOUND,
    Math.min(BLEND_UPPER_BOUND, delta),
  )
  return start + (end - start) * clampedDelta
}

type ScaledCoordinates = Readonly<{
  readonly factoredSmear: number
  readonly factoredX: number
  readonly factoredY: number
  readonly factoredZ: number
  readonly scaledX: number
  readonly scaledY: number
  readonly scaledZ: number
  readonly smear: number
}>

type LimitSampleCoordinates = Readonly<{
  readonly smear: number
  readonly x: number
  readonly y: number
  readonly yMax: number
  readonly z: number
}>

const createScaledCoordinates = (
  density: DensityOldBlendedNoise,
  position: DensityPosition,
): ScaledCoordinates => {
  const scaledX = position.x * BASE_SCALE * density.xzScale
  const scaledY = position.y * BASE_SCALE * density.yScale
  const scaledZ = position.z * BASE_SCALE * density.xzScale
  const smear = BASE_SCALE * density.yScale * density.smearScaleMultiplier
  return {
    factoredSmear: smear / density.yFactor,
    factoredX: scaledX / density.xzFactor,
    factoredY: scaledY / density.yFactor,
    factoredZ: scaledZ / density.xzFactor,
    scaledX,
    scaledY,
    scaledZ,
    smear,
  }
}

const sampleMainOctave = (
  source: DensityOldBlendedNoiseOctaveSource,
  octaveIndex: number,
  factor: number,
  coordinates: ScaledCoordinates,
): number => {
  const octave = source(octaveIndex)
  if (typeof octave === 'undefined') {
    return BLEND_LOWER_BOUND
  }
  return octave.sample(
    wrap(coordinates.factoredX * factor),
    wrap(coordinates.factoredY * factor),
    wrap(coordinates.factoredZ * factor),
    coordinates.factoredSmear * factor,
    coordinates.factoredY * factor,
  ) / factor
}

const sampleMainNoise = (
  source: DensityOldBlendedNoiseOctaveSource,
  coordinates: ScaledCoordinates,
): number => {
  let value = 0
  let factor = FACTOR_START
  for (
    let octaveIndex = 0;
    octaveIndex < MAIN_OCTAVE_COUNT;
    octaveIndex += OCTAVE_STEP
  ) {
    value += sampleMainOctave(source, octaveIndex, factor, coordinates)
    factor /= FACTOR_DIVISOR
  }
  return value
}

const createLimitSampleCoordinates = (
  coordinates: ScaledCoordinates,
  factor: number,
): LimitSampleCoordinates => ({
  smear: coordinates.smear * factor,
  x: wrap(coordinates.scaledX * factor),
  y: wrap(coordinates.scaledY * factor),
  yMax: coordinates.scaledY * factor,
  z: wrap(coordinates.scaledZ * factor),
})

const sampleLimitOctave = (
  source: DensityOldBlendedNoiseOctaveSource,
  octaveIndex: number,
  factor: number,
  coordinates: LimitSampleCoordinates,
): number => {
  const octave = source(octaveIndex)
  if (typeof octave === 'undefined') {
    return BLEND_LOWER_BOUND
  }
  return octave.sample(
    coordinates.x,
    coordinates.y,
    coordinates.z,
    coordinates.smear,
    coordinates.yMax,
  ) / factor
}

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

const sampleLimitNoiseOctave = (input: LimitNoiseOctaveInput): LimitValues => {
  const {
    blend,
    coordinates,
    density,
    factor,
    octaveIndex,
  } = input
  const sampleCoordinates = createLimitSampleCoordinates(coordinates, factor)
  let maxValue = BLEND_LOWER_BOUND
  let minValue = BLEND_LOWER_BOUND
  if (blend > BLEND_LOWER_BOUND) {
    maxValue = sampleLimitOctave(
      density.source.maxLimitNoise,
      octaveIndex,
      factor,
      sampleCoordinates,
    )
  }
  if (blend < BLEND_UPPER_BOUND) {
    minValue = sampleLimitOctave(
      density.source.minLimitNoise,
      octaveIndex,
      factor,
      sampleCoordinates,
    )
  }
  return { maxValue, minValue }
}

const sampleLimitNoise = (
  density: DensityOldBlendedNoise,
  blend: number,
  coordinates: ScaledCoordinates,
): LimitValues => {
  let minValue = 0
  let maxValue = 0
  let factor = FACTOR_START
  for (
    let octaveIndex = 0;
    octaveIndex < LIMIT_OCTAVE_COUNT;
    octaveIndex += OCTAVE_STEP
  ) {
    const octaveValues = sampleLimitNoiseOctave({
      blend,
      coordinates,
      density,
      factor,
      octaveIndex,
    })
    maxValue += octaveValues.maxValue
    minValue += octaveValues.minValue
    factor /= FACTOR_DIVISOR
  }
  return { maxValue, minValue }
}

export const evaluateOldBlendedNoise = (
  density: DensityOldBlendedNoise,
  position: DensityPosition,
): number => {
  const coordinates = createScaledCoordinates(density, position)
  const blend = (
    sampleMainNoise(density.source.mainNoise, coordinates) / MAIN_VALUE_NORMALIZER
    + BLEND_UPPER_BOUND
  ) / FACTOR_DIVISOR
  const { maxValue, minValue } = sampleLimitNoise(density, blend, coordinates)
  return clampedLerp(
    minValue / LIMIT_VALUE_NORMALIZER,
    maxValue / LIMIT_VALUE_NORMALIZER,
    blend,
  ) / OUTPUT_SCALE
}
