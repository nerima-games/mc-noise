/**
 * The permutation table, and the seed normalisation that feeds it.
 *
 * ---------------------------------------------------------------------------
 * Why these need their own tests, when the goldens already pass
 * ---------------------------------------------------------------------------
 *
 * `buildPermutation` had its NAME pinned in test/public-api.test.ts and nothing
 * else. That is a gap with a nasty shape: the `?? 0` fallbacks in the swap
 * (domain/perlin.ts) turn an out-of-range index into a silent write of 0, so a
 * table that is no longer a bijection — one value duplicated, another missing —
 * is produced without an error, without a throw and without a type complaint.
 *
 * The damage is invisible from every test that exists. Every golden in
 * test/public-api.test.ts still matches, because the goldens are whatever the
 * table produces; determinism still holds, because the corruption is a pure
 * function of the seed. The failure surfaces as terrain that is subtly worse
 * everywhere — a duplicated gradient index means two lattice cells that should
 * be independent now agree — and the first time anyone can SEE it is the day
 * the goldens are regenerated, at which point the goldens have already been
 * updated to bless it. So the bijection has to be asserted directly.
 *
 * `toUint32` is the same story one level down: it is the single point where a
 * caller's integer becomes a seed's bit pattern, and it was only ever exercised
 * through one indirect assertion in test/determinism.test.ts.
 */
import { describe, expect, it } from '@effect/vitest'
import { Effect, FastCheck } from 'effect'
import { PERMUTATION_SIZE, buildPermutation } from '../domain/perlin'
import { NOISE_CHANNELS, NoiseSeed, deriveSeed, mulberry32, toUint32 } from '../domain/seed'

const UINT32_MODULUS = 4294967296

/** Seeds across the whole uint32 range, including both boundaries. */
const arbitrarySeed = FastCheck.integer({ min: 0, max: 4294967295 }).map((value) => NoiseSeed(value))

describe('buildPermutation', () => {
  it.effect('is a bijection on 0..255: every value present, exactly once, for every seed', () =>
    Effect.sync(() => {
      // THE property. A Fisher-Yates that swaps out of range loses a value and
      // duplicates another, and the `?? 0` fallbacks swallow that without a
      // sound. Distinct-count is the cheapest airtight statement of it: 256
      // byte-valued entries with 256 distinct values can only be 0..255.
      FastCheck.assert(
        FastCheck.property(arbitrarySeed, (seed) => {
          const permutation = buildPermutation(mulberry32(seed))
          return permutation.length === PERMUTATION_SIZE && new Set(permutation).size === PERMUTATION_SIZE
        }),
        { numRuns: 300 },
      )
    }),
  )

  it.effect('spells out the bijection once, so a failure names the value that went missing', () =>
    Effect.sync(() => {
      // The property above reports "size 255 !== 256" and leaves the reader to
      // work out which entry was clobbered. This one hands it over.
      const permutation = buildPermutation(mulberry32(NoiseSeed(20260726)))
      const counts = new Map<number, number>()
      for (const value of permutation) {
        counts.set(value, (counts.get(value) ?? 0) + 1)
      }
      const missing = Array.from({ length: PERMUTATION_SIZE }, (_unused, value) => value).filter(
        (value) => (counts.get(value) ?? 0) !== 1,
      )
      expect(missing).toStrictEqual([])
    }),
  )

  it.effect('actually shuffles: the table is neither the identity nor the same for two seeds', () =>
    Effect.sync(() => {
      // A shuffle that never swaps is a perfect bijection and useless noise:
      // the permutation would be the identity, the gradient hash would be the
      // coordinate, and the terrain would be a fixed pattern for every world.
      // The bijection property alone cannot see that, so it is stated here.
      const first = buildPermutation(mulberry32(NoiseSeed(1)))
      const second = buildPermutation(mulberry32(NoiseSeed(2)))
      expect(first.every((value, index) => value === index)).toBe(false)
      expect(first.every((value, index) => value === second[index])).toBe(false)
    }),
  )

  it.effect('is a function of the PRNG stream alone, so one seed always builds one table', () =>
    Effect.sync(() => {
      FastCheck.assert(
        FastCheck.property(arbitrarySeed, (seed) => {
          const first = buildPermutation(mulberry32(seed))
          const second = buildPermutation(mulberry32(seed))
          return first.every((value, index) => value === second[index])
        }),
        { numRuns: 100 },
      )
    }),
  )
})

describe('toUint32', () => {
  it.effect('is exactly the mathematical modulo, for negatives and for values past 32 bits', () =>
    Effect.sync(() => {
      // A seed is a bit pattern, not a quantity (domain/seed.ts). Every caller
      // that hands us a hash, a timestamp or a negative constant depends on
      // this wrapping being total rather than on it happening to be in range.
      FastCheck.assert(
        FastCheck.property(
          FastCheck.integer({ min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }),
          (value) =>
            toUint32(NoiseSeed(value)) === ((value % UINT32_MODULUS) + UINT32_MODULUS) % UINT32_MODULUS,
        ),
        { numRuns: 500 },
      )
    }),
  )

  it.effect('pins the boundaries a wrap bug would land on', () =>
    Effect.sync(() => {
      expect(toUint32(NoiseSeed(0))).toBe(0)
      expect(toUint32(NoiseSeed(-1))).toBe(4294967295)
      expect(toUint32(NoiseSeed(4294967295))).toBe(4294967295)
      // One past the top wraps to the bottom rather than saturating: 2^32 and 0
      // are the same seed, which is what makes "wrapping is meaning-preserving"
      // a true statement rather than an aspiration.
      expect(toUint32(NoiseSeed(4294967296))).toBe(0)
      expect(toUint32(NoiseSeed(-4294967296))).toBe(0)
      expect(toUint32(NoiseSeed(Number.MAX_SAFE_INTEGER))).toBe(4294967295)
    }),
  )

  it.effect('leaves nothing outside uint32, which is what the PRNG state assumes', () =>
    Effect.sync(() => {
      // mulberry32 keeps its state in a uint32 and reseeds from `toUint32`. A
      // negative or oversized value reaching that state would change the stream
      // length and quietly re-roll every world built from that seed.
      FastCheck.assert(
        FastCheck.property(
          FastCheck.integer({ min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }),
          (value) => {
            const normalised = toUint32(NoiseSeed(value))
            return Number.isInteger(normalised) && normalised >= 0 && normalised < UINT32_MODULUS
          },
        ),
        { numRuns: 300 },
      )
    }),
  )

  it.effect('is applied on both sides of deriveSeed, so a channel seed is a uint32 too', () =>
    Effect.sync(() => {
      // A channel seed is the XOR of a normalised master seed and a salt, and
      // JavaScript's `^` yields a SIGNED 32-bit result. Four of the six salts
      // have their top bit set, so without the closing `>>> 0` a perfectly
      // ordinary seed produces a negative channel seed. That is not a crash:
      // it is a channel whose stream silently differs from the one every other
      // caller of the same seed gets. Quantified over channels because a single
      // hand-picked one can easily be a salt that happens to stay positive.
      FastCheck.assert(
        FastCheck.property(arbitrarySeed, FastCheck.constantFrom(...NOISE_CHANNELS), (seed, channel) => {
          const derived = deriveSeed(seed, channel)
          return derived >= 0 && derived < UINT32_MODULUS && toUint32(derived) === derived
        }),
        { numRuns: 200 },
      )

      // -1 and 4294967295 are one seed, so they are one channel seed too.
      expect(deriveSeed(NoiseSeed(-1), 'erosion')).toBe(deriveSeed(NoiseSeed(4294967295), 'erosion'))
    }),
  )
})
