import { INVERSE_SQRT2 } from './perlin-constants.js'

/** The canonical 2D kernel selects one of 8 unit gradients from the hash's low 3 bits. */
const GRADIENT_2D_MASK = 7
const GRADIENT_AXIS_POSITIVE_X = 0
const GRADIENT_AXIS_NEGATIVE_X = 1
const GRADIENT_AXIS_POSITIVE_Z = 2
const GRADIENT_AXIS_NEGATIVE_Z = 3
const GRADIENT_DIAGONAL_POSITIVE_POSITIVE = 4
const GRADIENT_DIAGONAL_NEGATIVE_POSITIVE = 5
const GRADIENT_DIAGONAL_POSITIVE_NEGATIVE = 6

/** Unit-length axis and diagonal gradients, selected uniformly by three hash bits. */
const gradient2d = (hash: number, x: number, z: number): number => {
  switch (hash & GRADIENT_2D_MASK) {
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
const HASH_X_PLUS_Y_A = 0
const HASH_X_PLUS_Y_B = 2
const HASH_X_MINUS_Y = 1
const HASH_NEGATIVE_X_MINUS_Y = 3
const HASH_X_PLUS_Z_A = 4
const HASH_X_PLUS_Z_B = 6
const HASH_X_MINUS_Z = 5
const HASH_NEGATIVE_X_MINUS_Z = 7
const HASH_Y_PLUS_Z_A = 8
const HASH_Y_PLUS_Z_B = 10
const HASH_Y_MINUS_Z_A = 9
const HASH_Y_MINUS_Z_B = 13
const HASH_Y_PLUS_X_A = 12
const HASH_Y_PLUS_X_B = 14

/** 3D gradient dot product over the 12 edge-midpoint vectors of a cube. */
const gradient3d = (hash: number, x: number, y: number, z: number): number => {
  // Keep the historical sign choices and operand order, including signed zero.
  switch (hash & GRADIENT_3D_MASK) {
    case HASH_X_PLUS_Y_A:
    case HASH_X_PLUS_Y_B:
      return x + y
    case HASH_X_MINUS_Y:
      return x - y
    case HASH_NEGATIVE_X_MINUS_Y:
      return -x - y
    case HASH_X_PLUS_Z_A:
    case HASH_X_PLUS_Z_B:
      return x + z
    case HASH_X_MINUS_Z:
      return x - z
    case HASH_NEGATIVE_X_MINUS_Z:
      return -x - z
    case HASH_Y_PLUS_Z_A:
    case HASH_Y_PLUS_Z_B:
      return y + z
    case HASH_Y_MINUS_Z_A:
    case HASH_Y_MINUS_Z_B:
      return y - z
    case HASH_Y_PLUS_X_A:
    case HASH_Y_PLUS_X_B:
      return y + x
    default:
      return -y - z
  }
}

export { gradient2d, gradient3d }
