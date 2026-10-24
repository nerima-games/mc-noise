import {
  ChunkAxis,
  type ChunkCoord,
  PositionAxis,
  type PositionAxis as PositionAxisValue,
} from '@nerima-games/mc-kernel/domain/coordinates'
import {
  GridDimension,
  GridStep,
  type SampleStride,
  sampleNoise2DInterpolatedGrid,
} from './sampling.js'
import type { NoiseFn2D, NoiseFn3D } from './perlin.js'
import { CHUNK_SIZE_XZ } from '@nerima-games/mc-kernel'
import { ChunkHeight } from '@nerima-games/mc-kernel/domain/chunk'
import { Result } from 'effect'
import { sampleNoise3DGrid } from './sampling-3d.js'

export type NoiseChunkSamplingOptions = Readonly<{
  readonly sampleStride?: SampleStride
}>

export type NoiseChunk3DSamplingOptions = Readonly<{
  readonly originY: PositionAxis
  readonly stepX?: GridStep
  readonly stepY?: GridStep
  readonly stepZ?: GridStep
}>

const SINGLE_SAMPLE_STEP = 1
const DEFAULT_CHUNK_STEP: GridStep = GridStep(SINGLE_SAMPLE_STEP)

const chunkOrigins = (
  chunk: ChunkCoord,
): Result.Result<Readonly<{ originX: PositionAxisValue; originZ: PositionAxisValue }>, RangeError> => {
  const chunkX = Result.mapError(ChunkAxis.result(chunk.cx), (error) => new RangeError(error.message))
  if (Result.isFailure(chunkX)) {
    return Result.fail(chunkX.failure)
  }
  const chunkZ = Result.mapError(ChunkAxis.result(chunk.cz), (error) => new RangeError(error.message))
  if (Result.isFailure(chunkZ)) {
    return Result.fail(chunkZ.failure)
  }
  const originX = PositionAxis(chunkX.success * CHUNK_SIZE_XZ)
  const originZ = PositionAxis(chunkZ.success * CHUNK_SIZE_XZ)
  return Result.succeed({ originX, originZ })
}

export const sampleNoise2DChunk = (
  noise: NoiseFn2D,
  chunk: ChunkCoord,
  options: NoiseChunkSamplingOptions = {},
): Result.Result<Float32Array, RangeError> =>
  Result.gen(function* sampleNoise2DChunkResult() {
  const origins = yield* chunkOrigins(chunk)
  const chunkSize = GridDimension(CHUNK_SIZE_XZ)
  const gridOptions = {
    depth: chunkSize,
    originX: origins.originX,
    originZ: origins.originZ,
    width: chunkSize,
  }

  if (!('sampleStride' in options)) {
    return yield* sampleNoise2DInterpolatedGrid(noise, gridOptions)
  }
  return yield* sampleNoise2DInterpolatedGrid(noise, {
    ...gridOptions,
    sampleStride: options.sampleStride,
  })
})

export const sampleNoise3DChunk = (
  noise: NoiseFn3D,
  chunk: ChunkCoord,
  height: ChunkHeight,
  options: NoiseChunk3DSamplingOptions,
): Result.Result<Float32Array, RangeError> =>
  Result.gen(function* sampleNoise3DChunkResult() {
    const validHeight = yield* Result.mapError(
      ChunkHeight(Number(height)),
      (error) => new RangeError(error.message),
    )
    const validOriginY = yield* Result.mapError(
      PositionAxis.result(options.originY),
      (error) => new RangeError(error.message),
    )
    const origins = yield* chunkOrigins(chunk)
    const chunkSize = GridDimension(CHUNK_SIZE_XZ)

    return yield* sampleNoise3DGrid(noise, {
      depth: chunkSize,
      height: GridDimension(validHeight),
      originX: origins.originX,
      originY: validOriginY,
      originZ: origins.originZ,
      stepX: options.stepX ?? DEFAULT_CHUNK_STEP,
      stepY: options.stepY ?? DEFAULT_CHUNK_STEP,
      stepZ: options.stepZ ?? DEFAULT_CHUNK_STEP,
      width: chunkSize,
    })
  })
