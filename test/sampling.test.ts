import { describe, expect, it } from 'vitest'
import { sampleNoise2DBatch, sampleNoise2DGrid } from '../src/domain/sampling'

describe('sampleNoise2DBatch', () => {
  it('preserves point order in a typed result', () => {
    const samples = sampleNoise2DBatch((x, z) => x * 10 + z, [
      { x: 1, z: 2 },
      { x: -1, z: 3 },
    ])

    expect(samples).toBeInstanceOf(Float32Array)
    expect([...samples]).toEqual([12, -7])
  })

  it('rejects non-finite coordinates', () => {
    expect(() => sampleNoise2DBatch(() => 0, [{ x: Number.NaN, z: 0 }])).toThrow(RangeError)
  })
})

describe('sampleNoise2DGrid', () => {
  it('writes row-major samples from the configured origin and steps', () => {
    const samples = sampleNoise2DGrid((x, z) => x * 10 + z, {
      width: 3,
      depth: 2,
      originX: 2,
      originZ: -1,
      stepX: 0.5,
      stepZ: 2,
    })

    expect([...samples]).toEqual([19, 24, 29, 21, 26, 31])
  })

  it('rejects invalid dimensions and steps', () => {
    expect(() => sampleNoise2DGrid(() => 0, { width: 0, depth: 1 })).toThrow(RangeError)
    expect(() => sampleNoise2DGrid(() => 0, { width: 1, depth: 1, stepX: 0 })).toThrow(RangeError)
  })
})
