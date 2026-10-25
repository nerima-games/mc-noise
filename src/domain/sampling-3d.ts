import {
  GRID_LOOP_STEP,
  type NoiseGrid3DOptions,
  type NormalizedNoiseGrid3DOptions,
  normalizeNoiseGrid3DOptions,
} from './sampling-3d-grid.js'
import type { NoiseFn3D } from './perlin.js'
import { Result } from 'effect'
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
): Result.Result<Float32Array, RangeError> =>
  Result.gen(function* sampleNoise3DBatchResult() {
    const samples = new Float32Array(points.length)
    for (let index = 0; index < points.length; index += GRID_LOOP_STEP) {
      const point = points[index]
      if (!point) {
        return yield* Result.fail(new RangeError(`points[${index}] is missing`))
      }
      const x = yield* requireFinite(point.x, () => `point.x must be finite, received ${point.x}`)
      const y = yield* requireFinite(point.y, () => `point.y must be finite, received ${point.y}`)
      const z = yield* requireFinite(point.z, () => `point.z must be finite, received ${point.z}`)
      samples[index] = noise(x, y, z)
    }
    return samples
  })

type GridSamplingContext = Readonly<{
  readonly noise: NoiseFn3D
  readonly options: NormalizedNoiseGrid3DOptions
  readonly samples: Float32Array
}>

const sampleGridRow = (
  context: GridSamplingContext,
  xIndex: number,
  zIndex: number,
): void => {
  const x = context.options.originX + xIndex * context.options.stepX
  const z = context.options.originZ + zIndex * context.options.stepZ
  for (let yIndex = 0; yIndex < context.options.height; yIndex += GRID_LOOP_STEP) {
    const y = context.options.originY + yIndex * context.options.stepY
    context.samples[(xIndex * context.options.depth + zIndex) * context.options.height + yIndex] =
      context.noise(x, y, z)
  }
}

const sampleGrid = (
  noise: NoiseFn3D,
  options: NormalizedNoiseGrid3DOptions,
): Float32Array => {
  const samples = new Float32Array(options.width * options.depth * options.height)
  const context = { noise, options, samples }
  for (let xIndex = 0; xIndex < options.width; xIndex += GRID_LOOP_STEP) {
    for (let zIndex = 0; zIndex < options.depth; zIndex += GRID_LOOP_STEP) {
      sampleGridRow(context, xIndex, zIndex)
    }
  }
  return samples
}

/**
 * Samples a volume flattened x-major, z-major, y-minor. This matches the
 * storage order used by mc-kernel's chunk columns, so values need no reordering.
 */
export const sampleNoise3DGrid = (
  noise: NoiseFn3D,
  options: NoiseGrid3DOptions,
): Result.Result<Float32Array, RangeError> =>
  Result.map(normalizeNoiseGrid3DOptions(options), (normalized) => sampleGrid(noise, normalized))
