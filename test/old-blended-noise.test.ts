import { describe, expect, it } from 'vitest'
import {
  createDensityOldBlendedNoiseSource,
  densityOldBlendedNoise,
  evaluateDensityFunction,
} from '../src/index.js'

const bounds = { minValue: -4, maxValue: 4 }
const options = {
  smearScaleMultiplier: 4,
  xzFactor: 2,
  xzScale: 1,
  yFactor: 2,
  yScale: 1,
}

const createOctave = (
  value: number,
  calls?: number[][],
) => ({
  sample: (x: number, y: number, z: number, yScale: number, yMax: number) => {
    calls?.push([x, y, z, yScale, yMax])
    return value
  },
})

const createZeroOctaveSource = (
  value: number,
  calls?: number[][],
) => {
  const octaves = [createOctave(value, calls)]
  return (octave: number) => octaves[octave]
}

const createSource = (mainValue: number) => createDensityOldBlendedNoiseSource(
  {
    mainNoise: createZeroOctaveSource(mainValue),
    maxLimitNoise: createZeroOctaveSource(4),
    minLimitNoise: createZeroOctaveSource(2),
  },
  bounds,
)

describe('old blended noise', () => {
  it('evaluates the three official octave stacks', () => {
    const calls: number[][] = []
    const source = createDensityOldBlendedNoiseSource(
      {
        mainNoise: createZeroOctaveSource(1, calls),
        maxLimitNoise: createZeroOctaveSource(4, calls),
        minLimitNoise: createZeroOctaveSource(2, calls),
      },
      bounds,
    )
    const density = densityOldBlendedNoise(source, options)

    expect(evaluateDensityFunction(density, { x: 0, y: 0, z: 0 })).toBeCloseTo(
      (2 / 512 + (4 / 512 - 2 / 512) * 0.55) / 128,
    )
    expect(calls).toHaveLength(3)
    expect(calls[0]?.[3]).toBeCloseTo(1368.824)
    expect(Object.isFrozen(source)).toBe(true)
    expect(Object.isFrozen(density)).toBe(true)
  })

  it('clamps the main blend and skips the irrelevant limit stack', () => {
    const lower = densityOldBlendedNoise(createSource(-20), options)
    const upper = densityOldBlendedNoise(createSource(20), options)

    expect(evaluateDensityFunction(lower, { x: 0, y: 0, z: 0 })).toBeCloseTo(2 / 512 / 128)
    expect(evaluateDensityFunction(upper, { x: 0, y: 0, z: 0 })).toBeCloseTo(4 / 512 / 128)
  })

  it('rejects invalid sources and options at construction', () => {
    expect(() => createDensityOldBlendedNoiseSource(null as never, bounds)).toThrow(
      'old blended noise source must be an object',
    )
    expect(() => densityOldBlendedNoise(null as never, options)).toThrow(
      'old blended noise source must be an object',
    )
    expect(() => createDensityOldBlendedNoiseSource({
      mainNoise: null as never,
      maxLimitNoise: () => 0 as never,
      minLimitNoise: () => 0 as never,
    }, bounds)).toThrow('old blended noise mainNoise must be a function')
    expect(() => createDensityOldBlendedNoiseSource({
      mainNoise: () => 0 as never,
      minLimitNoise: null as never,
      maxLimitNoise: () => 0 as never,
    }, bounds)).toThrow('old blended noise minLimitNoise must be a function')
    expect(() => createDensityOldBlendedNoiseSource({
      mainNoise: () => 0 as never,
      minLimitNoise: () => 0 as never,
      maxLimitNoise: null as never,
    }, bounds)).toThrow('old blended noise maxLimitNoise must be a function')
    expect(() => densityOldBlendedNoise(createSource(1), null as never)).toThrow(
      'old blended noise options must be an object',
    )
    expect(() => densityOldBlendedNoise(createSource(1), {
      ...options,
      yFactor: Number.NaN,
    })).toThrow('yFactor must be finite')
  })
})
