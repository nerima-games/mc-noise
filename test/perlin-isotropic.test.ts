import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { createPerlinNoise2D, createPerlinNoise2DIsotropic } from '../src/domain/perlin'
import { NoiseSeed, mulberry32 } from '../src/domain/seed'

const createNoise = (seed: number) => createPerlinNoise2DIsotropic(mulberry32(NoiseSeed(seed)))

describe('createPerlinNoise2DIsotropic', () => {
  it.effect('is deterministic and periodic over the 256-cell permutation table', () =>
    Effect.sync(() => {
      const first = createNoise(20260801)
      const second = createNoise(20260801)
      for (let index = 0; index < 128; index += 1) {
        const x = index * 0.371 - 19.25
        const z = index * -0.613 + 7.75
        expect(first(x, z)).toBe(second(x, z))
        expect(first(x + 256, z)).toBeCloseTo(first(x, z), 11)
        expect(first(x, z - 256)).toBeCloseTo(first(x, z), 11)
      }
    }),
  )

  it.effect('stays in the documented practical signed range', () =>
    Effect.sync(() => {
      const noise = createNoise(42)
      for (let x = -32; x <= 32; x += 0.125) {
        for (let z = -32; z <= 32; z += 0.125) {
          const value = noise(x, z)
          expect(Number.isFinite(value)).toBe(true)
          expect(value).toBeGreaterThanOrEqual(-1 - Number.EPSILON)
          expect(value).toBeLessThanOrEqual(1 + Number.EPSILON)
        }
      }
    }),
  )

  it.effect('does not collapse half-integer samples onto zero', () =>
    Effect.sync(() => {
      const noise = createNoise(20260726)
      const legacy = createPerlinNoise2D(mulberry32(NoiseSeed(20260726)))
      const samples = Array.from({ length: 256 }, (_unused, index) =>
        noise(index + 0.5, index * 2 + 0.5),
      )
      const legacyZeros = Array.from({ length: 256 }, (_unused, index) =>
        legacy(index + 0.5, index * 2 + 0.5),
      ).filter((value) => value === 0).length
      const isotropicZeros = samples.filter((value) => value === 0).length
      const legacyUniqueValues = new Set(
        Array.from({ length: 256 }, (_unused, index) => legacy(index + 0.5, index * 2 + 0.5)),
      ).size
      expect(samples[0]).not.toBe(0)
      expect(isotropicZeros).toBeLessThan(legacyZeros / 2)
      expect(new Set(samples).size).toBeGreaterThan(legacyUniqueValues * 5)
    }),
  )

  it.effect('has comparable variance along axes and diagonals', () =>
    Effect.sync(() => {
      const noise = createNoise(0xdecafbad)
      const directions = [
        [1, 0],
        [0, 1],
        [Math.SQRT1_2, Math.SQRT1_2],
        [Math.SQRT1_2, -Math.SQRT1_2],
      ] as const
      const sums = directions.map(() => 0)
      const step = 0.001
      let randomState = 123456789
      const random = (): number => {
        randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
        return randomState / 2 ** 32
      }
      for (let index = 0; index < 10_000; index += 1) {
        const x = random() * 256
        const z = random() * 256
        directions.forEach(([dx, dz], directionIndex) => {
          const derivative =
            (noise(x + step * dx, z + step * dz) - noise(x - step * dx, z - step * dz)) /
            (2 * step)
          sums[directionIndex] = sums[directionIndex]! + derivative * derivative
        })
      }
      const variances = sums.map((sum) => sum / 10_000)
      expect(Math.max(...variances) / Math.min(...variances)).toBeLessThan(1.15)
    }),
  )
})
