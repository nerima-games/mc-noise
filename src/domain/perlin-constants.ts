const UNIT_DIMENSION = 1
const THREE_DIMENSIONS = 3

/** Size of the permutation table. A power of two so the wrap is a mask. */
export const PERMUTATION_SIZE = 256

/** A power-of-two size, less this, is the bitmask covering every valid 0-based index. */
export const PERMUTATION_MASK: number = PERMUTATION_SIZE - UNIT_DIMENSION

/** 2D unit gradients have magnitude 1; the noise maximum is 1/sqrt(2). */
export const AMPLITUDE_SCALE_2D: number = Math.SQRT2

/** Diagonal components used by the canonical 8-direction 2D kernel. */
export const INVERSE_SQRT2: number = Math.SQRT1_2

/** 3D maximum is 1/sqrt(3) under the same argument. */
export const AMPLITUDE_SCALE_3D: number = Math.sqrt(THREE_DIMENSIONS)

/** Offset to the opposite lattice corner along one axis. */
export const LATTICE_NEIGHBOR_OFFSET: number = UNIT_DIMENSION

/** Increment for stateful loops over permutation indices. */
export const LOOP_STEP: number = UNIT_DIMENSION
