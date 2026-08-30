import { CHUNK_SIZE_XZ, type ChunkCoord, type ChunkHeight, chunkCoord, ChunkHeight as createChunkHeight } from '@nerima-games/mc-kernel'

import type { NoiseFn2D, NoiseFn3D } from './perlin.js'
import { sampleNoise2DInterpolatedGrid } from './sampling.js'
import { sampleNoise3DGrid } from './sampling-3d.js'

export type NoiseChunkSamplingOptions = Readonly<{
  readonly sampleStride?: number
}>

export type NoiseChunk3DSamplingOptions = Readonly<{
  readonly originY: number
  readonly stepX?: number
  readonly stepY?: number
  readonly stepZ?: number
}>

const DEFAULT_CHUNK_STEP = 1

export const sampleNoise2DChunk = (
  noise: NoiseFn2D,
  chunk: ChunkCoord,
  options: NoiseChunkSamplingOptions = {},
): Float32Array => {
  const validatedChunk = chunkCoord(chunk.cx, chunk.cz)
  const gridOptions = {
    depth: CHUNK_SIZE_XZ,
    originX: validatedChunk.cx * CHUNK_SIZE_XZ,
    originZ: validatedChunk.cz * CHUNK_SIZE_XZ,
    width: CHUNK_SIZE_XZ,
  }

  if (!('sampleStride' in options)) {
    return sampleNoise2DInterpolatedGrid(noise, gridOptions)
  }
  return sampleNoise2DInterpolatedGrid(noise, {
    ...gridOptions,
    sampleStride: options.sampleStride,
  })
}

export const sampleNoise3DChunk = (
  noise: NoiseFn3D,
  chunk: ChunkCoord,
  height: ChunkHeight,
  options: NoiseChunk3DSamplingOptions,
): Float32Array => {
  const validatedChunk = chunkCoord(chunk.cx, chunk.cz)
  const validatedHeight = createChunkHeight(height)

  return sampleNoise3DGrid(noise, {
    depth: CHUNK_SIZE_XZ,
    height: validatedHeight,
    originX: validatedChunk.cx * CHUNK_SIZE_XZ,
    originY: options.originY,
    originZ: validatedChunk.cz * CHUNK_SIZE_XZ,
    stepX: options.stepX ?? DEFAULT_CHUNK_STEP,
    stepY: options.stepY ?? DEFAULT_CHUNK_STEP,
    stepZ: options.stepZ ?? DEFAULT_CHUNK_STEP,
    width: CHUNK_SIZE_XZ,
  })
}
