/**
 * The single most important property this repository has.
 *
 * docs/versioning.md §5 declares the seed -> value interface frozen because a change to
 * it silently regenerates every saved world. "Frozen" is only meaningful if
 * "same seed produces the same value" is machine-checked, so that is what these
 * tests do — over random seeds and random coordinates, not over a handful of
 * hand-picked ones.
 *
 * Regression names (docs/design-notes.md):
 *   noise-determinism-same-seed
 *   noise-determinism-independent-fields
 *   noise-determinism-channel-decorrelation
 *   noise-determinism-required-prng
 */
import { describe, expect } from 'vitest'
import { effectTest } from './effect-test'
import { Effect, FastCheck } from 'effect'
import { createNoiseField } from '../src/domain/field'
import { NOISE_CHANNELS, NoiseSeed, deriveSeed, mulberry32 } from '../src/domain/seed'

/** Seeds across the whole uint32 range, including both boundaries. */
const arbitrarySeed = FastCheck.integer({ min: 0, max: 4294967295 }).map((value) => NoiseSeed(value))

/** Coordinates that straddle the origin and cross lattice cells. */
const arbitraryCoordinate = FastCheck.double({
  min: -4096,
  max: 4096,
  noNaN: true,
  noDefaultInfinity: true,
})

describe('determinism', () => {
  effectTest('same seed and same coordinate produce exactly the same value, bit for bit', () =>
    Effect.sync(() => {
      FastCheck.assert(
        FastCheck.property(arbitrarySeed, arbitraryCoordinate, arbitraryCoordinate, (seed, x, z) => {
          const first = createNoiseField(seed)
          const second = createNoiseField(seed)
          // Object.is rather than === so that a -0/0 discrepancy is a failure
          // and not a pass. A sign-of-zero difference is exactly the kind of
          // drift that survives === and then breaks a golden-value test.
          return Object.is(first.raw2d(x, z), second.raw2d(x, z))
        }),
        { numRuns: 300 },
      )
    }),
  )

  effectTest('determinism holds for the 3D kernel, the normalised wrappers and the octave stack too', () =>
    Effect.sync(() => {
      FastCheck.assert(
        FastCheck.property(
          arbitrarySeed,
          arbitraryCoordinate,
          arbitraryCoordinate,
          arbitraryCoordinate,
          (seed, x, y, z) => {
            const first = createNoiseField(seed)
            const second = createNoiseField(seed)
            return (
              Object.is(first.raw3d(x, y, z), second.raw3d(x, y, z)) &&
              Object.is(first.noise2d(x, z), second.noise2d(x, z)) &&
              Object.is(first.noise3d(x, y, z), second.noise3d(x, y, z)) &&
              Object.is(first.octave2d(x, z), second.octave2d(x, z))
            )
          },
        ),
        { numRuns: 200 },
      )
    }),
  )

  effectTest('every named channel is deterministic under its seed', () =>
    Effect.sync(() => {
      FastCheck.assert(
        FastCheck.property(arbitrarySeed, arbitraryCoordinate, arbitraryCoordinate, (seed, x, z) => {
          const first = createNoiseField(seed)
          const second = createNoiseField(seed)
          return NOISE_CHANNELS.every((name) => Object.is(first.channel(name)(x, z), second.channel(name)(x, z)))
        }),
        { numRuns: 100 },
      )
    }),
  )

  effectTest('two fields built from one seed do not share mutable state, so sampling order cannot matter', () =>
    Effect.sync(() => {
      const seed = NoiseSeed(20260726)
      const reference = createNoiseField(seed)
      const interleaved = createNoiseField(seed)

      const straight: Array<number> = []
      for (let step = 0; step < 64; step += 1) {
        straight.push(reference.raw2d(step * 0.37, step * -0.91))
      }

      // Sample the second field in a different order, then compare pointwise.
      const shuffled = new Map<number, number>()
      for (let step = 63; step >= 0; step -= 1) {
        shuffled.set(step, interleaved.raw2d(step * 0.37, step * -0.91))
      }

      for (let step = 0; step < 64; step += 1) {
        expect(shuffled.get(step)).toBe(straight[step])
      }
    }),
  )
})

describe('seed derivation', () => {
  effectTest('different seeds disagree somewhere — a constant field would pass every determinism test', () =>
    Effect.sync(() => {
      const left = createNoiseField(NoiseSeed(1))
      const right = createNoiseField(NoiseSeed(2))
      // Sampled off the integer lattice deliberately: Perlin noise is exactly 0
      // at every lattice point for every seed, so a grid of integers would
      // report spurious agreement and weaken the test.
      const disagreements = Array.from({ length: 256 }, (_unused, index) => index).filter((index) => {
        const x = index * 0.37 + 0.11
        const z = index * -0.23 + 0.29
        return left.raw2d(x, z) !== right.raw2d(x, z)
      })
      // Not 256/256: with a 256-entry permutation table two seeds occasionally
      // select the same gradient pair at one cell, so a handful of coincidental
      // agreements is correct behaviour rather than a leak. What would be a bug
      // is a LOW number, which is what this bound is guarding.
      expect(disagreements.length).toBeGreaterThan(250)
    }),
  )

  effectTest('channels derived from one seed are decorrelated, not adjacent streams', () =>
    Effect.sync(() => {
      const seed = NoiseSeed(0)
      const derived = NOISE_CHANNELS.map((name) => deriveSeed(seed, name))
      expect(new Set(derived).size).toBe(NOISE_CHANNELS.length)

      const field = createNoiseField(seed)
      const samples = NOISE_CHANNELS.map((name) => field.channel(name)(12.5, -7.25))
      expect(new Set(samples).size).toBe(NOISE_CHANNELS.length)
    }),
  )

  effectTest('a seed is a bit pattern: negative and out-of-uint32 inputs normalise rather than diverge', () =>
    Effect.sync(() => {
      const asNegative = createNoiseField(NoiseSeed(-1))
      const asUnsigned = createNoiseField(NoiseSeed(4294967295))
      expect(asNegative.raw2d(3.5, 9.5)).toBe(asUnsigned.raw2d(3.5, 9.5))
    }),
  )

  effectTest('rejects non-safe-integer seeds at the runtime boundary', () =>
    Effect.sync(() => {
      for (const invalidSeed of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5]) {
        expect(() => NoiseSeed(invalidSeed)).toThrow()
      }
    }),
  )

  effectTest('mulberry32 reproduces its stream exactly and advances its state', () =>
    Effect.sync(() => {
      const first = mulberry32(NoiseSeed(42))
      const second = mulberry32(NoiseSeed(42))
      const drawnFirst = Array.from({ length: 32 }, () => first())
      const drawnSecond = Array.from({ length: 32 }, () => second())
      expect(drawnFirst).toStrictEqual(drawnSecond)
      expect(new Set(drawnFirst).size).toBeGreaterThan(30)
      for (const value of drawnFirst) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(1)
      }
    }),
  )

  effectTest('matches the standard Mulberry32 reference vector', () =>
    Effect.sync(() => {
      const random = mulberry32(NoiseSeed(42))
      expect([random(), random(), random()]).toStrictEqual([
        0.6011037519201636,
        0.44829055899754167,
        0.8524657934904099,
      ])
    }),
  )
})
