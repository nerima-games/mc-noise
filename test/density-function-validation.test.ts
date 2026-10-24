import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import {
  DensityFunctionFieldName,
  densityConstant,
  isDensityFunction,
  requireDensityFunction,
} from '../src/index.js'
import {
  densityValue,
  expectDensitySuccess,
  expectResultFailure,
} from './density-function-test-utils.js'

describe('DensityFunction structural validation', () => {
  it('accepts valid density bounds and rejects malformed values', () => {
    const valid = expectDensitySuccess(densityConstant(densityValue(2)))

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
    expect(isDensityFunction({ kind: 'find-top-surface', minValue: -1, maxValue: 1 })).toBe(true)
    expect(expectDensitySuccess(requireDensityFunction(DensityFunctionFieldName('density'), valid))).toBe(valid)
    expect(Result.isFailure(DensityFunctionFieldName.result(''))).toBe(true)
    expect(
      expectResultFailure(requireDensityFunction('' as never, null)).message,
    ).toBe('density function field name must not be empty')
    expect(expectResultFailure(requireDensityFunction(DensityFunctionFieldName('density'), null)).message).toBe(
      'density must be a DensityFunction',
    )
  })
})
