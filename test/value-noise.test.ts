import { describe, expect, it } from 'vitest'
import { channelSeed, fbm2D, latticeValue, valueNoise2D } from '../src/index'

describe('value noise compatibility API', () => {
  it('is deterministic and decorrelates named channels', () => {
    expect(channelSeed(42, 'terrain')).toBe(channelSeed(42, 'terrain'))
    expect(channelSeed(42, 'terrain')).not.toBe(channelSeed(42, 'temperature'))
  })

  it('matches the reference vectors for hashing and interpolation', () => {
    expect(channelSeed(42, 'terrain')).toBe(2699606907)
    expect(latticeValue(42, -16, 32)).toBe(0.7420056120026857)
    expect(valueNoise2D(42, -16.25, 32.75, 0.08)).toBe(0.6667454798861964)
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

  it('rejects non-finite and non-integral numeric parameters', () => {
    for (const frequency of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => valueNoise2D(42, 1, 2, frequency)).toThrow(RangeError)
    }

    const invalidOptions = [
      { octaves: 1.5, frequency: 0.1, persistence: 0.5 },
      { octaves: 1, frequency: Number.NaN, persistence: 0.5 },
      { octaves: 1, frequency: 0.1, persistence: Number.NEGATIVE_INFINITY },
    ]
    for (const options of invalidOptions) {
      expect(() => fbm2D(42, 1, 2, options)).toThrow(RangeError)
    }
  })

  it('returns zero for an empty fBm configuration', () => {
    expect(fbm2D(42, 1, 2, { octaves: 0, frequency: 0.1, persistence: 0.5 })).toBe(0)
  })
})
