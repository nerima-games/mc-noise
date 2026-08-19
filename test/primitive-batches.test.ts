import { describe, expect, it } from 'vitest'
import {
  noise2DBatch,
  noise2DBatchXY,
  noise3DBatchXYZ,
  octaveNoise2DBatch,
  octaveNoise2DBatchXY,
  type Point2D,
} from '../src/domain/primitive-batches'
import type { NoisePrimitives } from '../src/domain/noise-primitives'

const primitives: NoisePrimitives = {
  continentalness: () => 0,
  continentalnessAt: () => 0,
  erosion: () => 0,
  erosionAt: () => 0,
  jaggedness: () => 0,
  jaggednessAt: () => 0,
  noise2D: (x, z) => x + z,
  noise3D: (x, y, z) => x + y * 10 + z * 100,
  octaveNoise2D: (x, z, octaves, persistence, lacunarity) => x + z + octaves + persistence + lacunarity,
  raw2D: () => 0,
  raw3D: () => 0,
  sampleTerrainChannels: () => ({
    continentalness: new Float64Array(),
    erosion: new Float64Array(),
    jaggedness: new Float64Array(),
    pv: new Float64Array(),
  }),
  weirdness: () => 0,
  weirdnessAt: () => 0,
}

describe('primitive batch samplers', () => {
  it('preserves XY and XYZ order and returns NaN for missing parallel coordinates', () => {
    expect([...noise2DBatchXY(primitives, [1, 2], [10, 20])]).toEqual([11, 22])
    const missingZ = noise2DBatchXY(primitives, [1, 2], [10])
    expect(missingZ[0]).toBe(11)
    expect(Number.isNaN(missingZ[1])).toBe(true)

    expect([...noise3DBatchXYZ(primitives, [1, 2], [3, 4], [5, 6])]).toEqual([531, 642])
    const missingY = noise3DBatchXYZ(primitives, [1], [], [5])
    expect(Number.isNaN(missingY[0])).toBe(true)
  })

  it('applies the same positional parameters to every octave batch sample', () => {
    expect([...octaveNoise2DBatchXY(primitives, [1, 2], [10, 20], 4, 0.5, 2)]).toEqual([
      17.5,
      28.5,
    ])
    const missingZ = octaveNoise2DBatchXY(primitives, [1], [], 4, 0.5, 2)
    expect(Number.isNaN(missingZ[0])).toBe(true)
  })

  it('supports point tuples and returns NaN for a missing point', () => {
    const points: readonly Point2D[] = [[1, 2], [3, 4]]
    expect([...noise2DBatch(primitives, points)]).toEqual([3, 7])
    expect([...octaveNoise2DBatch(primitives, points, 2, 0.5, 2)]).toEqual([7.5, 11.5])

    const sparsePoints = new Array<Point2D>(2)
    sparsePoints[0] = [1, 2]
    const missingNoise = noise2DBatch(primitives, sparsePoints)
    const missingOctave = octaveNoise2DBatch(primitives, sparsePoints, 2, 0.5, 2)
    expect(missingNoise[0]).toBe(3)
    expect(Number.isNaN(missingNoise[1])).toBe(true)
    expect(Number.isNaN(missingOctave[1])).toBe(true)
  })
})
