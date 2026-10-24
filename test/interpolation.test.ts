import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import { GridDimension, GridStep, SampleStride, sampleNoise2DInterpolatedGrid } from '../src/domain/sampling'

const expectSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

describe('sampleNoise2DInterpolatedGrid', () => {
  it('preserves direct sampling when the stride is one', () => {
    let calls = 0
    const samples = expectSuccess(sampleNoise2DInterpolatedGrid(
      (x, z) => {
        calls += 1
        return x * 10 + z
      },
      { depth: GridDimension(2), sampleStride: SampleStride(1), width: GridDimension(3) },
    ))

    expect(calls).toBe(6)
    expect([...samples]).toEqual([0, 10, 20, 1, 11, 21])
  })


  it('clamps the final sparse cell at non-divisible bounds', () => {
    let calls = 0
    const samples = expectSuccess(sampleNoise2DInterpolatedGrid(
      (x, z) => {
        calls += 1
        return x + z * 10
      },
      {
        depth: GridDimension(3),
        originX: 10,
        originZ: -2,
        sampleStride: SampleStride(3),
        stepX: GridStep(0.5),
        stepZ: GridStep(2),
        width: GridDimension(4),
      },
    ))

    expect(calls).toBe(4)
    expect([...samples]).toEqual([
      -10, -9.5, -9, -8.5,
      10, 10.5, 11, 11.5,
      30, 30.5, 31, 31.5,
    ])
  })

  it('rejects invalid dimensions and coordinates', () => {
    // @ts-expect-error malformed runtime input exercises grid validation
    const invalidDimension = sampleNoise2DInterpolatedGrid(() => 0, { depth: 1, width: 0 })
    expect(Result.isFailure(invalidDimension)).toBe(true)
    const invalidOrigin = sampleNoise2DInterpolatedGrid(() => 0, {
        depth: GridDimension(1),
        originX: Infinity,
        width: GridDimension(1),
      })
    expect(Result.isFailure(invalidOrigin)).toBe(true)
    const invalidStep = sampleNoise2DInterpolatedGrid(() => 0, {
        depth: GridDimension(1),
        // @ts-expect-error malformed runtime input exercises grid validation
        stepZ: 0,
        width: GridDimension(1),
      })
    expect(Result.isFailure(invalidStep)).toBe(true)
  })

  it('fills a dense grid from sparse samples with bilinear interpolation', () => {
    let calls = 0
    const samples = expectSuccess(sampleNoise2DInterpolatedGrid(
      (x, z) => {
        calls += 1
        return x + z * 10
      },
      { depth: GridDimension(4), sampleStride: SampleStride(2), width: GridDimension(5) },
    ))

    expect(calls).toBe(9)
    expect([...samples]).toEqual([
      0, 1, 2, 3, 4,
      10, 11, 12, 13, 14,
      20, 21, 22, 23, 24,
      30, 31, 32, 33, 34,
    ])
  })

  it('rejects a non-positive or fractional stride', () => {
    // @ts-expect-error malformed runtime input exercises stride validation
    const zeroStride = sampleNoise2DInterpolatedGrid(() => 0, { depth: GridDimension(1), sampleStride: 0, width: GridDimension(1) })
    expect(Result.isFailure(zeroStride)).toBe(true)
    // @ts-expect-error malformed runtime input exercises stride validation
    const fractionalStride = sampleNoise2DInterpolatedGrid(() => 0, { depth: GridDimension(1), sampleStride: 1.5, width: GridDimension(1) })
    expect(Result.isFailure(fractionalStride)).toBe(true)
  })
})
