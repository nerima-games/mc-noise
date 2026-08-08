import { describe, expect, it } from 'vitest'
import { sampleNoise2DBatch, sampleNoise2DGrid, type NoisePoint2D } from '../src/domain/sampling'

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

  it('rejects a sparse array whose length outruns its elements', () => {
    // `ReadonlyArray<NoisePoint2D>` does not exclude a sparse array: setting
    // `.length` past the last assigned index leaves real holes, and reading a
    // hole returns `undefined` at runtime despite the element type. A caller
    // who grows an array (e.g. pre-sizing a buffer before filling it) can hit
    // this without ever writing an explicit cast.
    const points: Array<NoisePoint2D> = [{ x: 0, z: 0 }]
    points.length = 3

    expect(() => sampleNoise2DBatch(() => 0, points)).toThrow(RangeError)
    expect(() => sampleNoise2DBatch(() => 0, points)).toThrow('points[1] is missing')
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

  it('defaults an omitted stepX to one grid cell per column', () => {
    // The other three optional fields (originX, originZ, stepZ) are already
    // exercised omitted by the error-case test above, which supplies stepX
    // explicitly; this is the one combination that leaves stepX's own
    // default untested.
    const samples = sampleNoise2DGrid((x, z) => x * 10 + z, { width: 2, depth: 1 })
    expect([...samples]).toEqual([0, 10])
  })
})
