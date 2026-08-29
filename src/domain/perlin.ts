/**
 * Perlin gradient-noise kernels, 2D and 3D.
 *
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
import {
  AMPLITUDE_SCALE_2D,
  AMPLITUDE_SCALE_3D,
  LATTICE_NEIGHBOR_OFFSET,
  LOOP_STEP,
  PERMUTATION_MASK,
  PERMUTATION_SIZE,
} from './perlin-constants.js'
import { gradient2d, gradient3d } from './perlin-gradients.js'
import type { RandFn } from './seed.js'

export { PERMUTATION_SIZE }

export type NoiseFn2D = (x: number, z: number) => number
export type NoiseFn3D = (x: number, y: number, z: number) => number

/**
 * Build a permutation of [0, 255] by Fisher-Yates over the supplied PRNG.
 *
 * `let` + `for` throughout: this is a state-threading shuffle, and the array
 * `fold` spelling of it would allocate an intermediate array per swap. Same
 * exemption as the octave loop (docs/design-notes.md N-1), for the same reason.
 */
/** Fisher-Yates stops before this index: index 0 has no remaining partner to swap with. */
const SHUFFLE_LOWER_BOUND = 0
/** Converts the loop's 0-based top index into a candidate count for `Math.floor(rand() * count)`. */
const FISHER_YATES_RANGE_OFFSET = 1

export const buildPermutation = (rand: RandFn): Uint8Array => {
  const permutation = new Uint8Array(PERMUTATION_SIZE)
  for (let index = 0; index < PERMUTATION_SIZE; index += LOOP_STEP) {
    permutation[index] = index
  }
  for (let index = PERMUTATION_MASK; index > SHUFFLE_LOWER_BOUND; index -= LOOP_STEP) {
    // `& PERMUTATION_MASK` is redundant for any `rand` honoring its documented [0, 1) contract (RandFn's own doc comment, seed.ts): `swapWith` is already <= index <= PERMUTATION_MASK in that case.
    // Applied anyway so the index is unconditionally in range instead of depending on an unenforced caller contract.
    // That is what lets the two reads below use `!` instead of a fallback that no real `rand` implementation can ever reach.
    const swapWith = Math.floor(rand() * (index + FISHER_YATES_RANGE_OFFSET)) & PERMUTATION_MASK
    const held = permutation[index]!
    permutation[index] = permutation[swapWith]!
    permutation[swapWith] = held
  }
  return permutation
}

/** Ken Perlin's quintic ease curve: 6t^5 - 15t^4 + 10t^3. C2-continuous. */
const FADE_QUINTIC_COEFFICIENT = 6
const FADE_QUARTIC_COEFFICIENT = 15
const FADE_CUBIC_COEFFICIENT = 10
const fade = (t: number): number =>
  t * t * t * (t * (t * FADE_QUINTIC_COEFFICIENT - FADE_QUARTIC_COEFFICIENT) + FADE_CUBIC_COEFFICIENT)

const lerp = (from: number, to: number, t: number): number => from + t * (to - from)

/**
 * A 2D Perlin sampler over a permutation table derived from `rand`.
 *
 * The canonical kernel uses four axis and four normalized diagonal unit
 * gradients. Building the permutation table is O(256); keeping it in the
 * returned closure makes each sample O(1).
 */
