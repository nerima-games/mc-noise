import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import { CHUNK_SIZE_XZ, chunkCoord } from '@nerima-games/mc-kernel'
import { ChunkAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { sampleNoise2DChunk } from '../src/domain/chunk-sampling'
import { SampleStride } from '../src/domain/sampling'

const expectSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

describe('sampleNoise2DChunk', () => {
  it('maps kernel chunk coordinates to a 16-by-16 world-space grid', () => {
    let calls = 0
    const samples = sampleNoise2DChunk(
      (x, z) => {
        calls += 1
        return x + z / 100
      },
      chunkCoord(ChunkAxis(2), ChunkAxis(-3)),
    )
    const values = expectSuccess(samples)

    expect(calls).toBe(CHUNK_SIZE_XZ * CHUNK_SIZE_XZ)
    expect(values).toHaveLength(CHUNK_SIZE_XZ * CHUNK_SIZE_XZ)
    expect(values[0]).toBeCloseTo(31.52, 5)
    expect(values[CHUNK_SIZE_XZ - 1]).toBeCloseTo(46.52, 5)
    expect(values[values.length - 1]).toBeCloseTo(46.67, 5)
  })

  it('supports sparse chunk sampling while retaining linear fields exactly', () => {
    let calls = 0
    const samples = sampleNoise2DChunk(
      (x, z) => {
        calls += 1
        return x - z * 2
      },
      chunkCoord(ChunkAxis(-1), ChunkAxis(1)),
      { sampleStride: SampleStride(4) },
    )
    const values = expectSuccess(samples)

    expect(calls).toBe(25)
    expect(values[0]).toBeCloseTo(-48, 5)
    expect(values[15]).toBeCloseTo(-33, 5)
    expect(values[16 * 15 + 15]).toBeCloseTo(-63, 5)
  })

  it('rejects forged chunk coordinates before sampling', () => {
    // @ts-expect-error malformed runtime input exercises the brand validation boundary
    const result = sampleNoise2DChunk(() => 0, { cx: 0.5, cz: 0 })
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(RangeError)
    }

    // @ts-expect-error malformed runtime input exercises the second chunk-axis boundary
    const invalidZ = sampleNoise2DChunk(() => 0, { cx: ChunkAxis(0), cz: 0.5 })
    expect(Result.isFailure(invalidZ)).toBe(true)
    if (Result.isFailure(invalidZ)) {
      expect(invalidZ.failure).toBeInstanceOf(RangeError)
    }
  })
})
