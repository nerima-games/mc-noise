import { Result } from 'effect'
import { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { describe, expect, it } from 'vitest'
import {
  END_ISLANDS_MAX_VALUE,
  END_ISLANDS_MIN_VALUE,
  createEndIslandsSampler,
} from '../src/domain/end-islands.js'

const unwrap = <Value, ErrorValue>(result: Result.Result<Value, ErrorValue>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

const SAMPLE_COORDINATES = [
  [-257, 193],
  [-33, -31],
  [-2, -1],
  [0, 0],
  [17, 29],
  [511, -389],
] as const

describe('End island density sampler', () => {
  it('preserves the fixed-seed simplex value mapping', () => {
    const sampler = unwrap(createEndIslandsSampler(0n))
    const values = SAMPLE_COORDINATES.map(([x, z]) =>
      unwrap(sampler.sample(BlockAxis(x), BlockAxis(z))),
    )

    expect(values).toEqual([
      -0.6181237697601318,
      -0.84375,
      0.5625,
      0.5625,
      -0.84375,
      0.2493494153022766,
    ])
  })

  it('is deterministic for a seed and changes with the seed', () => {
    const samples = unwrap(createEndIslandsSampler(0n))
    const sameSamples = unwrap(createEndIslandsSampler(0n))
    const otherSamples = unwrap(createEndIslandsSampler(1n))
    const values = SAMPLE_COORDINATES.map(([x, z]) =>
      unwrap(samples.sample(BlockAxis(x), BlockAxis(z))),
    )

    expect(values).toEqual(
      SAMPLE_COORDINATES.map(([x, z]) => unwrap(sameSamples.sample(BlockAxis(x), BlockAxis(z)))),
    )
    expect(values).not.toEqual(
      SAMPLE_COORDINATES.map(([x, z]) => unwrap(otherSamples.sample(BlockAxis(x), BlockAxis(z)))),
    )
  })

  it('keeps the official normalized range across negative and positive coordinates', () => {
    const sampler = unwrap(createEndIslandsSampler(42n))
    const values = SAMPLE_COORDINATES.flatMap(([x, z]) => [
      unwrap(sampler.sample(BlockAxis(x), BlockAxis(z))),
      unwrap(sampler.sample(BlockAxis(z), BlockAxis(x))),
    ])

    expect(values.every(Number.isFinite)).toBe(true)
    expect(values.every((value) => value >= END_ISLANDS_MIN_VALUE)).toBe(true)
    expect(values.every((value) => value <= END_ISLANDS_MAX_VALUE)).toBe(true)
    expect(values.some((value) => value > END_ISLANDS_MIN_VALUE)).toBe(true)
  })

  it('reports invalid seeds and block coordinates as Result failures', () => {
    expect(Result.isFailure(createEndIslandsSampler(0 as never))).toBe(true)

    const sampler = unwrap(createEndIslandsSampler(0n))
    expect(Result.isFailure(sampler.sample('0' as never, BlockAxis(0)))).toBe(true)
    expect(Result.isFailure(sampler.sample(0.5 as never, BlockAxis(0)))).toBe(true)
    expect(Result.isFailure(sampler.sample(BlockAxis(0), Number.POSITIVE_INFINITY as never))).toBe(true)
    expect(Result.isFailure(sampler.sample(Number.MAX_SAFE_INTEGER + 1 as never, BlockAxis(0)))).toBe(true)
  })
})
