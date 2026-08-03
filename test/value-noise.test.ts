import { describe, expect, it } from 'vitest'
import { channelSeed, fbm2D, latticeValue, valueNoise2D } from '../src/index'

describe('value noise', () => {
  it('is deterministic and bounded', () => {
    const samples = [
      latticeValue(42, -10, 7),
      valueNoise2D(42, -1.25, 3.5, 0.08),
      fbm2D(42, -1.25, 3.5, { octaves: 4, frequency: 0.08, persistence: 0.5 }),
    ]

    expect(samples).toEqual([0.37731197429820895, 0.17961703951704996, 0.6187726778458307])
    for (const sample of samples) expect(sample).toBeGreaterThanOrEqual(0)
    for (const sample of samples) expect(sample).toBeLessThanOrEqual(1)
  })

  it('separates octave channels deterministically', () => {
    expect(channelSeed(42, 'octave-0')).not.toBe(channelSeed(42, 'octave-1'))
    expect(channelSeed(42, 'octave-0')).toBe(channelSeed(42, 'octave-0'))
  })
})
