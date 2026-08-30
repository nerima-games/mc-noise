import { describe, expect, it } from 'vitest'
import {
  sampleNoise3DBatch,
  sampleNoise3DGrid,
  sampleNoise3DInterpolatedGrid,
  type NoisePoint3D,
} from '../src/domain/sampling-3d'

describe('sampleNoise3DBatch', () => {
  it('preserves point order in a typed result', () => {
    const samples = sampleNoise3DBatch((x, y, z) => x * 100 + y * 10 + z, [
      { x: 3, y: 2, z: 1 },
      { x: -3, y: 2, z: 1 },
    ])

    expect(samples).toBeInstanceOf(Float32Array)
    expect([...samples]).toEqual([321, -279])
  })

  it('rejects non-finite coordinates and sparse points', () => {
    expect(() => sampleNoise3DBatch(() => 0, [{ x: Number.NaN, y: 0, z: 0 }])).toThrow(RangeError)

    const points: Array<NoisePoint3D> = [{ x: 0, y: 0, z: 0 }]
    points.length = 2
    expect(() => sampleNoise3DBatch(() => 0, points)).toThrow('points[1] is missing')
  })
})


describe('sampleNoise3DInterpolatedGrid', () => {
  it('interpolates each axis and preserves the final boundary', () => {
    let evaluations = 0
    const samples = sampleNoise3DInterpolatedGrid(
      (x, y, z) => {
        evaluations += 1
        return x + y * 10 + z * 100
      },
      {
        width: 4,
        height: 3,
        depth: 3,
        originX: 1,
        originY: 2,
        originZ: 3,
        sampleStrideX: 2,
        sampleStrideY: 2,
        sampleStrideZ: 2,
      },
    )

    expect(evaluations).toBe(12)
    expect([...samples]).toEqual([
      321, 331, 341, 421, 431, 441, 521, 531, 541,
      322, 332, 342, 422, 432, 442, 522, 532, 542,
      323, 333, 343, 423, 433, 443, 523, 533, 543,
      324, 334, 344, 424, 434, 444, 524, 534, 544,
    ])
  })

it('uses unit interpolation strides by default', () => {
    const samples = sampleNoise3DInterpolatedGrid(
      (x, y, z) => x + y * 10 + z * 100,
      { width: 2, height: 2, depth: 2 },
    )

    expect([...samples]).toEqual([0, 10, 100, 110, 1, 11, 101, 111])
  })

  it('rejects non-positive and non-integer sample strides', () => {
    const options = { width: 1, height: 1, depth: 1 }

    expect(() => sampleNoise3DInterpolatedGrid(() => 0, { ...options, sampleStrideX: 0 })).toThrow(RangeError)
    expect(() => sampleNoise3DInterpolatedGrid(() => 0, { ...options, sampleStrideY: 1.5 })).toThrow(RangeError)
    expect(() =>
      sampleNoise3DInterpolatedGrid(() => 0, { ...options, sampleStrideZ: Number.POSITIVE_INFINITY }),
    ).toThrow(RangeError)
  })
})

describe('sampleNoise3DGrid', () => {
  it('writes x-major, z-major, y-minor samples', () => {
    const samples = sampleNoise3DGrid((x, y, z) => x + y * 10 + z * 100, {
      width: 2,
      height: 2,
      depth: 2,
      originX: 1,
      originY: 2,
      originZ: 3,
    })

    expect([...samples]).toEqual([321, 331, 421, 431, 322, 332, 422, 432])
  })

  it('applies independent axis spacing', () => {
    const samples = sampleNoise3DGrid((x, y, z) => x * 100 + y * 10 + z, {
      width: 2,
      height: 1,
      depth: 1,
      originX: 1,
      originY: 2,
      originZ: 3,
      stepX: 2,
      stepY: 3,
      stepZ: 4,
    })

    expect([...samples]).toEqual([123, 323])
  })

  it('rejects invalid dimensions, origins, and steps', () => {
    expect(() => sampleNoise3DGrid(() => 0, { width: 0, height: 1, depth: 1 })).toThrow(RangeError)
    expect(() => sampleNoise3DGrid(() => 0, { width: 1.5, height: 1, depth: 1 })).toThrow(RangeError)
    expect(() => sampleNoise3DGrid(() => 0, { width: 1, height: 1, depth: 1, originY: Number.NaN })).toThrow(
      RangeError,
    )
    expect(() => sampleNoise3DGrid(() => 0, { width: 1, height: 1, depth: 1, stepZ: 0 })).toThrow(RangeError)
  })
})
