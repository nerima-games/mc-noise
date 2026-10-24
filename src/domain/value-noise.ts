/**
 * Deterministic value-noise primitives retained for world-generation
 * compatibility. The implementation is owned here so terrain code does not
 * need to carry a second noise implementation.
 */

import { Brand, Result } from 'effect'
import { NoiseSeed, type NoiseSeed as NoiseSeedValue } from './seed.js'
import {
  OctaveAmplitude,
  type OctaveAmplitude as OctaveAmplitudeValue,
  OctaveCount,
  type OctaveCount as OctaveCountValue,
} from './octaves.js'
import { requireFiniteNumber, requireSafeInteger } from './number-validation.js'
import { BoundedNoise } from './noise-primitives.js'

export type NoiseChannelLabel = string & Brand.Brand<'NoiseChannelLabel'>
export const NoiseChannelLabel: Brand.Constructor<NoiseChannelLabel> = Brand.make<NoiseChannelLabel>(
  (value) => typeof value === 'string' || 'channel label must be a string',
)

export type NoiseFrequency = number & Brand.Brand<'NoiseFrequency'>
export const NoiseFrequency: Brand.Constructor<NoiseFrequency> = Brand.make<NoiseFrequency>(
  (value) => Number.isFinite(value) || 'frequency must be finite',
)

export type ValueNoiseFbmSample = number & Brand.Brand<'ValueNoiseFbmSample'>
export const ValueNoiseFbmSample: Brand.Constructor<ValueNoiseFbmSample> =
  Brand.make<ValueNoiseFbmSample>(
    (value) => Number.isFinite(value) || 'fBm sample must be finite',
  )

export type LatticeCoordinate = number & Brand.Brand<'LatticeCoordinate'>
export const LatticeCoordinate: Brand.Constructor<LatticeCoordinate> = Brand.make<LatticeCoordinate>(
  (value) => Number.isSafeInteger(value) || 'lattice coordinate must be a safe integer',
)

export type ValueNoiseFbmOptions = Readonly<{
  octaves: OctaveCountValue
  frequency: NoiseFrequency
  persistence: OctaveAmplitudeValue
}>

type NormalizedValueNoiseFbmOptions = Readonly<{
  octaves: OctaveCountValue
  frequency: NoiseFrequency
  persistence: OctaveAmplitudeValue
}>

const validateValueNoiseFbmOptions = (
  options: ValueNoiseFbmOptions,
): Result.Result<NormalizedValueNoiseFbmOptions, RangeError> => {
  const octaves = requireSafeInteger(options.octaves, () => `options.octaves must be a safe integer, received ${options.octaves}`)
  if (Result.isFailure(octaves)) {
    return Result.fail(octaves.failure)
  }
  const frequency = requireFiniteNumber(options.frequency, () => `options.frequency must be finite, received ${options.frequency}`)
  if (Result.isFailure(frequency)) {
    return Result.fail(frequency.failure)
  }
  const persistence = requireFiniteNumber(options.persistence, () => `options.persistence must be finite, received ${options.persistence}`)
  if (Result.isFailure(persistence)) {
    return Result.fail(persistence.failure)
  }
  return Result.succeed({
    frequency: NoiseFrequency(frequency.success),
    octaves: OctaveCount(octaves.success),
    persistence: OctaveAmplitude(persistence.success),
  })
}

/** Shift distance of zero: forces the uint32 bit pattern without moving any bits. */
const UINT32_COERCION_SHIFT = 0
/** Coerce a number to its uint32 bit pattern via an unsigned right shift by zero. */
const asUint32 = (value: number): number => value >>> UINT32_COERCION_SHIFT
/** How far a loop counter advances per iteration, everywhere in this file. */
const LOOP_STEP = 1
/** The FNV-1a 32-bit prime, `channelSeed`'s per-character mixing constant. */
const FNV_PRIME_32 = 0x01000193

export const channelSeed = (seed: NoiseSeedValue, channel: NoiseChannelLabel): NoiseSeedValue => {
  let hash = asUint32(seed)
  for (let index = 0; index < channel.length; index += LOOP_STEP) {
    hash = asUint32(Math.imul(hash ^ channel.charCodeAt(index), FNV_PRIME_32))
  }
  return NoiseSeed(asUint32(hash))
}

/** Murmur3-style finalizer constants, applied in turn to fold `x`, `z`, and `x`'s high half into one hash. */
const LATTICE_MIX_X = 0x85ebca6b
const LATTICE_MIX_Z = 0xc2b2ae35
const LATTICE_MIX_X_HIGH = 0x27d4eb2f
/** Shift that isolates a uint32's high half, used to fold `x`'s upper bits into the hash a second time. */
const HIGH_HALF_SHIFT = 16
/** Final avalanche shift applied after the three multiplicative mixing rounds. */
const FINAL_MIX_SHIFT = 15
/** 2^32 — divides the finished hash down into [0, 1). */
const UINT32_MODULUS = 4294967296

