/**
 * Perlin gradient-noise kernels, 2D and 3D.
 *
 * FIRST CUT (叩き台).
 *
 * ---------------------------------------------------------------------------
 * `rand` is REQUIRED here, unlike in the reference implementation
 * ---------------------------------------------------------------------------
 *
 * `packages/world/domain/perlin.ts:41` and `:75` of the reference declare
 * `rand?: RandFn` and fall back to `Math.random` when it is omitted. That
 * default is a determinism hole: a caller who forgets one argument gets terrain
 * that differs on every load, with no type error and no test failure until
 * somebody notices a world regenerating itself. This repository makes the PRNG
 * a required argument, which turns that whole class of bug into a compile
 * error. See docs/design-notes.md, regression `noise-determinism-required-prng`.
 *
 * ---------------------------------------------------------------------------
 * Output range
 * ---------------------------------------------------------------------------
 *
 * These kernels are SIGNED and approximately [-1, 1]; they are not clamped. The
 * theoretical bound of n-dimensional Perlin noise with unit gradients is
 * sqrt(n)/2, so each kernel scales by the corresponding constant to bring the
 * practical maximum to ~1. Callers that need [0, 1] compose with
 * `normalizeNoise` from ./octaves; callers that need a hard bound must clamp.
 * The reference's range conventions differ per function and that inconsistency
 * is documented in docs/public-api.md — this repository normalises deliberately
 * at the composition layer instead.
 */
import type { RandFn } from './seed'

/** Size of the permutation table. A power of two so the wrap is a mask. */
export const PERMUTATION_SIZE = 256

const PERMUTATION_MASK = PERMUTATION_SIZE - 1

/** 2D unit gradients have magnitude 1; the noise maximum is 1/sqrt(2). */
const AMPLITUDE_SCALE_2D = Math.SQRT2

/** Diagonal components for the isotropic 8-direction kernel. */
const INVERSE_SQRT2 = Math.SQRT1_2

/** 3D maximum is 1/sqrt(3) under the same argument. */
const AMPLITUDE_SCALE_3D = Math.sqrt(3)

export type NoiseFn2D = (x: number, z: number) => number
export type NoiseFn3D = (x: number, y: number, z: number) => number

/**
 * Build a permutation of [0, 255] by Fisher-Yates over the supplied PRNG.
 *
 * `let` + `for` throughout: this is a state-threading shuffle, and the array
 * `fold` spelling of it would allocate an intermediate array per swap. Same
 * exemption as the octave loop (plan.md §5.2), for the same reason.
 */
export const buildPermutation = (rand: RandFn): Uint8Array => {
  const permutation = new Uint8Array(PERMUTATION_SIZE)
  for (let index = 0; index < PERMUTATION_SIZE; index += 1) {
    permutation[index] = index
  }
  for (let index = PERMUTATION_SIZE - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(rand() * (index + 1))
    const held = permutation[index] ?? 0
    permutation[index] = permutation[swapWith] ?? 0
    permutation[swapWith] = held
  }
  return permutation
}

/** Ken Perlin's quintic ease curve: 6t^5 - 15t^4 + 10t^3. C2-continuous. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)

const lerp = (from: number, to: number, t: number): number => from + t * (to - from)

/** 2D gradient dot product, selected by the low bits of the hash. */
const gradient2d = (hash: number, x: number, z: number): number => {
  switch (hash & 3) {
    case 0:
      return x + z
    case 1:
      return -x + z
    case 2:
      return x - z
    default:
      return -x - z
  }
}

/** Unit-length axis and diagonal gradients, selected uniformly by three hash bits. */
const gradient2dIsotropic = (hash: number, x: number, z: number): number => {
  switch (hash & 7) {
    case 0:
      return x
    case 1:
      return -x
    case 2:
      return z
    case 3:
      return -z
    case 4:
      return (x + z) * INVERSE_SQRT2
    case 5:
      return (-x + z) * INVERSE_SQRT2
    case 6:
      return (x - z) * INVERSE_SQRT2
    default:
      return (-x - z) * INVERSE_SQRT2
  }
}

