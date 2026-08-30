import { describe, expect } from 'vitest'
import { effectTest } from './effect-test'
import { Effect } from 'effect'
import { createNoiseField } from '../src/domain/field'
import { NOISE_CHANNELS, NoiseSeed, type NoiseChannel } from '../src/domain/seed'

const SAMPLE_COORDINATES = [
  [0.5, 0.5],
  [-12.5, 4096.5],
  [1_000_000.25, -1_000_000.75],
] as const

describe('createNoiseField', () => {
  effectTest('is deterministic across every 2D field path', () =>
    Effect.sync(() => {
      const first = createNoiseField(NoiseSeed(0xdecafbad))
      const second = createNoiseField(NoiseSeed(0xdecafbad))

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

  effectTest('keeps finite samples and normalized output within their contracts', () =>
    Effect.sync(() => {
      for (let seed = 0; seed < 32; seed += 1) {
        const field = createNoiseField(NoiseSeed(seed))
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

  effectTest('keeps normalized 3D samples within the unit interval', () =>
    Effect.sync(() => {
      const sampleHeights = [-31.5, -7.13, 0.25, 42.75]

      for (let seed = 0; seed < 32; seed += 1) {
        const field = createNoiseField(NoiseSeed(seed))
        for (const [x, z] of SAMPLE_COORDINATES) {
          for (const y of sampleHeights) {
            const sample = field.noise3d(x, y, z)
            expect(Number.isFinite(sample)).toBe(true)
            expect(sample).toBeGreaterThanOrEqual(0)
            expect(sample).toBeLessThanOrEqual(1)
          }
        }
      }
    }),
  )

  effectTest('avoids excessive half-integer zero collapse in full fields', () =>
    Effect.sync(() => {
      const field = createNoiseField(NoiseSeed(20260726))
      const coordinates = Array.from({ length: 256 }, (_unused, index) => [index + 0.5, index * 2 + 0.5] as const)
      const samples = coordinates.map(([x, z]) => field.raw2d(x, z))
      const zeros = samples.filter((value) => value === 0).length

      expect(zeros).toBeLessThan(40)
      expect(new Set(samples).size).toBeGreaterThan(40)
    }),
  )

  effectTest('keeps the 3D field mapping stable', () =>
    Effect.sync(() => {
      const field = createNoiseField(NoiseSeed(20260726))

      expect(field.raw3d(12.37, -7.13, 4.25)).toBe(-0.039941847301443775)
    }),
  )

  effectTest('pins the canonical seed-to-value mapping', () =>
    Effect.sync(() => {
      const field = createNoiseField(NoiseSeed(20260726))
      expect(field.raw2d(12.37, -7.13)).toBe(0.15995536869657265)
      expect(field.channel('erosion')(100.37, 200.13)).toBe(0.0028109265851947052)
    }),
  )

  effectTest('falls back to the neutral signed value for a channel name outside NOISE_CHANNELS', () =>
    Effect.sync(() => {
      // `channel`'s type restricts callers to `NoiseChannel`, but that boundary
      // is a TypeScript-only guarantee: a caller who computes a channel name
      // dynamically (e.g. from external config) and passes it through a cast
      // is not excluded by the type system the way an out-of-range permutation
      // index is, so this fallback is genuinely reachable and worth testing
      // rather than deleting. It is shared by every channel in the field.
      const outOfDomain = 'not-a-real-channel' as unknown as NoiseChannel
      const field = createNoiseField(NoiseSeed(20260726))

      expect(field.channel(outOfDomain)(0, 0)).toBe(0)
      expect(field.channel(outOfDomain)(123.45, -67.89)).toBe(0)
    }),
  )
})
