import { describe, expect, it } from 'vitest'
import { createJavaRandom, nextJavaInt } from '../src/domain/java-random.js'

describe('JavaRandom', () => {
  it('matches Java Random contracts for bounded and unbounded values', () => {
    expect(() => createJavaRandom(0 as never)).toThrow('seed must be a bigint')

    const random = createJavaRandom(0n)
    expect(random.nextInt()).toBeGreaterThanOrEqual(-2147483648)
    expect(random.nextInt()).toBeLessThanOrEqual(2147483647)
    expect(random.nextInt(8)).toBeGreaterThanOrEqual(0)
    expect(random.nextInt(8)).toBeLessThan(8)
    expect(random.nextInt(7)).toBeGreaterThanOrEqual(0)
    expect(random.nextInt(7)).toBeLessThan(7)
    expect(random.nextDouble()).toBeGreaterThanOrEqual(0)
    expect(random.nextDouble()).toBeLessThan(1)
    random.skip(0)
    random.skip(2)
  })

  it('validates bounds and retries rejected non-power-of-two samples', () => {
    const nextBits = (): number => 0
    expect(() => nextJavaInt(Number.NaN, nextBits)).toThrow(
      'bound must be a positive signed 32-bit integer',
    )
    expect(() => nextJavaInt(0, nextBits)).toThrow(
      'bound must be a positive signed 32-bit integer',
    )
    expect(() => nextJavaInt(2147483648, nextBits)).toThrow(
      'bound must be a positive signed 32-bit integer',
    )
    let callCount = 0
    const values = [2147483647, 0]
    const result = nextJavaInt(2147483647, () => values[callCount++] ?? 0)
    expect(result).toBe(0)
    expect(callCount).toBe(2)
  })
})
