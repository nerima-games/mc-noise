import { describe, expect, it } from 'vitest'
import { channelSeed, fbm2D, latticeValue, valueNoise2D } from '../src/index'

describe('value noise compatibility API', () => {
  it('is deterministic and decorrelates named channels', () => {
    expect(channelSeed(42, 'terrain')).toBe(channelSeed(42, 'terrain'))
    expect(channelSeed(42, 'terrain')).not.toBe(channelSeed(42, 'temperature'))
  })

  it('keeps lattice and interpolated samples in the unit interval', () => {
    const samples = [
      latticeValue(42, -16, 32),
      valueNoise2D(42, -16.25, 32.75, 0.08),
      fbm2D(42, -16.25, 32.75, { octaves: 4, frequency: 0.08, persistence: 0.5 }),
    ]

    for (const sample of samples) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(1)
    }
  })

  it('returns zero for an empty fBm configuration', () => {
    expect(fbm2D(42, 1, 2, { octaves: 0, frequency: 0.1, persistence: 0.5 })).toBe(0)
  })
})
