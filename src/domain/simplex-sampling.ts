import {
  SIMPLEX_CONTRIBUTION_POWER,
  SIMPLEX_FOUR,
  SIMPLEX_ONE,
  SIMPLEX_RADIUS_2D,
  SIMPLEX_RADIUS_3D,
  SIMPLEX_RANK_MASK,
  SIMPLEX_SCALE_2D,
  SIMPLEX_SCALE_3D,
  SIMPLEX_SKEW_2D,
  SIMPLEX_SKEW_3D,
  SIMPLEX_THREE_UNSKEW_3D,
  SIMPLEX_TWO,
  SIMPLEX_TWO_UNSKEW_2D,
  SIMPLEX_TWO_UNSKEW_3D,
  SIMPLEX_UNSKEW_2D,
  SIMPLEX_UNSKEW_3D,
  SIMPLEX_ZERO,
} from './simplex-constants.js'
import type {
  SimplexCell2D,
  SimplexCell3D,
  SimplexCorner2D,
  SimplexCorner3D,
  SimplexCorners2D,
  SimplexCorners3D,
  SimplexOffset2D,
  SimplexOffset3D,
  SimplexPoint2D,
  SimplexPoint3D,
} from './simplex-points.js'
import { gradient2, gradient3 } from './simplex-gradients.js'

const ZERO_OFFSET_2D: SimplexPoint2D = { x: SIMPLEX_ZERO, z: SIMPLEX_ZERO }
const ZERO_OFFSET_3D: SimplexPoint3D = {
  x: SIMPLEX_ZERO,
  y: SIMPLEX_ZERO,
  z: SIMPLEX_ZERO,
}
const UNIT_OFFSET_3D: SimplexPoint3D = {
  x: SIMPLEX_ONE,
  y: SIMPLEX_ONE,
  z: SIMPLEX_ONE,
}

const THREE_D_OFFSETS: ReadonlyArray<SimplexOffset3D> = [
  {
    first: { x: SIMPLEX_ZERO, y: SIMPLEX_ZERO, z: SIMPLEX_ONE },
    second: { x: SIMPLEX_ZERO, y: SIMPLEX_ONE, z: SIMPLEX_ONE },
  },
  {
    first: { x: SIMPLEX_ZERO, y: SIMPLEX_ZERO, z: SIMPLEX_ONE },
    second: { x: SIMPLEX_ONE, y: SIMPLEX_ZERO, z: SIMPLEX_ONE },
  },
  {
    first: { x: SIMPLEX_ZERO, y: SIMPLEX_ZERO, z: SIMPLEX_ONE },
    second: { x: SIMPLEX_ONE, y: SIMPLEX_ZERO, z: SIMPLEX_ONE },
  },
  {
    first: { x: SIMPLEX_ONE, y: SIMPLEX_ZERO, z: SIMPLEX_ZERO },
    second: { x: SIMPLEX_ONE, y: SIMPLEX_ZERO, z: SIMPLEX_ONE },
  },
  {
    first: { x: SIMPLEX_ZERO, y: SIMPLEX_ONE, z: SIMPLEX_ZERO },
    second: { x: SIMPLEX_ZERO, y: SIMPLEX_ONE, z: SIMPLEX_ONE },
  },
  {
    first: { x: SIMPLEX_ZERO, y: SIMPLEX_ZERO, z: SIMPLEX_ONE },
    second: { x: SIMPLEX_ZERO, y: SIMPLEX_ONE, z: SIMPLEX_ONE },
  },
  {
    first: { x: SIMPLEX_ZERO, y: SIMPLEX_ONE, z: SIMPLEX_ZERO },
    second: { x: SIMPLEX_ONE, y: SIMPLEX_ONE, z: SIMPLEX_ZERO },
  },
  {
    first: { x: SIMPLEX_ONE, y: SIMPLEX_ZERO, z: SIMPLEX_ZERO },
    second: { x: SIMPLEX_ONE, y: SIMPLEX_ONE, z: SIMPLEX_ZERO },
  },
] as const

const createCell2D = (point: SimplexPoint2D): SimplexCell2D => {
  const skew = (point.x + point.z) * SIMPLEX_SKEW_2D
  const cellX = Math.floor(point.x + skew)
  const cellZ = Math.floor(point.z + skew)
  const unskew = (cellX + cellZ) * SIMPLEX_UNSKEW_2D
  return {
    cell: { x: cellX, z: cellZ },
    local: {
      x: point.x - (cellX - unskew),
      z: point.z - (cellZ - unskew),
    },
  }
}

const createCell3D = (point: SimplexPoint3D): SimplexCell3D => {
  const skew = (point.x + point.y + point.z) * SIMPLEX_SKEW_3D
  const cellX = Math.floor(point.x + skew)
  const cellY = Math.floor(point.y + skew)
  const cellZ = Math.floor(point.z + skew)
  const unskew = (cellX + cellY + cellZ) * SIMPLEX_UNSKEW_3D
  return {
    cell: { x: cellX, y: cellY, z: cellZ },
    local: {
      x: point.x - (cellX - unskew),
      y: point.y - (cellY - unskew),
      z: point.z - (cellZ - unskew),
    },
  }
}