export const latticeValue = (seed: NoiseSeedValue, x: LatticeCoordinate, z: LatticeCoordinate): BoundedNoise => {
  let hash = asUint32(seed)
  hash = asUint32(Math.imul(hash ^ asUint32(x), LATTICE_MIX_X))
  hash = asUint32(Math.imul(hash ^ asUint32(z), LATTICE_MIX_Z))
  hash = asUint32(Math.imul(hash ^ (x >>> HIGH_HALF_SHIFT), LATTICE_MIX_X_HIGH))
  hash ^= hash >>> FINAL_MIX_SHIFT
  return BoundedNoise(asUint32(hash) / UINT32_MODULUS)
}

/** Hermite smoothstep 3t² − 2t³'s two coefficients. */
const SMOOTHSTEP_QUADRATIC_COEFFICIENT = 3
const SMOOTHSTEP_CUBIC_COEFFICIENT = 2

const smoothstep = (t: number): number =>
  t * t * (SMOOTHSTEP_QUADRATIC_COEFFICIENT - SMOOTHSTEP_CUBIC_COEFFICIENT * t)

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Distance, in lattice cells, from a cell's floor corner to its opposite corner. */
const LATTICE_NEIGHBOR_OFFSET = 1

type NoiseSampleCorners = Readonly<{
  x0: LatticeCoordinate
  x1: LatticeCoordinate
  z0: LatticeCoordinate
  z1: LatticeCoordinate
  tx: number
  tz: number
}>

const requireLatticeCoordinate = (value: number, name: string): Result.Result<LatticeCoordinate, RangeError> => {
  const safeInteger = requireSafeInteger(value, () => `${name} must be a safe integer, received ${value}`)
  if (Result.isFailure(safeInteger)) {
    return Result.fail(safeInteger.failure)
  }
  return Result.succeed(LatticeCoordinate(safeInteger.success))
}

const createNoiseSampleCorners = (
  x: number,
  z: number,
  frequency: NoiseFrequency,
): Result.Result<NoiseSampleCorners, RangeError> =>
  Result.gen(function* createNoiseSampleCornersResult() {
    const sx = yield* requireFiniteNumber(x * frequency, () => 'sample x multiplied by frequency must remain finite')
    const sz = yield* requireFiniteNumber(z * frequency, () => 'sample z multiplied by frequency must remain finite')
    const x0 = yield* requireLatticeCoordinate(Math.floor(sx), 'lattice x')
    const z0 = yield* requireLatticeCoordinate(Math.floor(sz), 'lattice z')
    const x1 = yield* requireLatticeCoordinate(x0 + LATTICE_NEIGHBOR_OFFSET, 'lattice x neighbor')
    const z1 = yield* requireLatticeCoordinate(z0 + LATTICE_NEIGHBOR_OFFSET, 'lattice z neighbor')
    return {
      tx: smoothstep(sx - x0),
      tz: smoothstep(sz - z0),
      x0,
      x1,
      z0,
      z1,
    }
  })

const sampleValueNoise2D = (
  seed: NoiseSeedValue,
  x: number,
  z: number,
  frequency: NoiseFrequency,
): Result.Result<BoundedNoise, RangeError> =>
  Result.map(createNoiseSampleCorners(x, z, frequency), ({ x0, x1, z0, z1, tx, tz }) => {
    const top = lerp(
      latticeValue(seed, x0, z0),
      latticeValue(seed, x1, z0),
      tx,
    )
    const bottom = lerp(
      latticeValue(seed, x0, z1),
      latticeValue(seed, x1, z1),
      tx,
    )
    return BoundedNoise(lerp(top, bottom, tz))
  })

export const valueNoise2D = (
  seed: NoiseSeedValue,
  x: number,
  z: number,
  frequency: NoiseFrequency,
): Result.Result<BoundedNoise, RangeError> => {
  const validX = requireFiniteNumber(x, () => `x must be finite, received ${x}`)
  if (Result.isFailure(validX)) {
    return Result.fail(validX.failure)
  }
  const validZ = requireFiniteNumber(z, () => `z must be finite, received ${z}`)
  if (Result.isFailure(validZ)) {
    return Result.fail(validZ.failure)
  }
  const validFrequency = requireFiniteNumber(frequency, () => `frequency must be finite, received ${frequency}`)
  if (Result.isFailure(validFrequency)) {
    return Result.fail(validFrequency.failure)
  }
  return sampleValueNoise2D(seed, validX.success, validZ.success, NoiseFrequency(validFrequency.success))
}

