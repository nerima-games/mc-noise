import { CHUNK_SIZE_XZ, ChunkHeight, chunkCoord } from '@nerima-games/mc-kernel'
import { describe, expect, it } from 'vitest'
import { sampleNoise3DChunk } from '../src/domain/chunk-sampling'

const createChunkHeight = ChunkHeight

describe('sampleNoise3DChunk', () => {
  it('maps a kernel chunk to world coordinates and kernel storage order', () => {
    const samples = sampleNoise3DChunk(
      (x, y, z) => x + y * 100 + z * 1_000,
      chunkCoord(1, -2),
      createChunkHeight(2),
      { originY: -5 },
    )

    expect(samples).toHaveLength(CHUNK_SIZE_XZ * CHUNK_SIZE_XZ * 2)
    expect(samples[0]).toBe(-32_484)
    expect(samples[1]).toBe(-32_384)
    expect(samples[31]).toBe(-17_384)
    expect(samples[511]).toBe(-17_369)
  })

  it('forwards explicit axis spacing', () => {
    const samples = sampleNoise3DChunk(
      (x, y, z) => x * 100 + y * 10 + z,
      chunkCoord(0, 0),
      createChunkHeight(1),
      { originY: 2, stepX: 2, stepY: 3, stepZ: 4 },
    )

    expect(samples[0]).toBe(20)
    expect(samples[15]).toBe(80)
    expect(samples[240]).toBe(3_020)
  })

  it('rejects forged chunk heights before sampling', () => {
    expect(() =>
      sampleNoise3DChunk(
        () => 0,
        chunkCoord(0, 0),
        65_536 as ChunkHeight,
        { originY: 0 },
      ),
    ).toThrow()
  })
})
