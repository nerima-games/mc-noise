import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createPerlinNoise2D, createPerlinNoise3D } from '../src/domain/perlin'
import { gradient2d, gradient3d } from '../src/domain/perlin-gradients'
import { NoiseSeed, mulberry32 } from '../src/domain/seed'

const fixture: {
  points: [number, number, number][]
  seeds: { seed: number; bits: string[][] }[]
  gradient2d: string[][]
  gradient3d: string[][]
} = JSON.parse(readFileSync(new URL('./fixtures/perlin-bit-parity.json', import.meta.url), 'utf8'))

const float64Bits = (value: number): string => {
  const bytes = new DataView(new ArrayBuffer(8))
  bytes.setFloat64(0, value)
  return bytes.getBigUint64(0).toString(16).padStart(16, '0')
}

describe('Perlin output bits captured before the hot path change', () => {
  for (const sample of fixture.seeds) {
    it(`preserves 2D and 3D samples for seed ${sample.seed}`, () => {
      const noise2d = createPerlinNoise2D(mulberry32(NoiseSeed(sample.seed)))
      const noise3d = createPerlinNoise3D(mulberry32(NoiseSeed(sample.seed)))
      expect(fixture.points).toHaveLength(1024)
      const actual = fixture.points.map(([x, y, z]) => [
        float64Bits(noise2d(x, z)),
        float64Bits(noise3d(x, y, z)),
      ])
      expect(actual).toEqual(sample.bits)
    })
  }

  it('preserves every 2D gradient hash including signed zero', () => {
    const coordinates = [-1, -0, 0, 0.25, 1]
    const actual = Array.from({ length: 8 }, (_, hash) =>
      coordinates.flatMap((x) => coordinates.map((z) => float64Bits(gradient2d(hash, x, z)))),
    )
    expect(actual).toEqual(fixture.gradient2d)
  })

  it('preserves every 3D gradient hash including signed zero', () => {
    const coordinates = [-1, -0, 0, 0.25, 1]
    const actual = Array.from({ length: 16 }, (_, hash) =>
      coordinates.flatMap((x) => coordinates.flatMap((y) =>
        coordinates.map((z) => float64Bits(gradient3d(hash, x, y, z))),
      )),
    )
    expect(actual).toEqual(fixture.gradient3d)
  })
})
