import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import { GridDimension, GridStep, SampleStride } from '../src/domain/sampling'
import {
  sampleNoise3DBatch,
  sampleNoise3DGrid,
  sampleNoise3DInterpolatedGrid,
  type NoisePoint3D,
} from '../src/domain/sampling-3d'

const expectSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

describe('sampleNoise3DBatch', () => {
  it('preserves point order in a typed result', () => {
    const samples = expectSuccess(sampleNoise3DBatch((x, y, z) => x * 100 + y * 10 + z, [
      { x: 3, y: 2, z: 1 },
      { x: -3, y: 2, z: 1 },
    ]))

    expect(samples).toBeInstanceOf(Float32Array)
    expect([...samples]).toEqual([321, -279])
  })

  it('rejects non-finite coordinates and sparse points', () => {
    const invalidCoordinate = sampleNoise3DBatch(() => 0, [{ x: Number.NaN, y: 0, z: 0 }])
    expect(Result.isFailure(invalidCoordinate)).toBe(true)
    expect(Result.isFailure(sampleNoise3DBatch(() => 0, [{ x: 0, y: Number.NaN, z: 0 }]))).toBe(true)
    expect(Result.isFailure(sampleNoise3DBatch(() => 0, [{ x: 0, y: 0, z: Number.NaN }]))).toBe(true)

    const points: Array<NoisePoint3D> = [{ x: 0, y: 0, z: 0 }]
    points.length = 2
    const sparse = sampleNoise3DBatch(() => 0, points)
    expect(Result.isFailure(sparse)).toBe(true)
    if (Result.isFailure(sparse)) {
      expect(sparse.failure.message).toBe('points[1] is missing')
    }
  })
})


describe('sampleNoise3DInterpolatedGrid', () => {
  it('interpolates each axis and preserves the final boundary', () => {
    let evaluations = 0
    const samples = expectSuccess(sampleNoise3DInterpolatedGrid(
      (x, y, z) => {
        evaluations += 1
        return x + y * 10 + z * 100
      },
      {
        width: GridDimension(4),
        height: GridDimension(3),
        depth: GridDimension(3),
        originX: 1,
        originY: 2,
        originZ: 3,
        sampleStrideX: SampleStride(2),
        sampleStrideY: SampleStride(2),
        sampleStrideZ: SampleStride(2),
      },
    ))

    expect(evaluations).toBe(12)
    expect([...samples]).toEqual([
      321, 331, 341, 421, 431, 441, 521, 531, 541,
      322, 332, 342, 422, 432, 442, 522, 532, 542,
      323, 333, 343, 423, 433, 443, 523, 533, 543,
      324, 334, 344, 424, 434, 444, 524, 534, 544,
    ])
  })

it('uses unit interpolation strides by default', () => {
    const samples = expectSuccess(sampleNoise3DInterpolatedGrid(
      (x, y, z) => x + y * 10 + z * 100,
      { width: GridDimension(2), height: GridDimension(2), depth: GridDimension(2) },
    ))

    expect([...samples]).toEqual([0, 10, 100, 110, 1, 11, 101, 111])
    const defaults = expectSuccess(sampleNoise3DGrid(
      (x, y, z) => x + y + z,
      { width: GridDimension(1), height: GridDimension(1), depth: GridDimension(1) },
    ))
    expect([...defaults]).toEqual([0])
  })

  it('rejects non-positive and non-integer sample strides', () => {
    const options = { width: GridDimension(1), height: GridDimension(1), depth: GridDimension(1) }

    // @ts-expect-error malformed runtime input exercises stride validation
    const zeroStride = sampleNoise3DInterpolatedGrid(() => 0, { ...options, sampleStrideX: 0 })
    expect(Result.isFailure(zeroStride)).toBe(true)
    // @ts-expect-error malformed runtime input exercises stride validation
    const fractionalStride = sampleNoise3DInterpolatedGrid(() => 0, { ...options, sampleStrideY: 1.5 })
    expect(Result.isFailure(fractionalStride)).toBe(true)
    // @ts-expect-error malformed runtime input exercises stride validation
    const infiniteStride = sampleNoise3DInterpolatedGrid(() => 0, { ...options, sampleStrideZ: Number.POSITIVE_INFINITY })
    expect(Result.isFailure(infiniteStride)).toBe(true)
    const invalidGrid = sampleNoise3DInterpolatedGrid(() => 0, {
      // @ts-expect-error malformed runtime input exercises interpolated grid validation
      width: 0,
      height: GridDimension(1),
      depth: GridDimension(1),
    })
    expect(Result.isFailure(invalidGrid)).toBe(true)
  })
})

