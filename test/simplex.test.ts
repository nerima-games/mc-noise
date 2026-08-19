import { describe, expect, it } from 'vitest'
import { createSimplexNoise2D, createSimplexNoise3D } from '../src/domain/simplex.js'
import { NoiseSeed, mulberry32 } from '../src/domain/seed.js'

describe('simplex noise primitives', () => {
  it('is deterministic for the same seed and changes with the seed', () => {
    const samples2D = [
      [0.125, -0.375],
      [1.25, 2.5],
      [-3.75, 4.125],
    ] as const
    const samples3D = [
      [0.125, 0.25, 0.375],
      [1.25, 2.5, -3.75],
      [-3.75, 4.125, 2.25],
    ] as const
    const noise2D = createSimplexNoise2D(mulberry32(NoiseSeed(42)))
    const sameNoise2D = createSimplexNoise2D(mulberry32(NoiseSeed(42)))
    const otherNoise2D = createSimplexNoise2D(mulberry32(NoiseSeed(43)))
    const noise3D = createSimplexNoise3D(mulberry32(NoiseSeed(42)))
    const sameNoise3D = createSimplexNoise3D(mulberry32(NoiseSeed(42)))
    const otherNoise3D = createSimplexNoise3D(mulberry32(NoiseSeed(43)))

    expect(samples2D.map(([x, z]) => noise2D(x, z))).toEqual(
      samples2D.map(([x, z]) => sameNoise2D(x, z)),
    )
    expect(samples3D.map(([x, y, z]) => noise3D(x, y, z))).toEqual(
      samples3D.map(([x, y, z]) => sameNoise3D(x, y, z)),
    )
    expect(samples2D.map(([x, z]) => noise2D(x, z))).not.toEqual(
      samples2D.map(([x, z]) => otherNoise2D(x, z)),
    )
    expect(samples3D.map(([x, y, z]) => noise3D(x, y, z))).not.toEqual(
      samples3D.map(([x, y, z]) => otherNoise3D(x, y, z)),
    )
  })

  it('covers simplex cells, rank orderings, and finite tails', () => {
    const noise2D = createSimplexNoise2D(mulberry32(NoiseSeed(7)))
    const noise3D = createSimplexNoise3D(mulberry32(NoiseSeed(7)))
    const values2D = ([
      [0.1, 0.2],
      [0.2, 0.1],
      [-0.8, 0.7],
      [1.7, -2.4],
      [20.25, 20.75],
    ] as const).map(([x, z]) => noise2D(x, z))
    const grid2D = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]
    const gridValues2D = grid2D.flatMap(x => grid2D.map(z => noise2D(x, z)))
    const values3D = ([
      [0.1, 0.2, 0.3],
      [0.3, 0.2, 0.1],
      [0.3, 0.1, 0.2],
      [0.2, 0.3, 0.1],
      [0.1, 0.3, 0.2],
      [0.2, 0.1, 0.3],
      [-0.8, 0.7, 0.2],
      [20.25, 20.75, -20.5],
    ] as const).map(([x, y, z]) => noise3D(x, y, z))

    expect(values2D.every(Number.isFinite)).toBe(true)
    expect(gridValues2D.every(Number.isFinite)).toBe(true)
    expect(values3D.every(Number.isFinite)).toBe(true)
    expect(values2D.some(value => value !== 0)).toBe(true)
    expect(values3D.some(value => value !== 0)).toBe(true)
  })

  it('applies finite origins and rejects non-finite origins', () => {
    const base2D = createSimplexNoise2D(mulberry32(NoiseSeed(9)), {
      originX: 0,
      originZ: 0,
    })
    const shifted2D = createSimplexNoise2D(mulberry32(NoiseSeed(9)), {
      originX: 0.25,
      originZ: -0.5,
    })
    const base3D = createSimplexNoise3D(mulberry32(NoiseSeed(9)), {
      originX: 0,
      originY: 0,
      originZ: 0,
    })
    const shifted3D = createSimplexNoise3D(mulberry32(NoiseSeed(9)), {
      originX: 0.25,
      originY: -0.5,
      originZ: 0.75,
    })

    expect(shifted2D(0.4, -0.7)).toBe(base2D(0.65, -1.2))
    expect(shifted3D(0.4, -0.7, 0.9)).toBe(base3D(0.65, -1.2, 1.65))
    expect(() => createSimplexNoise2D(mulberry32(NoiseSeed(9)), { originX: Number.NaN })).toThrow(
      'originX must be finite',
    )
    expect(() => createSimplexNoise3D(mulberry32(NoiseSeed(9)), { originY: Infinity })).toThrow(
      'originY must be finite',
    )
  })

  it('uses randomized origins before building the permutation', () => {
    const createSequenceRandom = () => {
      let index = 0
      return () => {
        let value = 0
        if (index < 3) {
          value = 0.25
        }
        index += 1
        return value
      }
    }

    const randomizedOrigins = createSimplexNoise2D(createSequenceRandom())
    const explicitOrigins = createSimplexNoise2D(createSequenceRandom(), {
      originX: 64,
      originZ: 64,
    })

    expect(randomizedOrigins(0.4, -0.7)).toBe(explicitOrigins(0.4, -0.7))
  })
})
