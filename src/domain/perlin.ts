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

/** A power-of-two size, less this, is the bitmask covering every valid 0-based index. */
const SIZE_TO_MASK_OFFSET = 1
const PERMUTATION_MASK = PERMUTATION_SIZE - SIZE_TO_MASK_OFFSET

/** 2D unit gradients have magnitude 1; the noise maximum is 1/sqrt(2). */
const AMPLITUDE_SCALE_2D = Math.SQRT2

/** Diagonal components for the isotropic 8-direction kernel. */
const INVERSE_SQRT2 = Math.SQRT1_2

/** 3D maximum is 1/sqrt(3) under the same argument. */
const DIMENSIONS_3D = 3
const AMPLITUDE_SCALE_3D = Math.sqrt(DIMENSIONS_3D)

/** How far a loop counter advances (or retreats) per iteration, everywhere in this file. */
const LOOP_STEP = 1
/** Value substituted for an out-of-bounds permutation-table read. Never actually reached: every index is pre-masked to `PERMUTATION_MASK`, but `Uint8Array` indexing is typed `number | undefined`. */
const FALLBACK_PERMUTATION_ENTRY = 0
/** Offset to the opposite lattice corner along one axis — this file's single most repeated magic number. */
const LATTICE_NEIGHBOR_OFFSET = 1

export type NoiseFn2D = (x: number, z: number) => number
export type NoiseFn3D = (x: number, y: number, z: number) => number

/**
 * Build a permutation of [0, 255] by Fisher-Yates over the supplied PRNG.
 *
 * `let` + `for` throughout: this is a state-threading shuffle, and the array
 * `fold` spelling of it would allocate an intermediate array per swap. Same
 * exemption as the octave loop (plan.md §5.2), for the same reason.
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
    const swapWith = Math.floor(rand() * (index + FISHER_YATES_RANGE_OFFSET))
    const held = permutation[index] ?? FALLBACK_PERMUTATION_ENTRY
    permutation[index] = permutation[swapWith] ?? FALLBACK_PERMUTATION_ENTRY
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

/** `gradient2d` selects one of 4 diagonal gradients from the hash's low 2 bits. */
const GRADIENT_2D_MASK = 3
const GRADIENT_2D_CASE_POSITIVE_POSITIVE = 0
const GRADIENT_2D_CASE_NEGATIVE_POSITIVE = 1
const GRADIENT_2D_CASE_POSITIVE_NEGATIVE = 2
// Case 3 (negative-negative) is the switch's default.

/** 2D gradient dot product, selected by the low bits of the hash. */
const gradient2d = (hash: number, x: number, z: number): number => {
  switch (hash & GRADIENT_2D_MASK) {
    case GRADIENT_2D_CASE_POSITIVE_POSITIVE:
      return x + z
    case GRADIENT_2D_CASE_NEGATIVE_POSITIVE:
      return -x + z
    case GRADIENT_2D_CASE_POSITIVE_NEGATIVE:
      return x - z
    default:
      return -x - z
  }
}

/** `gradient2dIsotropic` selects one of 8 unit gradients from the hash's low 3 bits. */
const GRADIENT_ISOTROPIC_MASK = 7
const GRADIENT_AXIS_POSITIVE_X = 0
const GRADIENT_AXIS_NEGATIVE_X = 1
const GRADIENT_AXIS_POSITIVE_Z = 2
const GRADIENT_AXIS_NEGATIVE_Z = 3
const GRADIENT_DIAGONAL_POSITIVE_POSITIVE = 4
const GRADIENT_DIAGONAL_NEGATIVE_POSITIVE = 5
const GRADIENT_DIAGONAL_POSITIVE_NEGATIVE = 6
// Case 7 (negative-negative diagonal) is the switch's default.

