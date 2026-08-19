import { describe, expect, it } from 'vitest'
import { createSpline, evaluateSpline, type Spline } from '../src/domain/spline'

describe('piecewise-linear splines', () => {
  const spline = createSpline([
    [-1, 10],
    [0, 20],
    [2, 60],
  ])

  it('clamps outside the control-point range and interpolates inside it', () => {
    expect(evaluateSpline([], 4)).toBe(0)
    expect(evaluateSpline(spline, -2)).toBe(10)
    expect(evaluateSpline(spline, 3)).toBe(60)
    expect(evaluateSpline(spline, 0)).toBe(20)
    expect(evaluateSpline(spline, 1)).toBe(40)
    expect(evaluateSpline(spline, 1.5)).toBe(50)
  })

  it('supports a single control point', () => {
    const single = createSpline([[3, 8]])
    expect(evaluateSpline(single, 2)).toBe(8)
    expect(evaluateSpline(single, 4)).toBe(8)
  })

  it('returns frozen data with the original values', () => {
    expect(Object.isFrozen(spline)).toBe(true)
    expect(Object.isFrozen(spline[0])).toBe(true)
    expect(spline).toEqual([
      [-1, 10],
      [0, 20],
      [2, 60],
    ])
  })

  it('accepts an empty spline', () => {
    expect(createSpline([])).toEqual([])
  })

  it('rejects non-finite control-point coordinates and values', () => {
    expect(() => createSpline([[Number.NaN, 0]])).toThrow('spline[0][0] must be finite')
    expect(() => createSpline([[0, Number.POSITIVE_INFINITY]])).toThrow('spline[0][1] must be finite')
  })

  it('rejects non-increasing control-point coordinates', () => {
    expect(() => createSpline([[0, 0], [0, 1]])).toThrow(
      'spline input coordinates must be strictly increasing',
    )
    expect(() => createSpline([[1, 0], [0, 1]])).toThrow(
      'spline input coordinates must be strictly increasing',
    )
  })

  it('rejects non-finite evaluation inputs', () => {
    const evaluate = (input: number) => evaluateSpline(spline, input)
    expect(() => evaluate(Number.NaN)).toThrow('input must be finite')
    expect(() => evaluate(Number.NEGATIVE_INFINITY)).toThrow('input must be finite')
  })

  it('retains the public Spline shape for callers with static data', () => {
    const staticSpline: Spline = [[0, 0], [1, 1]]
    expect(evaluateSpline(staticSpline, 0.25)).toBe(0.25)
  })
})