export const createPerlinNoise2D = (rand: RandFn): NoiseFn2D => {
  const permutation = buildPermutation(rand)

  return (x, z) => {
    const floorX = Math.floor(x),
      floorZ = Math.floor(z)
    const cellX = floorX & PERMUTATION_MASK,
      cellZ = floorZ & PERMUTATION_MASK
    const fracX = x - floorX,
      fracZ = z - floorZ
    const easedX = fade(fracX),
      easedZ = fade(fracZ)

    const rowA = (permutation[cellX]! + cellZ) & PERMUTATION_MASK
    const rowB = (permutation[(cellX + LATTICE_NEIGHBOR_OFFSET) & PERMUTATION_MASK]! + cellZ) & PERMUTATION_MASK

    const bottom = lerp(
      gradient2d(permutation[rowA]!, fracX, fracZ),
      gradient2d(permutation[rowB]!, fracX - LATTICE_NEIGHBOR_OFFSET, fracZ),
      easedX,
    )
    const top = lerp(
      gradient2d(
        permutation[(rowA + LATTICE_NEIGHBOR_OFFSET) & PERMUTATION_MASK]!,
        fracX,
        fracZ - LATTICE_NEIGHBOR_OFFSET,
      ),
      gradient2d(
        permutation[(rowB + LATTICE_NEIGHBOR_OFFSET) & PERMUTATION_MASK]!,
        fracX - LATTICE_NEIGHBOR_OFFSET,
        fracZ - LATTICE_NEIGHBOR_OFFSET,
      ),
      easedX,
    )

    return lerp(bottom, top, easedZ) * AMPLITUDE_SCALE_2D
  }
}

/** A 3D Perlin sampler. Same contract as `createPerlinNoise2D`. */
export const createPerlinNoise3D = (rand: RandFn): NoiseFn3D => {
  const permutation = buildPermutation(rand)
  const at = (index: number): number => permutation[index & PERMUTATION_MASK]!

  return (x, y, z) => {
    const floorX = Math.floor(x),
      floorY = Math.floor(y),
      floorZ = Math.floor(z)
    const cellX = floorX & PERMUTATION_MASK,
      cellY = floorY & PERMUTATION_MASK,
      cellZ = floorZ & PERMUTATION_MASK
    const fracX = x - floorX,
      fracY = y - floorY,
      fracZ = z - floorZ
    const easedX = fade(fracX),
      easedY = fade(fracY),
      easedZ = fade(fracZ)

    const a = at(cellX) + cellY,
      b = at(cellX + LATTICE_NEIGHBOR_OFFSET) + cellY
    const aa = at(a) + cellZ,
      ab = at(a + LATTICE_NEIGHBOR_OFFSET) + cellZ,
      ba = at(b) + cellZ,
      bb = at(b + LATTICE_NEIGHBOR_OFFSET) + cellZ

    const value = lerp(
      lerp(
        lerp(
          gradient3d(at(aa), fracX, fracY, fracZ),
          gradient3d(at(ba), fracX - LATTICE_NEIGHBOR_OFFSET, fracY, fracZ),
          easedX,
        ),
        lerp(
          gradient3d(at(ab), fracX, fracY - LATTICE_NEIGHBOR_OFFSET, fracZ),
          gradient3d(at(bb), fracX - LATTICE_NEIGHBOR_OFFSET, fracY - LATTICE_NEIGHBOR_OFFSET, fracZ),
          easedX,
        ),
        easedY,
      ),
      lerp(
        lerp(
          gradient3d(at(aa + LATTICE_NEIGHBOR_OFFSET), fracX, fracY, fracZ - LATTICE_NEIGHBOR_OFFSET),
          gradient3d(
            at(ba + LATTICE_NEIGHBOR_OFFSET),
            fracX - LATTICE_NEIGHBOR_OFFSET,
            fracY,
            fracZ - LATTICE_NEIGHBOR_OFFSET,
          ),
          easedX,
        ),
        lerp(
          gradient3d(
            at(ab + LATTICE_NEIGHBOR_OFFSET),
            fracX,
            fracY - LATTICE_NEIGHBOR_OFFSET,
            fracZ - LATTICE_NEIGHBOR_OFFSET,
          ),
          gradient3d(
            at(bb + LATTICE_NEIGHBOR_OFFSET),
            fracX - LATTICE_NEIGHBOR_OFFSET,
            fracY - LATTICE_NEIGHBOR_OFFSET,
            fracZ - LATTICE_NEIGHBOR_OFFSET,
          ),
          easedX,
        ),
        easedY,
      ),
      easedZ,
    )

    return value * AMPLITUDE_SCALE_3D
  }
}