/** How much `fbm2D` doubles its sampling frequency for each successive octave. */
const FREQUENCY_MULTIPLIER = 2
/** An accumulated amplitude of exactly this means every octave contributed zero weight. */
const ZERO_NORMALISATION = 0

type ValidatedFbmInput = Readonly<{
  x: number
  z: number
  options: NormalizedValueNoiseFbmOptions
}>

type FbmState = Readonly<{
  amplitude: number
  frequency: NoiseFrequency
  normalisation: number
  total: number
}>

const validateFbmInput = (
  x: number,
  z: number,
  options: ValueNoiseFbmOptions,
): Result.Result<ValidatedFbmInput, RangeError> =>
  Result.gen(function* validateFbmInputResult() {
    const validX = yield* requireFiniteNumber(x, () => `x must be finite, received ${x}`)
    const validZ = yield* requireFiniteNumber(z, () => `z must be finite, received ${z}`)
    const validatedOptions = yield* validateValueNoiseFbmOptions(options)
    return { options: validatedOptions, x: validX, z: validZ }
  })

const sampleFbmOctave = (
  seed: NoiseSeedValue,
  input: ValidatedFbmInput,
  state: FbmState,
  octave: number,
): Result.Result<BoundedNoise, RangeError> =>
  sampleValueNoise2D(
    channelSeed(seed, NoiseChannelLabel(`octave-${String(octave)}`)),
    input.x,
    input.z,
    state.frequency,
  )

const addFbmSample = (
  state: FbmState,
  sample: BoundedNoise,
): Result.Result<FbmState, RangeError> => {
  const total = state.total + sample * state.amplitude
  const normalisation = state.normalisation + state.amplitude
  if (!Number.isFinite(total) || !Number.isFinite(normalisation)) {
    return Result.fail(new RangeError('fBm accumulation must remain finite'))
  }
  return Result.succeed({ ...state, normalisation, total })
}

const nextFbmParameters = (
  state: FbmState,
  persistence: OctaveAmplitudeValue,
): Result.Result<Readonly<{ amplitude: number; frequency: NoiseFrequency }>, RangeError> => {
  const amplitude = state.amplitude * persistence
  const nextFrequency = requireFiniteNumber(
    state.frequency * FREQUENCY_MULTIPLIER,
    () => 'fBm frequency must remain finite',
  )
  if (Result.isFailure(nextFrequency)) {
    return Result.fail(nextFrequency.failure)
  }
  if (!Number.isFinite(amplitude)) {
    return Result.fail(new RangeError('fBm parameters must remain finite'))
  }
  return Result.succeed({ amplitude, frequency: NoiseFrequency(nextFrequency.success) })
}

const advanceFbmState = (
  state: FbmState,
  sample: BoundedNoise,
  persistence: OctaveAmplitudeValue,
  isLastOctave: boolean,
): Result.Result<FbmState, RangeError> =>
  Result.flatMap(addFbmSample(state, sample), (sampledState) => {
    if (isLastOctave) {
      return Result.succeed(sampledState)
    }
    return Result.map(
      nextFbmParameters(sampledState, persistence),
      (parameters) => ({ ...sampledState, ...parameters }),
    )
  })

const accumulateFbm = (
  seed: NoiseSeedValue,
  input: ValidatedFbmInput,
): Result.Result<ValueNoiseFbmSample, RangeError> =>
  Result.gen(function* accumulateFbmResult() {
    const { options } = input
    let state: FbmState = {
      amplitude: 1,
      frequency: options.frequency,
      normalisation: ZERO_NORMALISATION,
      total: ZERO_NORMALISATION,
    }
    for (let octave = 0; octave < options.octaves; octave += LOOP_STEP) {
      const sample = yield* sampleFbmOctave(seed, input, state, octave)
      state = yield* advanceFbmState(
        state,
        sample,
        options.persistence,
        octave + LOOP_STEP === options.octaves,
      )
    }
    if (state.normalisation === ZERO_NORMALISATION) {
      return ValueNoiseFbmSample(ZERO_NORMALISATION)
    }
    return ValueNoiseFbmSample(state.total / state.normalisation)
  })

export const fbm2D = (
  seed: NoiseSeedValue,
  x: number,
  z: number,
  options: ValueNoiseFbmOptions,
): Result.Result<ValueNoiseFbmSample, RangeError> =>
  Result.flatMap(validateFbmInput(x, z, options), (input) =>
    accumulateFbm(seed, input),
  )
