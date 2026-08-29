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
import { Effect, FastCheck } from 'effect'
import { createNoiseField } from '../src/domain/field'
import { clampSigned, normalizeNoise, octaveNoise2D, signedFbm2D } from '../src/domain/octaves'
import { createPerlinNoise2D } from '../src/domain/perlin'
import { mulberry32, NoiseSeed } from '../src/domain/seed'

const arbitrarySeed = FastCheck.integer({ min: 0, max: 4294967295 }).map((value) => NoiseSeed(value))
const arbitraryCoordinate = FastCheck.double({ min: -1024, max: 1024, noNaN: true, noDefaultInfinity: true })

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
            const value = octaveNoise2D(kernelFor(seed), x, z, { octaves, persistence, lacunarity })
            return value >= 0 && value <= 1
          },
        ),
        { numRuns: 300 },
      )
    }),
  )

  effectTest('rejects invalid numeric parameters before entering the octave loop', () =>
    Effect.sync(() => {
      const invalidParams = [
        { octaves: Number.NaN, persistence: 0.5, lacunarity: 2 },
        { octaves: 1.5, persistence: 0.5, lacunarity: 2 },
        { octaves: Number.MAX_SAFE_INTEGER + 1, persistence: 0.5, lacunarity: 2 },
        { octaves: 1, persistence: Number.NaN, lacunarity: 2 },
        { octaves: 1, persistence: 0.5, lacunarity: Number.POSITIVE_INFINITY },
      ]

      for (const params of invalidParams) {
        expect(() => octaveNoise2D(() => 0, 0, 0, params)).toThrow(RangeError)
      }
      expect(() => signedFbm2D(() => 0, invalidParams[0]!)).toThrow(RangeError)
    }),
  )

  effectTest('returns the midpoint 0.5 for a degenerate octave count, never the extreme 0', () =>
    Effect.sync(() => {
      // 0 would be indistinguishable from a real trough downstream. The
      // reference implementation returns 0 here; this repository does not.
      // See docs/design-notes.md.
      for (const octaves of [0, -1, -100]) {
        expect(octaveNoise2D(kernelFor(1), 1.5, 2.5, { octaves, persistence: 0.5, lacunarity: 2 })).toBe(0.5)
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
        const value = octaveNoise2D(() => constant, 0, 0, { octaves, persistence: 0.5, lacunarity: 2 })
        expect(value).toBeCloseTo(normalizeNoise(constant), 12)
      }
    }),
  )

  effectTest('adding octaves changes the result — the loop really iterates', () =>
    Effect.sync(() => {
      const kernel = kernelFor(7)
      const values = [1, 2, 3, 4, 8].map((octaves) =>
        octaveNoise2D(kernel, 3.25, -8.75, { octaves, persistence: 0.5, lacunarity: 2 }),
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
          const sampler = signedFbm2D(kernelFor(seed), { octaves: 4, persistence: 0.5, lacunarity: 2 })
          const value = sampler(x, z)
          return value >= -1 && value <= 1
        }),
        { numRuns: 200 },
      )
    }),
  )

  effectTest('actually produces negative values, so "signed" is not vacuously true', () =>
    Effect.sync(() => {
      const sampler = signedFbm2D(kernelFor(11), { octaves: 3, persistence: 0.5, lacunarity: 2 })
      const samples = Array.from({ length: 512 }, (_unused, index) => sampler(index * 0.31, index * -0.17))
      expect(samples.some((value) => value < 0)).toBe(true)
      expect(samples.some((value) => value > 0)).toBe(true)
    }),
  )

  effectTest('degenerates to the constant 0 rather than to NaN when there are no octaves', () =>
    Effect.sync(() => {
      // amplitudeSum is 0 there, and 0/0 is NaN. A NaN escaping into terrain
      // generation produces a chunk of void that no test elsewhere explains.
      const sampler = signedFbm2D(kernelFor(3), { octaves: 0, persistence: 0.5, lacunarity: 2 })
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
      expect(normalizeNoise(-1)).toBe(0)
      expect(normalizeNoise(0)).toBe(0.5)
      expect(normalizeNoise(1)).toBe(1)
      expect(clampSigned(-5)).toBe(-1)
      expect(clampSigned(5)).toBe(1)
      expect(clampSigned(0.25)).toBe(0.25)
    }),
  )
})
