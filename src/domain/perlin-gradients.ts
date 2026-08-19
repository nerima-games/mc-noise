import { INVERSE_SQRT2 } from './perlin-constants.js'

/** `gradient2d` selects one of 4 diagonal gradients from the hash's low 2 bits. */
const GRADIENT_2D_MASK = 3
const GRADIENT_2D_CASE_POSITIVE_POSITIVE = 0
const GRADIENT_2D_CASE_NEGATIVE_POSITIVE = 1
const GRADIENT_2D_CASE_POSITIVE_NEGATIVE = 2

/** 2D gradient dot product, selected by the low bits of the hash. */
export const gradient2d = (hash: number, x: number, z: number): number => {
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

/** Unit-length axis and diagonal gradients, selected uniformly by three hash bits. */
export const gradient2dIsotropic = (hash: number, x: number, z: number): number => {
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
export const gradient3d = (hash: number, x: number, y: number, z: number): number => {
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