const createPerlinNoise2DWithGradient = (
  rand: RandFn,
  gradient: (hash: number, x: number, z: number) => number,
): NoiseFn2D => {
  const permutation = buildPermutation(rand)

  return (x, z) => {
    const floorX = Math.floor(x)
    const floorZ = Math.floor(z)
    const cellX = floorX & PERMUTATION_MASK
    const cellZ = floorZ & PERMUTATION_MASK
    const fracX = x - floorX
    const fracZ = z - floorZ
    const easedX = fade(fracX)
    const easedZ = fade(fracZ)

    const rowA = ((permutation[cellX] ?? 0) + cellZ) & PERMUTATION_MASK
    const rowB = ((permutation[(cellX + 1) & PERMUTATION_MASK] ?? 0) + cellZ) & PERMUTATION_MASK

    const bottom = lerp(
      gradient(permutation[rowA] ?? 0, fracX, fracZ),
      gradient(permutation[rowB] ?? 0, fracX - 1, fracZ),
      easedX,
    )
    const top = lerp(
      gradient(permutation[(rowA + 1) & PERMUTATION_MASK] ?? 0, fracX, fracZ - 1),
      gradient(permutation[(rowB + 1) & PERMUTATION_MASK] ?? 0, fracX - 1, fracZ - 1),
      easedX,
    )

    return lerp(bottom, top, easedZ) * AMPLITUDE_SCALE_2D
  }
}

/** 3D gradient dot product over the 12 edge-midpoint vectors of a cube. */
const gradient3d = (hash: number, x: number, y: number, z: number): number => {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return (h & 1) === 0 ? u + v : h & 2 ? -u - v : u - v
}

/**
 * A 2D Perlin sampler over a permutation table derived from `rand`.
 *
 * Returns a closure rather than taking the seed per call. Building the
 * permutation table is O(256); doing it per sample would dominate the cost of
 * the noise itself. This is also why the seed is not a parameter of the sampler
 * — see docs/public-api.md on the difference from plan.md's sketched
 * `noise2d(seed, x, y, z)` signature.
 */
export const createPerlinNoise2D = (rand: RandFn): NoiseFn2D => {
  return createPerlinNoise2DWithGradient(rand, gradient2d)
}

/**
 * A less directionally biased 2D kernel with eight unit gradients.
 *
 * This is opt-in because selecting it changes the frozen seed-to-value mapping.
 * Existing worlds must continue to use `createPerlinNoise2D`.
 */
export const createPerlinNoise2DIsotropic = (rand: RandFn): NoiseFn2D =>
  createPerlinNoise2DWithGradient(rand, gradient2dIsotropic)

/** A 3D Perlin sampler. Same contract as `createPerlinNoise2D`. */
export const createPerlinNoise3D = (rand: RandFn): NoiseFn3D => {
  const permutation = buildPermutation(rand)
  const at = (index: number): number => permutation[index & PERMUTATION_MASK] ?? 0

  return (x, y, z) => {
    const floorX = Math.floor(x)
    const floorY = Math.floor(y)
    const floorZ = Math.floor(z)
    const cellX = floorX & PERMUTATION_MASK
    const cellY = floorY & PERMUTATION_MASK
    const cellZ = floorZ & PERMUTATION_MASK
    const fracX = x - floorX
    const fracY = y - floorY
    const fracZ = z - floorZ
    const easedX = fade(fracX)
    const easedY = fade(fracY)
    const easedZ = fade(fracZ)

    const a = at(cellX) + cellY
    const aa = at(a) + cellZ
    const ab = at(a + 1) + cellZ
    const b = at(cellX + 1) + cellY
    const ba = at(b) + cellZ
    const bb = at(b + 1) + cellZ

    const value = lerp(
      lerp(
        lerp(gradient3d(at(aa), fracX, fracY, fracZ), gradient3d(at(ba), fracX - 1, fracY, fracZ), easedX),
        lerp(
          gradient3d(at(ab), fracX, fracY - 1, fracZ),
          gradient3d(at(bb), fracX - 1, fracY - 1, fracZ),
          easedX,
        ),
        easedY,
      ),
      lerp(
        lerp(
          gradient3d(at(aa + 1), fracX, fracY, fracZ - 1),
          gradient3d(at(ba + 1), fracX - 1, fracY, fracZ - 1),
          easedX,
        ),
        lerp(
          gradient3d(at(ab + 1), fracX, fracY - 1, fracZ - 1),
          gradient3d(at(bb + 1), fracX - 1, fracY - 1, fracZ - 1),
          easedX,
        ),
        easedY,
      ),
      easedZ,
    )

    return value * AMPLITUDE_SCALE_3D
  }
}
