import {
  SIMPLEX_GRADIENT_MASK,
  SIMPLEX_NEGATIVE_ONE,
  SIMPLEX_ONE,
  SIMPLEX_PERMUTATION_MASK,
  SIMPLEX_X_INDEX,
  SIMPLEX_Y_INDEX,
  SIMPLEX_ZERO,
  SIMPLEX_Z_INDEX,
} from './simplex-constants.js'
import type { SimplexPoint2D, SimplexPoint3D } from './simplex-points.js'
import { requireDefined } from './defined.js'

const GRADIENTS = [
  [SIMPLEX_ONE, SIMPLEX_ONE, SIMPLEX_ZERO],
  [SIMPLEX_NEGATIVE_ONE, SIMPLEX_ONE, SIMPLEX_ZERO],
  [SIMPLEX_ONE, SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO],
  [SIMPLEX_NEGATIVE_ONE, SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO],
  [SIMPLEX_ONE, SIMPLEX_ZERO, SIMPLEX_ONE],
  [SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO, SIMPLEX_ONE],
  [SIMPLEX_ONE, SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE],
  [SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE],
  [SIMPLEX_ZERO, SIMPLEX_ONE, SIMPLEX_ONE],
  [SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE, SIMPLEX_ONE],
  [SIMPLEX_ZERO, SIMPLEX_ONE, SIMPLEX_NEGATIVE_ONE],
  [SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE, SIMPLEX_NEGATIVE_ONE],
  [SIMPLEX_ONE, SIMPLEX_ONE, SIMPLEX_ZERO],
  [SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE, SIMPLEX_ONE],
  [SIMPLEX_NEGATIVE_ONE, SIMPLEX_ONE, SIMPLEX_ZERO],
  [SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE, SIMPLEX_NEGATIVE_ONE],
] as const

const mapPermutation = (permutation: Uint8Array, value: number): number =>
  requireDefined(permutation[value & SIMPLEX_PERMUTATION_MASK], 'permutation value')

const hash2 = (permutation: Uint8Array, point: SimplexPoint2D): number =>
  mapPermutation(permutation, point.x + mapPermutation(permutation, point.z))

const hash3 = (permutation: Uint8Array, point: SimplexPoint3D): number =>
  mapPermutation(
    permutation,
    point.x + mapPermutation(permutation, point.y + mapPermutation(permutation, point.z)),
  )

export const gradient2 = (
  permutation: Uint8Array,
  lattice: SimplexPoint2D,
  local: SimplexPoint2D,
): number => {
  const gradient = requireDefined(GRADIENTS[hash2(permutation, lattice) & SIMPLEX_GRADIENT_MASK], 'simplex gradient')
  return requireDefined(gradient[SIMPLEX_X_INDEX], 'gradient component') * local.x + requireDefined(gradient[SIMPLEX_Z_INDEX], 'gradient component') * local.z
}

export const gradient3 = (
  permutation: Uint8Array,
  lattice: SimplexPoint3D,
  local: SimplexPoint3D,
): number => {
  const gradient = requireDefined(GRADIENTS[hash3(permutation, lattice) & SIMPLEX_GRADIENT_MASK], 'simplex gradient')
  return (
    requireDefined(gradient[SIMPLEX_X_INDEX], 'gradient component') * local.x +
    requireDefined(gradient[SIMPLEX_Y_INDEX], 'gradient component') * local.y +
    requireDefined(gradient[SIMPLEX_Z_INDEX], 'gradient component') * local.z
  )
}
