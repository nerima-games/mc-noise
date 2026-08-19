import { describe, expect, it } from 'vitest'
import {
  createNoisePrimitives,
  WEYL_3D,
  WEYL_C,
  WEYL_E,
  WEYL_J,
  WEYL_W,
} from '../src/domain/noise-primitives'
import { NoiseSeed } from '../src/domain/seed'
import { SCALE_C, SCALE_E, SCALE_J, SCALE_W } from '../src/domain/terrain-channels'

describe('createNoisePrimitives', () => {
  it('assembles deterministic raw, normalized, octave, and terrain-channel samplers', () => {
    const first = createNoisePrimitives(NoiseSeed(20260726))
    const second = createNoisePrimitives(NoiseSeed(20260726))
    const x = 17.25
    const y = -3.75
    const z = 42.5

    expect(first.raw2D(x, z)).toBe(second.raw2D(x, z))
    expect(first.raw3D(x, y, z)).toBe(second.raw3D(x, y, z))
    expect(first.noise2D(x, z)).toBe(second.noise2D(x, z))
    expect(first.noise3D(x, y, z)).toBe(first.raw3D(x, y, z))
    expect(first.octaveNoise2D(x, z, 4, 0.5, 2)).toBe(second.octaveNoise2D(x, z, 4, 0.5, 2))

    for (const value of [
      first.noise2D(x, z),
      first.continentalness(x, z),
      first.erosion(x, z),
      first.weirdness(x, z),
      first.jaggedness(x, z),
      first.continentalnessAt(x, z),
      first.erosionAt(x, z),
      first.weirdnessAt(x, z),
      first.jaggednessAt(x, z),
    ]) {
      expect(Number.isFinite(value)).toBe(true)
    }
    expect(first.noise2D(x, z)).toBeGreaterThanOrEqual(0)
    expect(first.noise2D(x, z)).toBeLessThanOrEqual(1)
    expect(first.noise3D(x, y, z)).toBeGreaterThanOrEqual(-1)
    expect(first.noise3D(x, y, z)).toBeLessThanOrEqual(1)

    expect(first.continentalnessAt(x, z)).toBe(first.continentalness(x * SCALE_C, z * SCALE_C))
    expect(first.erosionAt(x, z)).toBe(first.erosion(x * SCALE_E, z * SCALE_E))
    expect(first.weirdnessAt(x, z)).toBe(first.weirdness(x * SCALE_W, z * SCALE_W))
    expect(first.jaggednessAt(x, z)).toBe(first.jaggedness(x * SCALE_J, z * SCALE_J))

    const channels = first.sampleTerrainChannels(0, 0)
    expect(channels.continentalness).toHaveLength(256)
    expect(channels.erosion).toHaveLength(256)
    expect(channels.pv).toHaveLength(256)
    expect(channels.jaggedness).toHaveLength(256)
    expect([...channels.continentalness]).toEqual([...second.sampleTerrainChannels(0, 0).continentalness])
  })

  it('keeps the published Weyl salts stable', () => {
    expect({ WEYL_C, WEYL_E, WEYL_W, WEYL_J, WEYL_3D }).toStrictEqual({
      WEYL_C: 0x9e3779b1,
      WEYL_E: 0xbb67ae85,
      WEYL_W: 0x3c6ef372,
      WEYL_J: 0xa54ff53a,
      WEYL_3D: 0x9e3779b9,
    })
  })

  it('preserves the portable no-octave sentinel', () => {
    const primitives = createNoisePrimitives(NoiseSeed(1))
    expect(primitives.octaveNoise2D(1, 2, 0, 0.5, 2)).toBe(0)
  })
})
