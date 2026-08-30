import { describe, expect, it } from 'vitest'
import { CHUNK_SIZE_XZ, chunkCoord, type ChunkCoord } from '@nerima-games/mc-kernel'
import { sampleNoise2DChunk } from '../src/domain/chunk-sampling'

describe('sampleNoise2DChunk', () => {
  it('maps kernel chunk coordinates to a 16-by-16 world-space grid', () => {
    let calls = 0
    const samples = sampleNoise2DChunk(
      (x, z) => {
        calls += 1
        return x + z / 100
      },
      chunkCoord(2, -3),
    )

    expect(calls).toBe(CHUNK_SIZE_XZ * CHUNK_SIZE_XZ)
    expect(samples).toHaveLength(CHUNK_SIZE_XZ * CHUNK_SIZE_XZ)
    expect(samples[0]).toBeCloseTo(31.52, 5)
    expect(samples[CHUNK_SIZE_XZ - 1]).toBeCloseTo(46.52, 5)
    expect(samples[samples.length - 1]).toBeCloseTo(46.67, 5)
  })

  it('supports sparse chunk sampling while retaining linear fields exactly', () => {
    let calls = 0
    const samples = sampleNoise2DChunk(
      (x, z) => {
        calls += 1
        return x - z * 2
      },
      chunkCoord(-1, 1),
      { sampleStride: 4 },
    )

    expect(calls).toBe(25)
    expect(samples[0]).toBeCloseTo(-48, 5)
    expect(samples[15]).toBeCloseTo(-33, 5)
    expect(samples[16 * 15 + 15]).toBeCloseTo(-63, 5)
  })

  it('rejects forged chunk coordinates before sampling', () => {
    expect(() =>
      sampleNoise2DChunk(() => 0, { cx: 0.5, cz: 0 } as ChunkCoord),
    ).toThrow()
  })
})
