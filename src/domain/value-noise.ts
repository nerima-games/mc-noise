/**
 * Deterministic value-noise primitives retained for world-generation
 * compatibility. The implementation is owned here so terrain code does not
 * need to carry a second noise implementation.
 */

import { requireFiniteNumber, requireSafeInteger } from './number-validation.js'

export type ValueNoiseFbmOptions = Readonly<{
  octaves: number
  frequency: number
  persistence: number
}>

const validateValueNoiseFbmOptions = (options: ValueNoiseFbmOptions): void => {
  requireSafeInteger('options.octaves', options.octaves)
  requireFiniteNumber('options.frequency', options.frequency)
  requireFiniteNumber('options.persistence', options.persistence)
}

/** Shift distance of zero: forces the uint32 bit pattern without moving any bits. */
const UINT32_COERCION_SHIFT = 0
/** Coerce a number to its uint32 bit pattern via an unsigned right shift by zero. */
const asUint32 = (value: number): number => value >>> UINT32_COERCION_SHIFT
/** How far a loop counter advances per iteration, everywhere in this file. */
const LOOP_STEP = 1
/** The FNV-1a 32-bit prime, `channelSeed`'s per-character mixing constant. */
const FNV_PRIME_32 = 0x01000193

export const channelSeed = (seed: number, channel: string): number => {
  let hash = asUint32(seed)
  for (let index = 0; index < channel.length; index += LOOP_STEP) {
    hash = asUint32(Math.imul(hash ^ channel.charCodeAt(index), FNV_PRIME_32))
  }
  return asUint32(hash)
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

export const latticeValue = (seed: number, x: number, z: number): number => {
  let hash = asUint32(seed)
  hash = asUint32(Math.imul(hash ^ asUint32(x), LATTICE_MIX_X))
  hash = asUint32(Math.imul(hash ^ asUint32(z), LATTICE_MIX_Z))
  hash = asUint32(Math.imul(hash ^ (x >>> HIGH_HALF_SHIFT), LATTICE_MIX_X_HIGH))
  hash ^= hash >>> FINAL_MIX_SHIFT
  return asUint32(hash) / UINT32_MODULUS
}

/** Hermite smoothstep 3t² − 2t³'s two coefficients. */
const SMOOTHSTEP_QUADRATIC_COEFFICIENT = 3
const SMOOTHSTEP_CUBIC_COEFFICIENT = 2

const smoothstep = (t: number): number =>
  t * t * (SMOOTHSTEP_QUADRATIC_COEFFICIENT - SMOOTHSTEP_CUBIC_COEFFICIENT * t)

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Distance, in lattice cells, from a cell's floor corner to its opposite corner. */
const LATTICE_NEIGHBOR_OFFSET = 1

const sampleValueNoise2D = (seed: number, x: number, z: number, frequency: number): number => {
  const sx = x * frequency
  const sz = z * frequency
  const x0 = Math.floor(sx)
  const z0 = Math.floor(sz)
  const tx = smoothstep(sx - x0)
  const tz = smoothstep(sz - z0)

  const top = lerp(
    latticeValue(seed, x0, z0),
    latticeValue(seed, x0 + LATTICE_NEIGHBOR_OFFSET, z0),
    tx,
  )
  const bottom = lerp(
    latticeValue(seed, x0, z0 + LATTICE_NEIGHBOR_OFFSET),
    latticeValue(seed, x0 + LATTICE_NEIGHBOR_OFFSET, z0 + LATTICE_NEIGHBOR_OFFSET),
    tx,
  )

  return lerp(top, bottom, tz)
}

export const valueNoise2D = (seed: number, x: number, z: number, frequency: number): number => {
  requireFiniteNumber('frequency', frequency)
  return sampleValueNoise2D(seed, x, z, frequency)
}

/** How much `fbm2D` doubles its sampling frequency for each successive octave. */
const FREQUENCY_MULTIPLIER = 2
/** An accumulated amplitude of exactly this means every octave contributed zero weight. */
const ZERO_NORMALISATION = 0

export const fbm2D = (seed: number, x: number, z: number, options: ValueNoiseFbmOptions): number => {
  validateValueNoiseFbmOptions(options)
  let total = 0,
    amplitude = 1,
    normalisation = 0,
    { frequency } = options

  for (let octave = 0; octave < options.octaves; octave += LOOP_STEP) {
    total += sampleValueNoise2D(channelSeed(seed, `octave-${String(octave)}`), x, z, frequency) * amplitude
    normalisation += amplitude
    amplitude *= options.persistence
    frequency *= FREQUENCY_MULTIPLIER
  }

  if (normalisation === ZERO_NORMALISATION) {
    return ZERO_NORMALISATION
  }
  return total / normalisation
}