const selectOffsets2D = (local: SimplexPoint2D): SimplexOffset2D => {
  if (local.x > local.z) {
    return {
      first: { x: SIMPLEX_ONE, z: SIMPLEX_ZERO },
      second: { x: SIMPLEX_ONE, z: SIMPLEX_ONE },
    }
  }
  return {
    first: { x: SIMPLEX_ZERO, z: SIMPLEX_ONE },
    second: { x: SIMPLEX_ONE, z: SIMPLEX_ONE },
  }
}

const selectOffsets3D = (local: SimplexPoint3D): SimplexOffset3D => {
  let rank = SIMPLEX_ZERO
  if (local.x > local.y) {
    rank |= SIMPLEX_ONE
  }
  if (local.x > local.z) {
    rank |= SIMPLEX_TWO
  }
  if (local.y > local.z) {
    rank |= SIMPLEX_FOUR
  }
  return THREE_D_OFFSETS[rank & SIMPLEX_RANK_MASK]!
}

const createCorner2D = (
  local: SimplexPoint2D,
  latticeOffset: SimplexPoint2D,
  cell: SimplexPoint2D,
  unskew: number,
): SimplexCorner2D => {
  const lattice = {
    x: cell.x + latticeOffset.x,
    z: cell.z + latticeOffset.z,
  }
  return {
    lattice,
    local: {
      x: local.x - latticeOffset.x + unskew,
      z: local.z - latticeOffset.z + unskew,
    },
  }
}

const createCorner3D = (
  local: SimplexPoint3D,
  latticeOffset: SimplexPoint3D,
  cell: SimplexPoint3D,
  unskew: number,
): SimplexCorner3D => {
  const lattice = {
    x: cell.x + latticeOffset.x,
    y: cell.y + latticeOffset.y,
    z: cell.z + latticeOffset.z,
  }
  return {
    lattice,
    local: {
      x: local.x - latticeOffset.x + unskew,
      y: local.y - latticeOffset.y + unskew,
      z: local.z - latticeOffset.z + unskew,
    },
  }
}

const createCorners2D = (cell: SimplexCell2D, offsets: SimplexOffset2D): SimplexCorners2D => ({
  base: createCorner2D(cell.local, ZERO_OFFSET_2D, cell.cell, SIMPLEX_ZERO),
  first: createCorner2D(cell.local, offsets.first, cell.cell, SIMPLEX_UNSKEW_2D),
  second: createCorner2D(cell.local, offsets.second, cell.cell, SIMPLEX_TWO_UNSKEW_2D),
})

const createCorners3D = (cell: SimplexCell3D, offsets: SimplexOffset3D): SimplexCorners3D => ({
  base: createCorner3D(cell.local, ZERO_OFFSET_3D, cell.cell, SIMPLEX_ZERO),
  first: createCorner3D(cell.local, offsets.first, cell.cell, SIMPLEX_UNSKEW_3D),
  second: createCorner3D(cell.local, offsets.second, cell.cell, SIMPLEX_TWO_UNSKEW_3D),
  third: createCorner3D(cell.local, UNIT_OFFSET_3D, cell.cell, SIMPLEX_THREE_UNSKEW_3D),
})

const contribution2 = (permutation: Uint8Array, corner: SimplexCorner2D): number => {
  const distance = SIMPLEX_RADIUS_2D - corner.local.x ** SIMPLEX_TWO - corner.local.z ** SIMPLEX_TWO
  if (distance < SIMPLEX_ZERO) {
    return SIMPLEX_ZERO
  }
  return distance ** SIMPLEX_CONTRIBUTION_POWER * gradient2(permutation, corner.lattice, corner.local)
}

const contribution3 = (permutation: Uint8Array, corner: SimplexCorner3D): number => {
  const distance =
    SIMPLEX_RADIUS_3D - corner.local.x ** SIMPLEX_TWO - corner.local.y ** SIMPLEX_TWO - corner.local.z ** SIMPLEX_TWO
  if (distance < SIMPLEX_ZERO) {
    return SIMPLEX_ZERO
  }
  return distance ** SIMPLEX_CONTRIBUTION_POWER * gradient3(permutation, corner.lattice, corner.local)
}

export const sampleSimplex2D = (permutation: Uint8Array, point: SimplexPoint2D): number => {
  const cell = createCell2D(point)
  const corners = createCorners2D(cell, selectOffsets2D(cell.local))
  return SIMPLEX_SCALE_2D *
    (contribution2(permutation, corners.base) +
      contribution2(permutation, corners.first) +
      contribution2(permutation, corners.second))
}

export const sampleSimplex3D = (permutation: Uint8Array, point: SimplexPoint3D): number => {
  const cell = createCell3D(point)
  const corners = createCorners3D(cell, selectOffsets3D(cell.local))
  return SIMPLEX_SCALE_3D *
    (contribution3(permutation, corners.base) +
      contribution3(permutation, corners.first) +
      contribution3(permutation, corners.second) +
      contribution3(permutation, corners.third))
}
