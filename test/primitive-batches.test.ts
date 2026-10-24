import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import { PositionAxis, type PositionAxis as PositionAxisValue } from '@nerima-games/mc-kernel/domain/coordinates'
import {
  noise2DBatch,
  noise2DBatchXY,
  noise3DBatchXYZ,
  octaveNoise2DBatch,
  octaveNoise2DBatchXY,
  type Point2D,
} from '../src/domain/primitive-batches'
import type { NoisePrimitives } from '../src/domain/noise-primitives'
import { NormalizedNoise, OctaveAmplitude, OctaveCount, OctaveFrequency } from '../src/domain/octaves'

const expectSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

const axes = (...values: number[]) => values.map(PositionAxis)

const primitives: NoisePrimitives = {
  continentalness: () => 0,
  continentalnessAt: () => 0,
  erosion: () => 0,
  erosionAt: () => 0,
  jaggedness: () => 0,
  jaggednessAt: () => 0,
  noise2D: (x, z) => x + z,
  noise3D: (x, y, z) => x + y * 10 + z * 100,
  octaveNoise2D: (x, z, octaves, persistence, lacunarity) =>
    Result.succeed(NormalizedNoise((x + z + octaves + persistence + lacunarity) / 100)),
  raw2D: () => 0,
  raw3D: () => 0,
  sampleTerrainChannels: () => Result.succeed({
    continentalness: new Float64Array(),
    erosion: new Float64Array(),
    jaggedness: new Float64Array(),
    pv: new Float64Array(),
  }),
  weirdness: () => 0,
  weirdnessAt: () => 0,
}

describe('primitive batch samplers', () => {
  it('preserves XY and XYZ order and rejects mismatched parallel coordinates', () => {
    expect([...expectSuccess(noise2DBatchXY(primitives, axes(1, 2), axes(10, 20)))]).toEqual([11, 22])
    const missingZ = noise2DBatchXY(primitives, axes(1, 2), axes(10))
    expect(Result.isFailure(missingZ)).toBe(true)

    expect([...expectSuccess(noise3DBatchXYZ(primitives, axes(1, 2), axes(3, 4), axes(5, 6)))]).toEqual([531, 642])
    const missingY = noise3DBatchXYZ(primitives, axes(1), [], axes(5))
    expect(Result.isFailure(missingY)).toBe(true)
  })

  it('applies the same branded octave parameters to every batch sample', () => {
    const octaveOptions = [OctaveCount(4), OctaveAmplitude(0.5), OctaveFrequency(2)] as const
    expect([...expectSuccess(octaveNoise2DBatchXY(primitives, axes(1, 2), axes(10, 20), ...octaveOptions))]).toEqual([
      0.175,
      0.285,
    ])
    const missingZ = octaveNoise2DBatchXY(primitives, axes(1), [], ...octaveOptions)
    expect(Result.isFailure(missingZ)).toBe(true)
  })

  it('supports point tuples and rejects a missing point', () => {
    const points: readonly Point2D[] = [[PositionAxis(1), PositionAxis(2)], [PositionAxis(3), PositionAxis(4)]]
    expect([...expectSuccess(noise2DBatch(primitives, points))]).toEqual([3, 7])
    const octaveOptions = [OctaveCount(2), OctaveAmplitude(0.5), OctaveFrequency(2)] as const
    expect([...expectSuccess(octaveNoise2DBatch(primitives, points, ...octaveOptions))]).toEqual([0.075, 0.115])

    const sparsePoints = new Array<Point2D>(2)
    sparsePoints[0] = [PositionAxis(1), PositionAxis(2)]
    const missingNoise = noise2DBatch(primitives, sparsePoints)
    const missingOctave = octaveNoise2DBatch(primitives, sparsePoints, ...octaveOptions)
    expect(Result.isFailure(missingNoise)).toBe(true)
    expect(Result.isFailure(missingOctave)).toBe(true)
  })

  it('rejects sparse coordinates and propagates octave sampler failures', () => {
    const sparseAxis = new Array<PositionAxisValue>(1)
    expect(Result.isFailure(noise2DBatchXY(primitives, sparseAxis, axes(0)))).toBe(true)
    expect(Result.isFailure(noise2DBatchXY(primitives, axes(0), sparseAxis))).toBe(true)
    expect(Result.isFailure(octaveNoise2DBatchXY(
      primitives,
      sparseAxis,
      axes(0),
      OctaveCount(1),
      OctaveAmplitude(0.5),
      OctaveFrequency(2),
    ))).toBe(true)
    expect(Result.isFailure(octaveNoise2DBatchXY(
      primitives,
      axes(0),
      sparseAxis,
      OctaveCount(1),
      OctaveAmplitude(0.5),
      OctaveFrequency(2),
    ))).toBe(true)
    expect(Result.isFailure(noise3DBatchXYZ(primitives, sparseAxis, axes(0), axes(0)))).toBe(true)
    expect(Result.isFailure(noise3DBatchXYZ(primitives, axes(0), sparseAxis, axes(0)))).toBe(true)
    expect(Result.isFailure(noise3DBatchXYZ(primitives, axes(0), axes(0), sparseAxis))).toBe(true)

    // @ts-expect-error malformed runtime coordinate exercises numeric validation
    const invalidPosition = noise2DBatchXY(primitives, [Number.NaN], axes(0))
    expect(Result.isFailure(invalidPosition)).toBe(true)

    // @ts-expect-error malformed runtime point exercises x-tuple coordinate validation
    const invalidPointX = noise2DBatch(primitives, [[Number.NaN, PositionAxis(0)]])
    expect(Result.isFailure(invalidPointX)).toBe(true)
    // @ts-expect-error malformed runtime point exercises z-tuple coordinate validation
    const invalidPointZ = noise2DBatch(primitives, [[PositionAxis(0), Number.NaN]])
    expect(Result.isFailure(invalidPointZ)).toBe(true)

    const failedOctaveSampler: NoisePrimitives = {
      ...primitives,
      octaveNoise2D: () => Result.fail(new RangeError('sample failed')),
    }
    const point = [[PositionAxis(0), PositionAxis(0)]] as const
    const failedXY = octaveNoise2DBatchXY(
      failedOctaveSampler,
      axes(0),
      axes(0),
      OctaveCount(1),
      OctaveAmplitude(0.5),
      OctaveFrequency(2),
    )
    const failedPoint = octaveNoise2DBatch(
      failedOctaveSampler,
      point,
      OctaveCount(1),
      OctaveAmplitude(0.5),
      OctaveFrequency(2),
    )
    expect(Result.isFailure(failedXY)).toBe(true)
    expect(Result.isFailure(failedPoint)).toBe(true)
  })
})
