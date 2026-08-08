import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { createIsotropicNoiseField, createNoiseField } from '../src/domain/field'
import { NOISE_CHANNELS, NoiseSeed, type NoiseChannel } from '../src/domain/seed'

const SAMPLE_COORDINATES = [
  [0.5, 0.5],
  [-12.5, 4096.5],
  [1_000_000.25, -1_000_000.75],
] as const

describe('createIsotropicNoiseField', () => {
  it.effect('is deterministic across every 2D field path', () =>
    Effect.sync(() => {
      const first = createIsotropicNoiseField(NoiseSeed(0xdecafbad))
      const second = createIsotropicNoiseField(NoiseSeed(0xdecafbad))

      for (const [x, z] of SAMPLE_COORDINATES) {
        expect(first.raw2d(x, z)).toBe(second.raw2d(x, z))
        expect(first.noise2d(x, z)).toBe(second.noise2d(x, z))
        expect(first.octave2d(x, z)).toBe(second.octave2d(x, z))
        for (const channel of NOISE_CHANNELS) {
          expect(first.channel(channel)(x, z)).toBe(second.channel(channel)(x, z))
        }
      }
    }),
  )

  it.effect('keeps finite samples and normalized output within their contracts', () =>
    Effect.sync(() => {
      for (let seed = 0; seed < 32; seed += 1) {
        const field = createIsotropicNoiseField(NoiseSeed(seed))
        for (const [x, z] of SAMPLE_COORDINATES) {
          expect(Number.isFinite(field.raw2d(x, z))).toBe(true)
          expect(field.noise2d(x, z)).toBeGreaterThanOrEqual(0)
          expect(field.noise2d(x, z)).toBeLessThanOrEqual(1)
          expect(Number.isFinite(field.octave2d(x, z))).toBe(true)
          for (const channel of NOISE_CHANNELS) {
            expect(Number.isFinite(field.channel(channel)(x, z))).toBe(true)
          }
        }
      }
    }),
  )

  it.effect('removes the legacy half-integer zero degeneracy from full fields', () =>
    Effect.sync(() => {
      const seed = NoiseSeed(20260726)
      const legacy = createNoiseField(seed)
      const isotropic = createIsotropicNoiseField(seed)
      const coordinates = Array.from({ length: 256 }, (_unused, index) => [index + 0.5, index * 2 + 0.5] as const)
      const legacyZeros = coordinates.filter(([x, z]) => legacy.raw2d(x, z) === 0).length
      const isotropicZeros = coordinates.filter(([x, z]) => isotropic.raw2d(x, z) === 0).length

      expect(legacyZeros).toBeGreaterThan(40)
      expect(isotropicZeros).toBeLessThan(legacyZeros / 2)
    }),
  )

  it.effect('does not alter the legacy seed-to-value mapping', () =>
    Effect.sync(() => {
      const field = createNoiseField(NoiseSeed(20260726))
      expect(field.raw2d(12.37, -7.13)).toBe(0.20774690518930813)
      expect(field.channel('erosion')(100.37, 200.13)).toBe(0.2726603117072621)
    }),
  )

  it.effect('falls back to the neutral signed value for a channel name outside NOISE_CHANNELS', () =>
    Effect.sync(() => {
      // `channel`'s type restricts callers to `NoiseChannel`, but that boundary
      // is a TypeScript-only guarantee: a caller who computes a channel name
      // dynamically (e.g. from external config) and passes it through a cast
      // is not excluded by the type system the way an out-of-range permutation
      // index is, so this fallback is genuinely reachable and worth testing
      // rather than deleting. It is shared by both field constructors since
      // both go through `createNoiseFieldWith2DKernel`.
      const outOfDomain = 'not-a-real-channel' as unknown as NoiseChannel
      const legacy = createNoiseField(NoiseSeed(20260726))
      const isotropic = createIsotropicNoiseField(NoiseSeed(20260726))

      expect(legacy.channel(outOfDomain)(0, 0)).toBe(0)
      expect(legacy.channel(outOfDomain)(123.45, -67.89)).toBe(0)
      expect(isotropic.channel(outOfDomain)(123.45, -67.89)).toBe(0)
    }),
  )
})
