import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { BoundedNoise } from '../src/domain/octaves'
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
    const result = computeTerrainChannels(
      (x, z) => x + z,
      (x, z) => x - z,
      () => 0,
      (x, z) => x + z,
      BlockAxis(10),
      BlockAxis(20),
    )
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isFailure(result)) {
      throw result.failure
    }
    const channels = result.success

    expect(TERRAIN_SAMPLE_STEP).toBe(2)
    expect(CHUNK_COLUMN_SAMPLE_COUNT).toBe(16 * 16)
    expect(channels.continentalness[0]).toBe((10 + 20) * SCALE_C)
    expect(channels.continentalness[1]).toBe((11 + 20) * SCALE_C)
    expect(channels.continentalness[16]).toBe((10 + 21) * SCALE_C)
    expect(channels.erosion[15]).toBeCloseTo((25 - 20) * SCALE_E, 12)
    expect(channels.jaggedness[15]).toBe((25 + 20) * SCALE_J)
    expect(channels.pv[0]).toBe(toPV(BoundedNoise(0)))
    expect(channels.pv[255]).toBe(toPV(BoundedNoise(0)))
  })

  it('rejects non-finite chunk origins', () => {
    // @ts-expect-error malformed runtime input exercises origin validation
    const channels = computeTerrainChannels(() => 0, () => 0, () => 0, () => 0, Number.NaN, BlockAxis(0))
    expect(Result.isFailure(channels)).toBe(true)
    if (Result.isFailure(channels)) {
      expect(channels.failure).toBeInstanceOf(RangeError)
    }
    // @ts-expect-error malformed runtime input exercises z-origin validation
    const invalidZ = computeTerrainChannels(() => 0, () => 0, () => 0, () => 0, BlockAxis(0), Number.NaN)
    expect(Result.isFailure(invalidZ)).toBe(true)
    if (Result.isFailure(invalidZ)) {
      expect(invalidZ.failure).toBeInstanceOf(RangeError)
    }
  })

  it('rejects a weirdness sampler that escapes the bounded-noise domain', () => {
    const result = computeTerrainChannels(
      () => 0,
      () => 0,
      () => 2,
      () => 0,
      BlockAxis(0),
      BlockAxis(0),
    )
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(RangeError)
    }
  })
})
