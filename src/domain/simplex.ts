import { type NoiseFn2D, type NoiseFn3D } from './perlin.js'
import { SIMPLEX_ONE, SIMPLEX_ZERO } from './simplex-constants.js'
import { sampleSimplex2D, sampleSimplex3D } from './simplex-sampling.js'
import type { RandFn } from './seed.js'
import { requireFinite } from './number-validation.js'

const SIMPLEX_PERMUTATION_SIZE = 256
const SIMPLEX_ORIGIN_SCALE = 256

export type SimplexNoise2DOptions = Readonly<{
  readonly originX?: number
  readonly originZ?: number
}>

export type SimplexNoise3DOptions = Readonly<{
  readonly originX?: number
  readonly originY?: number
  readonly originZ?: number
}>

type SimplexOriginOptions = Readonly<{
  readonly originX?: number
  readonly originY?: number
  readonly originZ?: number
}>

type SimplexOrigins = Readonly<{
  readonly originX: number
  readonly originY: number
  readonly originZ: number
}>

const createSimplexOrigins = (
  rand: RandFn,
  options: SimplexOriginOptions,
): SimplexOrigins => {
  const randomOriginX = rand() * SIMPLEX_ORIGIN_SCALE
  const randomOriginY = rand() * SIMPLEX_ORIGIN_SCALE
  const randomOriginZ = rand() * SIMPLEX_ORIGIN_SCALE
  return {
    originX: requireFinite('originX', options.originX ?? randomOriginX),
    originY: requireFinite('originY', options.originY ?? randomOriginY),
    originZ: requireFinite('originZ', options.originZ ?? randomOriginZ),
  }
}

const createSimplexPermutation = (): Uint8Array => {
  const permutation = new Uint8Array(SIMPLEX_PERMUTATION_SIZE)
  for (
    let index = SIMPLEX_ZERO;
    index < SIMPLEX_PERMUTATION_SIZE;
    index += SIMPLEX_ONE
  ) {
    permutation[index] = index
  }
  return permutation
}

const buildSimplexPermutation = (rand: RandFn): Uint8Array => {
  const permutation = createSimplexPermutation()
  for (
    let index = SIMPLEX_ZERO;
    index < SIMPLEX_PERMUTATION_SIZE;
    index += SIMPLEX_ONE
  ) {
    const remaining = SIMPLEX_PERMUTATION_SIZE - index
    const swapWith = index + Math.floor(rand() * remaining)
    const value = permutation[index]!
    const swapValue = permutation[swapWith]!
    permutation[index] = swapValue
    permutation[swapWith] = value
  }
  return permutation
}

export const createSimplexNoise2D = (
  rand: RandFn,
  options: SimplexNoise2DOptions = {},
): NoiseFn2D => {
  const origins = createSimplexOrigins(rand, options)
  const permutation = buildSimplexPermutation(rand)
  return (x, z) =>
    sampleSimplex2D(permutation, {
      x: x + origins.originX,
      z: z + origins.originZ,
    })
}

export const createSimplexNoise3D = (
  rand: RandFn,
  options: SimplexNoise3DOptions = {},
): NoiseFn3D => {
  const origins = createSimplexOrigins(rand, options)
  const permutation = buildSimplexPermutation(rand)
  return (x, y, z) =>
    sampleSimplex3D(permutation, {
      x: x + origins.originX,
      y: y + origins.originY,
      z: z + origins.originZ,
    })
}
