import { Result } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  createJavaRandom,
  JavaRandomBound,
  JavaRandomDouble,
  JavaRandomInteger,
  JavaSkipCount,
  nextJavaInt,
} from '../src/domain/java-random.js'

const expectSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

describe('JavaRandom', () => {
  it('matches Java Random contracts for bounded and unbounded values', () => {
    // @ts-expect-error a non-bigint can still reach this JavaScript boundary
    const invalidSeed = createJavaRandom(0)
    expect(Result.isFailure(invalidSeed)).toBe(true)
    if (Result.isFailure(invalidSeed)) {
      expect(invalidSeed.failure).toBeInstanceOf(TypeError)
      expect(invalidSeed.failure.message).toBe('seed must be a bigint')
    }

    const random = expectSuccess(createJavaRandom(0n))
    expect(random.nextInt()).toBeGreaterThanOrEqual(-2147483648)
    expect(random.nextInt()).toBeLessThanOrEqual(2147483647)

    const eight = expectSuccess(JavaRandomBound.result(8))
    const seven = expectSuccess(JavaRandomBound.result(7))
    const value8 = expectSuccess(random.nextInt(eight))
    const value7 = expectSuccess(random.nextInt(seven))
    expect(value8).toBeGreaterThanOrEqual(0)
    expect(value8).toBeLessThan(8)
    expect(value7).toBeGreaterThanOrEqual(0)
    expect(value7).toBeLessThan(7)
    expect(random.nextDouble()).toBeGreaterThanOrEqual(0)
    expect(random.nextDouble()).toBeLessThan(1)
    random.skip(expectSuccess(JavaSkipCount.result(0)))
    random.skip(expectSuccess(JavaSkipCount.result(2)))
    const missingBound = random.nextInt(globalThis.undefined)
    expect(Result.isFailure(missingBound)).toBe(true)
    if (Result.isFailure(missingBound)) {
      expect(missingBound.failure).toBeInstanceOf(TypeError)
    }
  })

  it('validates bounds and retries rejected non-power-of-two samples', () => {
    for (const bound of [Number.NaN, 0, 2147483648]) {
      expect(Result.isFailure(JavaRandomBound.result(bound))).toBe(true)
    }

    let callCount = 0
    const values = [2147483647, 0]
    const bound = expectSuccess(JavaRandomBound.result(2147483647))
    const result = expectSuccess(nextJavaInt(bound, () => values[callCount++] ?? 0))
    expect(result).toBe(0)
    expect(callCount).toBe(2)
  })

  it('rejects invalid branded random outputs and injected bit-stream values', () => {
    expect(Result.isFailure(JavaRandomInteger.result(Number.NaN))).toBe(true)
    expect(Result.isFailure(JavaRandomInteger.result(-2_147_483_649))).toBe(true)
    expect(Result.isFailure(JavaRandomInteger.result(2_147_483_648))).toBe(true)
    expect(Result.isFailure(JavaRandomDouble.result(Number.NaN))).toBe(true)
    expect(Result.isFailure(JavaRandomDouble.result(-0.1))).toBe(true)
    expect(Result.isFailure(JavaRandomDouble.result(1))).toBe(true)
    expect(Result.isFailure(JavaSkipCount.result(1.5))).toBe(true)

    const powerOfTwo = expectSuccess(JavaRandomBound.result(1_073_741_824))
    const powerResult = nextJavaInt(powerOfTwo, () => 4_294_967_296)
    expect(Result.isFailure(powerResult)).toBe(true)

    const nonPowerOfTwo = expectSuccess(JavaRandomBound.result(7))
    const nonPowerResult = nextJavaInt(nonPowerOfTwo, () => Number.POSITIVE_INFINITY)
    expect(Result.isFailure(nonPowerResult)).toBe(true)
  })
})
