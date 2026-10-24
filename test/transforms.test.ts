import { describe, expect } from 'vitest'
import { effectTest } from './effect-test'
import { Effect } from 'effect'
import { peaksAndValleysFromWeirdness } from '../src/domain/transforms.js'
import { BoundedNoise } from '../src/domain/octaves.js'

describe('noise transforms', () => {
  effectTest('matches the reference peaks-and-valleys mapping', () =>
    Effect.sync(() => {
      expect(peaksAndValleysFromWeirdness(BoundedNoise(0))).toBe(-1)
      expect(peaksAndValleysFromWeirdness(BoundedNoise(2 / 3))).toBe(1)
      expect(peaksAndValleysFromWeirdness(BoundedNoise(-2 / 3))).toBe(1)
    }),
  )

  effectTest('is symmetric around zero', () =>
    Effect.sync(() => {
      for (const weirdness of [-1, -0.75, -0.25, 0.25, 0.75, 1]) {
        expect(peaksAndValleysFromWeirdness(BoundedNoise(weirdness))).toBe(
          peaksAndValleysFromWeirdness(BoundedNoise(-weirdness)),
        )
      }
    }),
  )
})