/** Unit-length axis and diagonal gradients, selected uniformly by three hash bits. */
const gradient2dIsotropic = (hash: number, x: number, z: number): number => {
  switch (hash & GRADIENT_ISOTROPIC_MASK) {
    case GRADIENT_AXIS_POSITIVE_X:
      return x
    case GRADIENT_AXIS_NEGATIVE_X:
      return -x
    case GRADIENT_AXIS_POSITIVE_Z:
      return z
    case GRADIENT_AXIS_NEGATIVE_Z:
      return -z
    case GRADIENT_DIAGONAL_POSITIVE_POSITIVE:
      return (x + z) * INVERSE_SQRT2
    case GRADIENT_DIAGONAL_NEGATIVE_POSITIVE:
      return (-x + z) * INVERSE_SQRT2
    case GRADIENT_DIAGONAL_POSITIVE_NEGATIVE:
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
    const floorX = Math.floor(x),
      floorZ = Math.floor(z)
    const cellX = floorX & PERMUTATION_MASK,
      cellZ = floorZ & PERMUTATION_MASK
    const fracX = x - floorX,
      fracZ = z - floorZ
    const easedX = fade(fracX),
      easedZ = fade(fracZ)

    const rowA = ((permutation[cellX] ?? FALLBACK_PERMUTATION_ENTRY) + cellZ) & PERMUTATION_MASK
    const rowB =
      ((permutation[(cellX + LATTICE_NEIGHBOR_OFFSET) & PERMUTATION_MASK] ?? FALLBACK_PERMUTATION_ENTRY) + cellZ) &
      PERMUTATION_MASK

    const bottom = lerp(
      gradient(permutation[rowA] ?? FALLBACK_PERMUTATION_ENTRY, fracX, fracZ),
      gradient(permutation[rowB] ?? FALLBACK_PERMUTATION_ENTRY, fracX - LATTICE_NEIGHBOR_OFFSET, fracZ),
      easedX,
    )
    const top = lerp(
      gradient(
        permutation[(rowA + LATTICE_NEIGHBOR_OFFSET) & PERMUTATION_MASK] ?? FALLBACK_PERMUTATION_ENTRY,
        fracX,
        fracZ - LATTICE_NEIGHBOR_OFFSET,
      ),
      gradient(
        permutation[(rowB + LATTICE_NEIGHBOR_OFFSET) & PERMUTATION_MASK] ?? FALLBACK_PERMUTATION_ENTRY,
        fracX - LATTICE_NEIGHBOR_OFFSET,
        fracZ - LATTICE_NEIGHBOR_OFFSET,
      ),
      easedX,
    )

    return lerp(bottom, top, easedZ) * AMPLITUDE_SCALE_2D
  }
}

/** `gradient3d`'s hash decomposition: 4 bits select among the 12 edge-midpoint vectors of a cube. */
const GRADIENT_3D_MASK = 15
/** Below this, `u` takes the x axis; at or above it, `u` takes the y axis. */
const GRADIENT_3D_U_SPLIT = 8
/** Below this, `v` takes the y axis; the two named exceptions above it take x instead of the default z. */
const GRADIENT_3D_V_SPLIT = 4
const GRADIENT_3D_V_EXCEPTION_A = 12
const GRADIENT_3D_V_EXCEPTION_B = 14
/** Low bit of `h` selects the sign combination; the next bit selects the magnitude combination. */
const GRADIENT_3D_SIGN_BIT = 1
const GRADIENT_3D_MAGNITUDE_BIT = 2
/** The value an AND-masked bit takes when it is not set. */
const BIT_UNSET = 0

const selectGradient3DU = (h: number, x: number, y: number): number => {
  if (h < GRADIENT_3D_U_SPLIT) {
    return x
  }
  return y
}

const selectGradient3DV = (h: number, x: number, y: number, z: number): number => {
  if (h < GRADIENT_3D_V_SPLIT) {
    return y
  }
  if (h === GRADIENT_3D_V_EXCEPTION_A || h === GRADIENT_3D_V_EXCEPTION_B) {
    return x
  }
  return z
}

/** 3D gradient dot product over the 12 edge-midpoint vectors of a cube. */
const gradient3d = (hash: number, x: number, y: number, z: number): number => {
  const h = hash & GRADIENT_3D_MASK
  const u = selectGradient3DU(h, x, y)
  const v = selectGradient3DV(h, x, y, z)

  if ((h & GRADIENT_3D_SIGN_BIT) === BIT_UNSET) {
    return u + v
  }
  if ((h & GRADIENT_3D_MAGNITUDE_BIT) !== BIT_UNSET) {
    return -u - v
  }
  return u - v
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
export const createPerlinNoise2D = (rand: RandFn): NoiseFn2D =>
  createPerlinNoise2DWithGradient(rand, gradient2d)

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
  const at = (index: number): number => permutation[index & PERMUTATION_MASK] ?? FALLBACK_PERMUTATION_ENTRY

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
