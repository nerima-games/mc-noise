import { describe, expect, it } from 'vitest'
import {
  densityConstant,
  isDensityFunction,
  requireDensityFunction,
} from '../src/index.js'

describe('DensityFunction structural validation', () => {
  it('accepts valid density bounds and rejects malformed values', () => {
    const valid = densityConstant(2)

    expect(isDensityFunction(valid)).toBe(true)
    expect(isDensityFunction({ kind: 'constant', minValue: 0, maxValue: 1 })).toBe(true)
    expect(isDensityFunction(null)).toBe(false)
    expect(isDensityFunction(1)).toBe(false)
    expect(isDensityFunction({})).toBe(false)
    expect(isDensityFunction({ kind: 'unknown', minValue: 0, maxValue: 1 })).toBe(false)
    expect(isDensityFunction({ kind: 'constant', minValue: '0', maxValue: 1 })).toBe(false)
    expect(isDensityFunction({ kind: 'constant', minValue: 0, maxValue: '1' })).toBe(false)
    expect(isDensityFunction({ kind: 'constant', minValue: Number.NaN, maxValue: 1 })).toBe(false)
    expect(isDensityFunction({ kind: 'constant', minValue: 0, maxValue: Number.NaN })).toBe(false)
    expect(isDensityFunction({ kind: 'constant', minValue: 2, maxValue: 1 })).toBe(false)
    expect(requireDensityFunction('density', valid)).toBe(valid)
    expect(() => requireDensityFunction('density', null)).toThrow(
      'density must be a DensityFunction',
    )
  })
})
