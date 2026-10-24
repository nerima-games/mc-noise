/**
 * Range, continuity and the documented behaviour of the octave stack.
 *
 * Regression names (docs/design-notes.md):
 *   noise-octave-range
 *   noise-octave-degenerate-params
 *   noise-octave-loop-is-imperative
 *   noise-signed-fbm-stays-signed
 *   noise-spatial-continuity
 */
import { describe, expect } from 'vitest'
import { effectTest } from './effect-test'
import { Effect, Result } from 'effect'
import * as FastCheck from 'fast-check'
import { PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { createNoiseField } from '../src/domain/field'
import {
  BoundedNoise,
  NoiseAccumulator,
  OctaveAmplitude,
  OctaveCount,
  OctaveFrequency,
  clampSigned,
  computeOctaveNoise,
  normalizeNoise,
  octaveNoise2D,
  signedFbm2D,
} from '../src/domain/octaves'
import { createPerlinNoise2D } from '../src/domain/perlin'
import { mulberry32, NoiseSeed } from '../src/domain/seed'

const arbitrarySeed = FastCheck.integer({ min: 0, max: 4294967295 }).map((value) => NoiseSeed(value))
const arbitraryCoordinate = FastCheck.double({ min: -1024, max: 1024, noNaN: true, noDefaultInfinity: true })
const expectSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}
const octaveParams = (octaves: number, persistence: number, lacunarity: number) => ({
  octaves: OctaveCount(octaves),
  persistence: OctaveAmplitude(persistence),
  lacunarity: OctaveFrequency(lacunarity),
})

const kernelFor = (seed: number) => createPerlinNoise2D(mulberry32(NoiseSeed(seed)))

