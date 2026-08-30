import { describe, expect, it } from 'vitest'
import {
  END_ISLANDS_MAX_VALUE,
  END_ISLANDS_MIN_VALUE,
  createEndIslandsSampler,
} from '../src/domain/end-islands.js'

const SAMPLE_COORDINATES = [
  [-257, 193],
  [-33, -31],
  [-2, -1],
  [0, 0],
  [17, 29],
  [511, -389],
] as const

describe('End island density sampler', () => {
  it('is deterministic for a seed and changes with the seed', () => {
    const samples = createEndIslandsSampler(0n)
    const sameSamples = createEndIslandsSampler(0n)
    const otherSamples = createEndIslandsSampler(1n)
    const values = SAMPLE_COORDINATES.map(([x, z]) => samples.sample(x, z))

    expect(values).toEqual(
      SAMPLE_COORDINATES.map(([x, z]) => sameSamples.sample(x, z)),
    )
    expect(values).not.toEqual(
      SAMPLE_COORDINATES.map(([x, z]) => otherSamples.sample(x, z)),
    )
  })

  it('keeps the official normalized range across negative and positive coordinates', () => {
    const sampler = createEndIslandsSampler(42n)
    const values = SAMPLE_COORDINATES.flatMap(([x, z]) => [
      sampler.sample(x, z),
      sampler.sample(z, x),
    ])

    expect(values.every(Number.isFinite)).toBe(true)
    expect(values.every(value => value >= END_ISLANDS_MIN_VALUE)).toBe(true)
    expect(values.every(value => value <= END_ISLANDS_MAX_VALUE)).toBe(true)
    expect(values.some(value => value > END_ISLANDS_MIN_VALUE)).toBe(true)
  })

  it('rejects non-bigint seeds and non-integral sample coordinates', () => {
    expect(() => createEndIslandsSampler(0 as never)).toThrow(
      'seed must be a bigint',
    )

    const sampler = createEndIslandsSampler(0n)
    expect(() => sampler.sample(0.5, 0)).toThrow(
      'x must be a safe integer',
    )
    expect(() => sampler.sample(0, Number.POSITIVE_INFINITY)).toThrow(
      'z must be a safe integer',
    )
    expect(() => sampler.sample(2147483648, 0)).toThrow(
      'x must be a signed 32-bit integer',
    )
    expect(() => sampler.sample(0, -2147483649)).toThrow(
      'z must be a signed 32-bit integer',
    )
  })
})
