import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import { GridDimension, GridStep, SampleStride, sampleNoise2DBatch, sampleNoise2DGrid, type NoisePoint2D } from '../src/domain/sampling'

const expectSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

const expectRangeError = <Success>(result: Result.Result<Success, RangeError>, message: string): void => {
  expect(Result.isFailure(result)).toBe(true)
  if (Result.isFailure(result)) {
    expect(result.failure).toBeInstanceOf(RangeError)
    expect(result.failure.message).toBe(message)
  }
}

describe('sampleNoise2DBatch', () => {
  it('preserves point order in a typed result', () => {
    const samples = expectSuccess(sampleNoise2DBatch((x, z) => x * 10 + z, [
      { x: 1, z: 2 },
      { x: -1, z: 3 },
    ]))

    expect(samples).toBeInstanceOf(Float32Array)
    expect([...samples]).toEqual([12, -7])
  })

  it('rejects non-finite coordinates', () => {
    const invalidX = sampleNoise2DBatch(() => 0, [{ x: Number.NaN, z: 0 }])
    const invalidZ = sampleNoise2DBatch(() => 0, [{ x: 0, z: Number.NaN }])

    expectRangeError(invalidX, 'point.x must be finite, received NaN')
    expectRangeError(invalidZ, 'point.z must be finite, received NaN')
  })

  it('rejects a sparse array whose length outruns its elements', () => {
    // `ReadonlyArray<NoisePoint2D>` does not exclude a sparse array: setting
    // `.length` past the last assigned index leaves real holes, and reading a
    // hole returns `undefined` at runtime despite the element type. A caller
    // who grows an array (e.g. pre-sizing a buffer before filling it) can hit
    // this without ever writing an explicit cast.
    const points: Array<NoisePoint2D> = [{ x: 0, z: 0 }]
    points.length = 3

    const result = sampleNoise2DBatch(() => 0, points)
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure.message).toBe('points[1] is missing')
    }
  })
})

describe('sampleNoise2DGrid', () => {
  it('writes row-major samples from the configured origin and steps', () => {
    const samples = expectSuccess(sampleNoise2DGrid((x, z) => x * 10 + z, {
      width: GridDimension(3),
      depth: GridDimension(2),
      originX: 2,
      originZ: -1,
      stepX: GridStep(0.5),
      stepZ: GridStep(2),
    }))

    expect([...samples]).toEqual([19, 24, 29, 21, 26, 31])
  })

  it('rejects invalid dimensions and steps', () => {
    expect(Result.isFailure(GridDimension.result(0))).toBe(true)
    expect(Result.isFailure(GridStep.result(0))).toBe(true)
    expect(Result.isFailure(SampleStride.result(1.5))).toBe(true)
    // @ts-expect-error malformed runtime input exercises grid validation
    const invalidDimension = sampleNoise2DGrid(() => 0, { width: 0, depth: GridDimension(1) })
    expect(Result.isFailure(invalidDimension)).toBe(true)
    // @ts-expect-error malformed runtime input exercises grid validation
    const invalidStep = sampleNoise2DGrid(() => 0, { width: GridDimension(1), depth: GridDimension(1), stepX: 0 })
    expect(Result.isFailure(invalidStep)).toBe(true)
    // @ts-expect-error malformed runtime input exercises depth validation
    const invalidDepth = sampleNoise2DGrid(() => 0, { width: GridDimension(1), depth: 0 })
    expect(Result.isFailure(invalidDepth)).toBe(true)
    expect(Result.isFailure(sampleNoise2DGrid(() => 0, {
      width: GridDimension(1),
      depth: GridDimension(1),
      originX: Number.POSITIVE_INFINITY,
    }))).toBe(true)
    expect(Result.isFailure(sampleNoise2DGrid(() => 0, {
      width: GridDimension(1),
      depth: GridDimension(1),
      originZ: Number.NaN,
    }))).toBe(true)
    const invalidStepZ = sampleNoise2DGrid(() => 0, {
      width: GridDimension(1),
      depth: GridDimension(1),
      // @ts-expect-error malformed runtime input exercises stepZ validation
      stepZ: 0,
    })
    expect(Result.isFailure(invalidStepZ)).toBe(true)
  })

  it('defaults an omitted stepX to one grid cell per column', () => {
    // The other three optional fields (originX, originZ, stepZ) are already
    // exercised omitted by the error-case test above, which supplies stepX
    // explicitly; this is the one combination that leaves stepX's own
    // default untested.
    const samples = expectSuccess(sampleNoise2DGrid((x, z) => x * 10 + z, { width: GridDimension(2), depth: GridDimension(1) }))
    expect([...samples]).toEqual([0, 10])
  })
})