describe('octaveNoise2D', () => {
  effectTest('stays inside [0, 1] for every parameter combination the API permits', () =>
    Effect.sync(() => {
      FastCheck.assert(
        FastCheck.property(
          arbitrarySeed,
          arbitraryCoordinate,
          arbitraryCoordinate,
          FastCheck.integer({ min: 1, max: 16 }),
          // persistence >= 1 is included on purpose: dividing by the ACTUAL
          // amplitude sum rather than by the geometric-series limit is what
          // keeps the result bounded there, and that is the thing being pinned.
          FastCheck.double({ min: 0.1, max: 1.5, noNaN: true, noDefaultInfinity: true }),
          FastCheck.double({ min: 1.5, max: 3, noNaN: true, noDefaultInfinity: true }),
          (seed, x, z, octaves, persistence, lacunarity) => {
            const value = expectSuccess(octaveNoise2D(
              kernelFor(seed),
              PositionAxis(x),
              PositionAxis(z),
              octaveParams(octaves, persistence, lacunarity),
            ))
            return value >= 0 && value <= 1
          },
        ),
        { numRuns: 300 },
      )
    }),
  )

  effectTest('rejects invalid numeric parameters before entering the octave loop', () =>
    Effect.sync(() => {
      for (const octaves of [Number.NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        expect(Result.isFailure(OctaveCount.result(octaves))).toBe(true)
      }
      expect(Result.isFailure(OctaveAmplitude.result(Number.NaN))).toBe(true)
      expect(Result.isFailure(OctaveFrequency.result(Number.POSITIVE_INFINITY))).toBe(true)
      expect(Result.isFailure(NoiseAccumulator.result(Number.NaN))).toBe(true)
    }),
  )

  effectTest('returns a typed failure when a sampler produces a non-normalizable value', () =>
    Effect.sync(() => {
      const invalidNamed = octaveNoise2D(
        () => Number.NaN,
        PositionAxis(0),
        PositionAxis(0),
        octaveParams(1, 0.5, 2),
      )
      const invalidPositional = computeOctaveNoise(
        () => Number.NaN,
        PositionAxis(0),
        PositionAxis(0),
        OctaveCount(1),
        OctaveAmplitude(0.5),
        OctaveFrequency(2),
      )
      expect(Result.isFailure(invalidNamed)).toBe(true)
      expect(Result.isFailure(invalidPositional)).toBe(true)
    }),
  )

  effectTest('returns the midpoint 0.5 for a degenerate octave count, never the extreme 0', () =>
    Effect.sync(() => {
      // 0 would be indistinguishable from a real trough downstream. The
      // reference implementation returns 0 here; this repository does not.
      // See docs/design-notes.md.
      for (const octaves of [0, -1, -100]) {
        expect(
          expectSuccess(octaveNoise2D(
            kernelFor(1),
            PositionAxis(1.5),
            PositionAxis(2.5),
            octaveParams(octaves, 0.5, 2),
          )),
        ).toBe(0.5)
      }
    }),
  )

  effectTest('a constant kernel collapses to exactly the normalised constant, whatever the parameters', () =>
    Effect.sync(() => {
      // total/maxValue is the amplitude-weighted mean, so a constant input must
      // survive unchanged. This is the algebraic check that the accumulator and
      // the normaliser agree — the thing a "clever" rewrite of the loop breaks.
      const constant = 0.25
      for (const octaves of [1, 2, 5, 12]) {
        const value = expectSuccess(octaveNoise2D(
          () => constant,
          PositionAxis(0),
          PositionAxis(0),
          octaveParams(octaves, 0.5, 2),
        ))
        expect(value).toBeCloseTo(normalizeNoise(BoundedNoise(constant)), 12)
      }
    }),
  )

  effectTest('adding octaves changes the result — the loop really iterates', () =>
    Effect.sync(() => {
      const kernel = kernelFor(7)
      const values = [1, 2, 3, 4, 8].map((octaves) =>
        expectSuccess(octaveNoise2D(kernel, PositionAxis(3.25), PositionAxis(-8.75), octaveParams(octaves, 0.5, 2))),
      )
      expect(new Set(values).size).toBe(values.length)
    }),
  )
})

describe('signedFbm2D', () => {
  effectTest('stays signed and inside [-1, 1], because terrain splines are defined over [-1, 1]', () =>
    Effect.sync(() => {
      FastCheck.assert(
        FastCheck.property(arbitrarySeed, arbitraryCoordinate, arbitraryCoordinate, (seed, x, z) => {
          const sampler = signedFbm2D(kernelFor(seed), octaveParams(4, 0.5, 2))
          const value = sampler(x, z)
          return value >= -1 && value <= 1
        }),
        { numRuns: 200 },
      )
    }),
  )

  effectTest('actually produces negative values, so "signed" is not vacuously true', () =>
    Effect.sync(() => {
      const sampler = signedFbm2D(kernelFor(11), octaveParams(3, 0.5, 2))
      const samples = Array.from({ length: 512 }, (_unused, index) => sampler(index * 0.31, index * -0.17))
      expect(samples.some((value) => value < 0)).toBe(true)
      expect(samples.some((value) => value > 0)).toBe(true)
    }),
  )

  effectTest('degenerates to the constant 0 rather than to NaN when there are no octaves', () =>
    Effect.sync(() => {
      // amplitudeSum is 0 there, and 0/0 is NaN. A NaN escaping into terrain
      // generation produces a chunk of void that no test elsewhere explains.
      const sampler = signedFbm2D(kernelFor(3), octaveParams(0, 0.5, 2))
      expect(sampler(1.5, 2.5)).toBe(0)
      expect(Number.isNaN(sampler(0, 0))).toBe(false)
    }),
  )
})

describe('field-level range and continuity', () => {
  effectTest('noise2d and noise3d are normalised into [0, 1]; raw2d and raw3d are not', () =>
    Effect.sync(() => {
      FastCheck.assert(
        FastCheck.property(
          arbitrarySeed,
          arbitraryCoordinate,
          arbitraryCoordinate,
          arbitraryCoordinate,
          (seed, x, y, z) => {
            const field = createNoiseField(seed)
            const normalised2d = field.noise2d(x, z)
            const normalised3d = field.noise3d(x, y, z)
            return (
              normalised2d >= 0 &&
              normalised2d <= 1 &&
              normalised3d >= 0 &&
              normalised3d <= 1 &&
              Math.abs(field.raw2d(x, z)) <= 2 &&
              Math.abs(field.raw3d(x, y, z)) <= 3
            )
          },
        ),
        { numRuns: 300 },
      )
    }),
  )

  effectTest('is spatially continuous: a small step in x produces a small step in the value', () =>
    Effect.sync(() => {
      // Gradient noise is smooth by construction; this is the property that
      // fails first if the permutation lookup or the fade curve is wrong, and
      // it fails in a way that a range check would not notice.
      FastCheck.assert(
        FastCheck.property(arbitrarySeed, arbitraryCoordinate, arbitraryCoordinate, (seed, x, z) => {
          const field = createNoiseField(seed)
          return Math.abs(field.noise2d(x + 0.01, z) - field.noise2d(x, z)) < 0.1
        }),
        { numRuns: 300 },
      )
    }),
  )

  effectTest('clampSigned and normalizeNoise are the exact inverses they claim to be at the boundaries', () =>
    Effect.sync(() => {
      expect(normalizeNoise(BoundedNoise(-1))).toBe(0)
      expect(normalizeNoise(BoundedNoise(0))).toBe(0.5)
      expect(normalizeNoise(BoundedNoise(1))).toBe(1)
      expect(clampSigned(NoiseAccumulator(-5))).toBe(-1)
      expect(clampSigned(NoiseAccumulator(5))).toBe(1)
      expect(clampSigned(NoiseAccumulator(0.25))).toBe(0.25)
    }),
  )
})
