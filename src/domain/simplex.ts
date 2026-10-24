import type { NoiseFn2D, NoiseFn3D } from './perlin.js'
import { SIMPLEX_ONE, SIMPLEX_ZERO } from './simplex-constants.js'
import { sampleSimplex2D, sampleSimplex3D } from './simplex-sampling.js'
import { type RandFn } from './seed.js'
import { Result } from 'effect'
import { SimplexCoordinate } from './simplex-points.js'
import { requireFiniteNumber } from './number-validation.js'

const SIMPLEX_PERMUTATION_SIZE = 256
const SIMPLEX_ORIGIN_SCALE = 256
const SIMPLEX_PERMUTATION_MASK = SIMPLEX_PERMUTATION_SIZE - SIMPLEX_ONE

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
): Result.Result<SimplexOrigins, RangeError> =>
  Result.gen(function* createSimplexOriginsResult() {
    const randomOriginX = rand() * SIMPLEX_ORIGIN_SCALE
    const randomOriginY = rand() * SIMPLEX_ORIGIN_SCALE
    const randomOriginZ = rand() * SIMPLEX_ORIGIN_SCALE
    const originX = yield* requireFiniteNumber(options.originX ?? randomOriginX, () => 'originX must be finite')
    const originY = yield* requireFiniteNumber(options.originY ?? randomOriginY, () => 'originY must be finite')
    const originZ = yield* requireFiniteNumber(options.originZ ?? randomOriginZ, () => 'originZ must be finite')
    return { originX, originY, originZ }
  })

const createSimplexPermutation = (): DataView => {
  const permutation = new Uint8Array(SIMPLEX_PERMUTATION_SIZE)
  const view = new DataView(permutation.buffer, permutation.byteOffset, permutation.byteLength)
  for (
    let index = SIMPLEX_ZERO;
    index < SIMPLEX_PERMUTATION_SIZE;
    index += SIMPLEX_ONE
  ) {
    view.setUint8(index, index)
  }
  return view
}

const shuffleSimplexPermutation = (permutation: DataView, rand: RandFn): void => {
  for (
    let index = SIMPLEX_ZERO;
    index < SIMPLEX_PERMUTATION_SIZE;
    index += SIMPLEX_ONE
  ) {
    const remaining = SIMPLEX_PERMUTATION_SIZE - index
    const swapWith = (index + Math.floor(rand() * remaining)) & SIMPLEX_PERMUTATION_MASK
    const value = permutation.getUint8(index)
    const swapValue = permutation.getUint8(swapWith)
    permutation.setUint8(index, swapValue)
    permutation.setUint8(swapWith, value)
  }
}

const buildSimplexPermutation = (rand: RandFn): DataView => {
  const permutation = createSimplexPermutation()
  shuffleSimplexPermutation(permutation, rand)
  return permutation
}

export const createSimplexNoise2D = (
  rand: RandFn,
  options: SimplexNoise2DOptions = {},
): Result.Result<NoiseFn2D, RangeError> => {
  const origins = createSimplexOrigins(rand, options)
  if (Result.isFailure(origins)) {
    return Result.fail(origins.failure)
  }
  const permutation = buildSimplexPermutation(rand)
  return Result.succeed((x, z) =>
    sampleSimplex2D(permutation, {
      x: SimplexCoordinate(x + origins.success.originX),
      z: SimplexCoordinate(z + origins.success.originZ),
    }))
}

export const createSimplexNoise3D = (
  rand: RandFn,
  options: SimplexNoise3DOptions = {},
): Result.Result<NoiseFn3D, RangeError> => {
  const origins = createSimplexOrigins(rand, options)
  if (Result.isFailure(origins)) {
    return Result.fail(origins.failure)
  }
  const permutation = buildSimplexPermutation(rand)
  return Result.succeed((x, y, z) =>
    sampleSimplex3D(permutation, {
      x: SimplexCoordinate(x + origins.success.originX),
      y: SimplexCoordinate(y + origins.success.originY),
      z: SimplexCoordinate(z + origins.success.originZ),
    }))
}
