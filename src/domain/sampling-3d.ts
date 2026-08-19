import {
  GRID_LOOP_STEP,
  type NoiseGrid3DOptions,
  normalizeNoiseGrid3DOptions,
} from './sampling-3d-grid.js'
import type { NoiseFn3D } from './perlin.js'
import { requireFinite } from './number-validation.js'

export type { NoiseGrid3DOptions } from './sampling-3d-grid.js'
export type { NoiseInterpolatedGrid3DOptions } from './sampling-3d-interpolation.js'
export { sampleNoise3DInterpolatedGrid } from './sampling-3d-interpolation.js'

export type NoisePoint3D = Readonly<{
  readonly x: number
  readonly y: number
  readonly z: number
}>

/**
 * Samples arbitrary 3D positions in caller-provided order.
 */
export const sampleNoise3DBatch = (
  noise: NoiseFn3D,
  points: ReadonlyArray<NoisePoint3D>,
): Float32Array => {
  const samples = new Float32Array(points.length)
  for (let index = 0; index < points.length; index += GRID_LOOP_STEP) {
    const point = points[index]
    if (!point) {
      throw new RangeError(`points[${index}] is missing`)
    }
    samples[index] = noise(
      requireFinite('point.x', point.x),
      requireFinite('point.y', point.y),
      requireFinite('point.z', point.z),
    )
  }
  return samples
}

/**
 * Samples a volume flattened x-major, z-major, y-minor. This matches the
 * storage order used by mc-kernel's chunk columns, so a sampled volume can be
 * handed to a world-generation adapter without reordering its values.
 */
export const sampleNoise3DGrid = (noise: NoiseFn3D, options: NoiseGrid3DOptions): Float32Array => {
  const { depth, height, originX, originY, originZ, stepX, stepY, stepZ, width } = normalizeNoiseGrid3DOptions(options)
  const samples = new Float32Array(width * depth * height)

  for (let xIndex = 0; xIndex < width; xIndex += GRID_LOOP_STEP) {
    const x = originX + xIndex * stepX
    for (let zIndex = 0; zIndex < depth; zIndex += GRID_LOOP_STEP) {
      const z = originZ + zIndex * stepZ
      for (let yIndex = 0; yIndex < height; yIndex += GRID_LOOP_STEP) {
        const y = originY + yIndex * stepY
        samples[(xIndex * depth + zIndex) * height + yIndex] = noise(x, y, z)
      }
    }
  }
  return samples
}
