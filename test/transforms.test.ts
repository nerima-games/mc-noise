import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { peaksAndValleysFromWeirdness } from '../src/domain/transforms.js'

describe('noise transforms', () => {
  it.effect('matches the reference peaks-and-valleys mapping', () =>
    Effect.sync(() => {
      expect(peaksAndValleysFromWeirdness(0)).toBe(-1)
      expect(peaksAndValleysFromWeirdness(2 / 3)).toBe(1)
      expect(peaksAndValleysFromWeirdness(-2 / 3)).toBe(1)
    }),
  )

  it.effect('is symmetric around zero', () =>
    Effect.sync(() => {
      for (const weirdness of [-1, -0.75, -0.25, 0.25, 0.75, 1]) {
        expect(peaksAndValleysFromWeirdness(weirdness)).toBe(
          peaksAndValleysFromWeirdness(-weirdness),
        )
      }
    }),
  )
})
