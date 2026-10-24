import {
  SIMPLEX_GRADIENT_MASK,
  SIMPLEX_NEGATIVE_ONE,
  SIMPLEX_ONE,
  SIMPLEX_PERMUTATION_MASK,
  SIMPLEX_THREE,
  SIMPLEX_X_INDEX,
  SIMPLEX_Y_INDEX,
  SIMPLEX_ZERO,
  SIMPLEX_Z_INDEX,
} from './simplex-constants.js'
import type { SimplexPoint2D, SimplexPoint3D } from './simplex-points.js'

const GRADIENTS = new Int8Array([
  SIMPLEX_ONE, SIMPLEX_ONE, SIMPLEX_ZERO,
  SIMPLEX_NEGATIVE_ONE, SIMPLEX_ONE, SIMPLEX_ZERO,
  SIMPLEX_ONE, SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO,
  SIMPLEX_NEGATIVE_ONE, SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO,
  SIMPLEX_ONE, SIMPLEX_ZERO, SIMPLEX_ONE,
  SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO, SIMPLEX_ONE,
  SIMPLEX_ONE, SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE,
  SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE,
  SIMPLEX_ZERO, SIMPLEX_ONE, SIMPLEX_ONE,
  SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE, SIMPLEX_ONE,
  SIMPLEX_ZERO, SIMPLEX_ONE, SIMPLEX_NEGATIVE_ONE,
  SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE, SIMPLEX_NEGATIVE_ONE,
  SIMPLEX_ONE, SIMPLEX_ONE, SIMPLEX_ZERO,
  SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE, SIMPLEX_ONE,
  SIMPLEX_NEGATIVE_ONE, SIMPLEX_ONE, SIMPLEX_ZERO,
  SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE, SIMPLEX_NEGATIVE_ONE,
])
const GRADIENTS_VIEW = new DataView(GRADIENTS.buffer, GRADIENTS.byteOffset, GRADIENTS.byteLength)

const mapPermutation = (permutation: DataView, value: number): number =>
  permutation.getUint8(value & SIMPLEX_PERMUTATION_MASK)

const hash2 = (permutation: DataView, point: SimplexPoint2D): number =>
  mapPermutation(permutation, point.x + mapPermutation(permutation, point.z))

const hash3 = (permutation: DataView, point: SimplexPoint3D): number =>
  mapPermutation(
    permutation,
    point.x + mapPermutation(permutation, point.y + mapPermutation(permutation, point.z)),
  )

const gradient2 = (
  permutation: DataView,
  lattice: SimplexPoint2D,
  local: SimplexPoint2D,
): number => {
  const gradientIndex = (hash2(permutation, lattice) & SIMPLEX_GRADIENT_MASK) * SIMPLEX_THREE
  return (
    GRADIENTS_VIEW.getInt8(gradientIndex + SIMPLEX_X_INDEX) * local.x +
    GRADIENTS_VIEW.getInt8(gradientIndex + SIMPLEX_Z_INDEX) * local.z
  )
}

const gradient3 = (
  permutation: DataView,
  lattice: SimplexPoint3D,
  local: SimplexPoint3D,
): number => {
  const gradientIndex = (hash3(permutation, lattice) & SIMPLEX_GRADIENT_MASK) * SIMPLEX_THREE
  return (
    GRADIENTS_VIEW.getInt8(gradientIndex + SIMPLEX_X_INDEX) * local.x +
    GRADIENTS_VIEW.getInt8(gradientIndex + SIMPLEX_Y_INDEX) * local.y +
    GRADIENTS_VIEW.getInt8(gradientIndex + SIMPLEX_Z_INDEX) * local.z
  )
}

export { gradient2, gradient3 }
