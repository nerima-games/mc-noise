import { describe, expect, it } from 'vitest'
import { sampleNoise2DInterpolatedGrid } from '../src/domain/sampling'

describe('sampleNoise2DInterpolatedGrid', () => {
  it('preserves direct sampling when the stride is one', () => {
    let calls = 0
    const samples = sampleNoise2DInterpolatedGrid(
      (x, z) => {
        calls += 1
        return x * 10 + z
      },
      { depth: 2, sampleStride: 1, width: 3 },
    )

    expect(calls).toBe(6)
    expect([...samples]).toEqual([0, 10, 20, 1, 11, 21])
  })


  it('clamps the final sparse cell at non-divisible bounds', () => {
    let calls = 0
    const samples = sampleNoise2DInterpolatedGrid(
      (x, z) => {
        calls += 1
        return x + z * 10
      },
      {
        depth: 3,
        originX: 10,
        originZ: -2,
        sampleStride: 3,
        stepX: 0.5,
        stepZ: 2,
        width: 4,
      },
    )

    expect(calls).toBe(4)
    expect([...samples]).toEqual([
      -10, -9.5, -9, -8.5,
      10, 10.5, 11, 11.5,
      30, 30.5, 31, 31.5,
    ])
  })

  it('rejects invalid dimensions and coordinates', () => {
    expect(() =>
      sampleNoise2DInterpolatedGrid(() => 0, { depth: 1, width: 0 }),
    ).toThrow(RangeError)
    expect(() =>
      sampleNoise2DInterpolatedGrid(() => 0, {
        depth: 1,
        originX: Infinity,
        width: 1,
      }),
    ).toThrow(RangeError)
    expect(() =>
      sampleNoise2DInterpolatedGrid(() => 0, {
        depth: 1,
        stepZ: 0,
        width: 1,
      }),
    ).toThrow(RangeError)
  })

  it('fills a dense grid from sparse samples with bilinear interpolation', () => {
    let calls = 0
    const samples = sampleNoise2DInterpolatedGrid(
      (x, z) => {
        calls += 1
        return x + z * 10
      },
      { depth: 4, sampleStride: 2, width: 5 },
    )

    expect(calls).toBe(9)
    expect([...samples]).toEqual([
      0, 1, 2, 3, 4,
      10, 11, 12, 13, 14,
      20, 21, 22, 23, 24,
      30, 31, 32, 33, 34,
    ])
  })

  it('rejects a non-positive or fractional stride', () => {
    expect(() => sampleNoise2DInterpolatedGrid(() => 0, { depth: 1, sampleStride: 0, width: 1 })).toThrow(
      RangeError,
    )
    expect(() => sampleNoise2DInterpolatedGrid(() => 0, { depth: 1, sampleStride: 1.5, width: 1 })).toThrow(
      RangeError,
    )
  })
})