describe('sampleNoise3DGrid', () => {
  it('writes x-major, z-major, y-minor samples', () => {
    const samples = expectSuccess(sampleNoise3DGrid((x, y, z) => x + y * 10 + z * 100, {
      width: GridDimension(2),
      height: GridDimension(2),
      depth: GridDimension(2),
      originX: 1,
      originY: 2,
      originZ: 3,
    }))

    expect([...samples]).toEqual([321, 331, 421, 431, 322, 332, 422, 432])
  })

  it('applies independent axis spacing', () => {
    const samples = expectSuccess(sampleNoise3DGrid((x, y, z) => x * 100 + y * 10 + z, {
      width: GridDimension(2),
      height: GridDimension(1),
      depth: GridDimension(1),
      originX: 1,
      originY: 2,
      originZ: 3,
      stepX: GridStep(2),
      stepY: GridStep(3),
      stepZ: GridStep(4),
    }))

    expect([...samples]).toEqual([123, 323])
  })

  it('rejects invalid dimensions, origins, and steps', () => {
    // @ts-expect-error malformed runtime input exercises dimension validation
    const zeroWidth = sampleNoise3DGrid(() => 0, { width: 0, height: GridDimension(1), depth: GridDimension(1) })
    expect(Result.isFailure(zeroWidth)).toBe(true)
    // @ts-expect-error malformed runtime input exercises dimension validation
    const fractionalWidth = sampleNoise3DGrid(() => 0, { width: 1.5, height: GridDimension(1), depth: GridDimension(1) })
    expect(Result.isFailure(fractionalWidth)).toBe(true)
    const invalidOrigin = sampleNoise3DGrid(() => 0, { width: GridDimension(1), height: GridDimension(1), depth: GridDimension(1), originY: Number.NaN })
    expect(Result.isFailure(invalidOrigin)).toBe(true)
    // @ts-expect-error malformed runtime input exercises step validation
    const invalidStep = sampleNoise3DGrid(() => 0, { width: GridDimension(1), height: GridDimension(1), depth: GridDimension(1), stepZ: 0 })
    expect(Result.isFailure(invalidStep)).toBe(true)
    // @ts-expect-error malformed runtime input exercises height validation
    const invalidHeight = sampleNoise3DGrid(() => 0, { width: GridDimension(1), height: 0, depth: GridDimension(1) })
    expect(Result.isFailure(invalidHeight)).toBe(true)
    // @ts-expect-error malformed runtime input exercises depth validation
    const invalidDepth = sampleNoise3DGrid(() => 0, { width: GridDimension(1), height: GridDimension(1), depth: 0 })
    expect(Result.isFailure(invalidDepth)).toBe(true)
    expect(Result.isFailure(sampleNoise3DGrid(() => 0, {
      width: GridDimension(1),
      height: GridDimension(1),
      depth: GridDimension(1),
      originX: Number.POSITIVE_INFINITY,
    }))).toBe(true)
    expect(Result.isFailure(sampleNoise3DGrid(() => 0, {
      width: GridDimension(1),
      height: GridDimension(1),
      depth: GridDimension(1),
      originZ: Number.NaN,
    }))).toBe(true)
    const invalidStepX = sampleNoise3DGrid(() => 0, {
      width: GridDimension(1),
      height: GridDimension(1),
      depth: GridDimension(1),
      // @ts-expect-error malformed runtime input exercises stepX validation
      stepX: 0,
    })
    expect(Result.isFailure(invalidStepX)).toBe(true)
    const invalidStepY = sampleNoise3DGrid(() => 0, {
      width: GridDimension(1),
      height: GridDimension(1),
      depth: GridDimension(1),
      // @ts-expect-error malformed runtime input exercises stepY validation
      stepY: Number.POSITIVE_INFINITY,
    })
    expect(Result.isFailure(invalidStepY)).toBe(true)
  })
})
