import { describe, expect } from 'vitest'
import { effectTest } from './effect-test'
import { Effect } from 'effect'
import { createPerlinNoise2D } from '../src/domain/perlin'
import { NoiseSeed, mulberry32 } from '../src/domain/seed'

const createNoise = (seed: number) => createPerlinNoise2D(mulberry32(NoiseSeed(seed)))

describe('createPerlinNoise2D', () => {
  effectTest('is deterministic and periodic over the 256-cell permutation table', () =>
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

  effectTest('stays in the documented practical signed range', () =>
    Effect.sync(() => {
      const noise = createNoise(42)
      let allFinite = true
      let minimum = Number.POSITIVE_INFINITY
      let maximum = Number.NEGATIVE_INFINITY

      for (let x = -32; x <= 32; x += 0.125) {
        for (let z = -32; z <= 32; z += 0.125) {
          const value = noise(x, z)
          allFinite &&= Number.isFinite(value)
          minimum = Math.min(minimum, value)
          maximum = Math.max(maximum, value)
        }
      }

      expect(allFinite).toBe(true)
      expect(minimum).toBeGreaterThanOrEqual(-1 - Number.EPSILON)
      expect(maximum).toBeLessThanOrEqual(1 + Number.EPSILON)
    }),
  )

  effectTest('avoids excessive half-integer zero collapse', () =>
    Effect.sync(() => {
      const noise = createNoise(20260726)
      const samples = Array.from({ length: 256 }, (_unused, index) =>
        noise(index + 0.5, index * 2 + 0.5),
      )
      const zeros = samples.filter((value) => value === 0).length
      expect(samples[0]).not.toBe(0)
      expect(zeros).toBeLessThan(40)
      expect(new Set(samples).size).toBeGreaterThan(40)
    }),
  )

  effectTest('has comparable variance along axes and diagonals', () =>
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
          sums[directionIndex]! += derivative * derivative
        })
      }
      const variances = sums.map((sum) => sum / 10_000)
      expect(Math.max(...variances) / Math.min(...variances)).toBeLessThan(1.15)
    }),
  )
})
