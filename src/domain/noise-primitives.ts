/**
 * Minecraft-facing primitive assembly.
 *
 * The low-level kernels stay independently reusable; this module fixes the
 * seed salts, octave stacks, coordinate scales, and output conventions used by
 * terrain generation.
 */
import {
  type NoiseFn2D,
  type NoiseFn3D,
  createPerlinNoise2D,
  createPerlinNoise3D,
} from './perlin.js'
import { NoiseSeed, mulberry32, toUint32 } from './seed.js'
import {
  type OctaveNoiseArguments,
  type OctaveParams,
  computeOctaveNoise,
  normalizeNoise,
  signedFbm2D,
} from './octaves.js'
import {
  SCALE_C,
  SCALE_E,
  SCALE_J,
  SCALE_W,
  type TerrainChannelSamples,
  computeTerrainChannels,
} from './terrain-channels.js'

export const WEYL_C = 0x9e3779b1
export const WEYL_E = 0xbb67ae85
export const WEYL_W = 0x3c6ef372
export const WEYL_J = 0xa54ff53a
export const WEYL_3D = 0x9e3779b9

const UINT32_COERCION_SHIFT = 0
const CONTINENTALNESS_BOOST = 1.4
const EROSION_BOOST = 1.3

const CONTINENTALNESS_PARAMS: OctaveParams = {
  lacunarity: 2,
  octaves: 4,
  persistence: 0.5,
}
const EROSION_PARAMS: OctaveParams = {
  lacunarity: 2,
  octaves: 3,
  persistence: 0.5,
}
const WEIRDNESS_PARAMS: OctaveParams = EROSION_PARAMS

const derivePrimitiveSeed = (seed: NoiseSeed, salt: number): NoiseSeed =>
  NoiseSeed((toUint32(seed) ^ salt) >>> UINT32_COERCION_SHIFT)

/**
 * The complete set of seeded primitive samplers used by terrain generation.
 * Raw kernels stay signed; `noise2D` is normalized and `noise3D` preserves the
 * signed reference convention.
 */
export type NoisePrimitives = Readonly<{
  raw2D: NoiseFn2D
  raw3D: NoiseFn3D
  continentalness: NoiseFn2D
  erosion: NoiseFn2D
  weirdness: NoiseFn2D
  jaggedness: NoiseFn2D
  noise2D: NoiseFn2D
  octaveNoise2D: (...args: OctaveNoiseArguments) => number
  noise3D: NoiseFn3D
  continentalnessAt: NoiseFn2D
  erosionAt: NoiseFn2D
  weirdnessAt: NoiseFn2D
  jaggednessAt: NoiseFn2D
  sampleTerrainChannels: (xStart: number, zStart: number) => TerrainChannelSamples
}>

/** Assemble the deterministic primitive set for one world seed. */
export const createNoisePrimitives = (seed: NoiseSeed): NoisePrimitives => {
  const raw2D = createPerlinNoise2D(mulberry32(seed))
  const raw3D = createPerlinNoise3D(mulberry32(derivePrimitiveSeed(seed, WEYL_3D)))
  const continentalness = signedFbm2D(
    createPerlinNoise2D(mulberry32(derivePrimitiveSeed(seed, WEYL_C))),
    CONTINENTALNESS_PARAMS,
    CONTINENTALNESS_BOOST,
  )
  const erosion = signedFbm2D(
    createPerlinNoise2D(mulberry32(derivePrimitiveSeed(seed, WEYL_E))),
    EROSION_PARAMS,
    EROSION_BOOST,
  )
  const weirdness = signedFbm2D(
    createPerlinNoise2D(mulberry32(derivePrimitiveSeed(seed, WEYL_W))),
    WEIRDNESS_PARAMS,
    EROSION_BOOST,
  )
  const jaggedness = createPerlinNoise2D(mulberry32(derivePrimitiveSeed(seed, WEYL_J)))

  return {
    continentalness,
    continentalnessAt: (x, z) => continentalness(x * SCALE_C, z * SCALE_C),
    erosion,
    erosionAt: (x, z) => erosion(x * SCALE_E, z * SCALE_E),
    jaggedness,
    jaggednessAt: (x, z) => jaggedness(x * SCALE_J, z * SCALE_J),
    noise2D: (x, z) => normalizeNoise(raw2D(x, z)),
    noise3D: raw3D,
    octaveNoise2D: (...args) => computeOctaveNoise(raw2D, ...args),
    raw2D,
    raw3D,
    sampleTerrainChannels: (xStart, zStart) =>
      computeTerrainChannels(continentalness, erosion, weirdness, jaggedness, xStart, zStart),
    weirdness,
    weirdnessAt: (x, z) => weirdness(x * SCALE_W, z * SCALE_W),
  }
}
