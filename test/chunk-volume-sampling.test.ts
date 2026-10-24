import { CHUNK_SIZE_XZ, ChunkHeight, chunkCoord } from '@nerima-games/mc-kernel'
import { Result } from 'effect'
import { describe, expect, it } from 'vitest'
import { ChunkAxis, PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { sampleNoise3DChunk } from '../src/domain/chunk-sampling'
import { GridStep } from '../src/domain/sampling'

const expectSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

const createChunkHeight = (height: number) => expectSuccess(ChunkHeight(height))

describe('sampleNoise3DChunk', () => {
  it('maps a kernel chunk to world coordinates and kernel storage order', () => {
    const samples = sampleNoise3DChunk(
      (x, y, z) => x + y * 100 + z * 1_000,
      chunkCoord(ChunkAxis(1), ChunkAxis(-2)),
      createChunkHeight(2),
      { originY: PositionAxis(-5) },
    )
    const values = expectSuccess(samples)

    expect(values).toHaveLength(CHUNK_SIZE_XZ * CHUNK_SIZE_XZ * 2)
    expect(values[0]).toBe(-32_484)
    expect(values[1]).toBe(-32_384)
    expect(values[31]).toBe(-17_384)
    expect(values[511]).toBe(-17_369)
  })

  it('forwards explicit axis spacing', () => {
    const samples = sampleNoise3DChunk(
      (x, y, z) => x * 100 + y * 10 + z,
      chunkCoord(ChunkAxis(0), ChunkAxis(0)),
      createChunkHeight(1),
      {
        originY: PositionAxis(2),
        stepX: GridStep(2),
        stepY: GridStep(3),
        stepZ: GridStep(4),
      },
    )
    const values = expectSuccess(samples)

    expect(values[0]).toBe(20)
    expect(values[15]).toBe(80)
    expect(values[240]).toBe(3_020)
  })

  it('rejects forged chunk heights before sampling', () => {
    const result = sampleNoise3DChunk(
      () => 0,
      chunkCoord(ChunkAxis(0), ChunkAxis(0)),
      // @ts-expect-error malformed runtime input exercises the kernel brand boundary
      65_536,
      { originY: PositionAxis(0) },
    )
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(RangeError)
    }
  })

  it('rejects malformed vertical origins and chunk coordinates', () => {
    const invalidOrigin = sampleNoise3DChunk(
      () => 0,
      chunkCoord(ChunkAxis(0), ChunkAxis(0)),
      createChunkHeight(1),
      {
        // @ts-expect-error malformed runtime input exercises the position brand boundary
        originY: Number.NaN,
      },
    )
    expect(Result.isFailure(invalidOrigin)).toBe(true)
    if (Result.isFailure(invalidOrigin)) {
      expect(invalidOrigin.failure).toBeInstanceOf(RangeError)
    }

    const invalidChunk = sampleNoise3DChunk(
      () => 0,
      {
        cx: ChunkAxis(0),
        // @ts-expect-error malformed runtime input exercises the chunk-axis boundary
        cz: 0.5,
      },
      createChunkHeight(1),
      { originY: PositionAxis(0) },
    )
    expect(Result.isFailure(invalidChunk)).toBe(true)
    if (Result.isFailure(invalidChunk)) {
      expect(invalidChunk.failure).toBeInstanceOf(RangeError)
    }
  })
})
