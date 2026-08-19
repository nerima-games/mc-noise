import { describe, expect, it } from 'vitest'
import {
  CHUNK_COLUMN_SAMPLE_COUNT,
  computeTerrainChannels,
  SCALE_C,
  SCALE_E,
  SCALE_J,
  TERRAIN_SAMPLE_STEP,
  toPV,
} from '../src/domain/terrain-channels'

describe('computeTerrainChannels', () => {
  it('bilinearly expands sparse channel samples into a chunk column', () => {
    const channels = computeTerrainChannels(
      (x, z) => x + z,
      (x, z) => x - z,
      () => 0,
      (x, z) => x + z,
      10,
      20,
    )

    expect(TERRAIN_SAMPLE_STEP).toBe(2)
    expect(CHUNK_COLUMN_SAMPLE_COUNT).toBe(16 * 16)
    expect(channels.continentalness[0]).toBe((10 + 20) * SCALE_C)
    expect(channels.continentalness[1]).toBe((11 + 20) * SCALE_C)
    expect(channels.continentalness[16]).toBe((10 + 21) * SCALE_C)
    expect(channels.erosion[15]).toBeCloseTo((25 - 20) * SCALE_E, 12)
    expect(channels.jaggedness[15]).toBe((25 + 20) * SCALE_J)
    expect(channels.pv[0]).toBe(toPV(0))
    expect(channels.pv[255]).toBe(toPV(0))
  })

  it('rejects non-finite chunk origins', () => {
    const channels = () => computeTerrainChannels(() => 0, () => 0, () => 0, () => 0, Number.NaN, 0)
    expect(channels).toThrow(RangeError)
  })
})
