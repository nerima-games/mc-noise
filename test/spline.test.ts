import { Result } from 'effect'
import { describe, expect, it } from 'vitest'
import * as api from '../src/domain/spline.js'

const unwrap = <Value, ErrorValue>(result: Result.Result<Value, ErrorValue>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

const input = (value: number): api.SplineInput => unwrap(api.SplineInput.result(value))
const splineValue = (value: number): api.SplineValue => unwrap(api.SplineValue.result(value))
const createSpline = (points: readonly (readonly [number, number])[]): api.Spline =>
  unwrap(api.createSpline(points as never))
const evaluateSpline = (spline: api.Spline, value: number): api.SplineValue =>
  unwrap(api.evaluateSpline(spline, input(value)))

describe('piecewise-linear splines', () => {
  const spline = createSpline([
    [-1, 10],
    [0, 20],
    [2, 60],
  ])

  it('clamps outside the control-point range and interpolates inside it', () => {
    expect(evaluateSpline(createSpline([]), 4)).toBe(0)
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

  it('returns frozen branded control points', () => {
    expect(Object.isFrozen(spline)).toBe(true)
    expect(Object.isFrozen(spline[0])).toBe(true)
    expect(spline).toEqual([
      [input(-1), splineValue(10)],
      [input(0), splineValue(20)],
      [input(2), splineValue(60)],
    ])
  })

  it('accepts an empty spline and reports invalid controls with Result', () => {
    expect(unwrap(api.createSpline([]))).toEqual([])
    expect(Result.isFailure(api.createSpline(null as never))).toBe(true)
    expect(Result.isFailure(api.createSpline([[0]] as never))).toBe(true)
    expect(Result.isFailure(api.createSpline([['0', 0]] as never))).toBe(true)
    expect(Result.isFailure(api.createSpline([[0, '0']] as never))).toBe(true)
    expect(Result.isFailure(api.createSpline([[Number.NaN, 0]] as never))).toBe(true)
    expect(Result.isFailure(api.createSpline([[0, Number.POSITIVE_INFINITY]] as never))).toBe(true)
  })

  it('rejects non-increasing control-point coordinates', () => {
    expect(Result.isFailure(api.createSpline([[0, 0], [0, 1]] as never))).toBe(true)
    expect(Result.isFailure(api.createSpline([[1, 0], [0, 1]] as never))).toBe(true)
  })

  it('rejects non-finite evaluation inputs with Result', () => {
    expect(Result.isFailure(api.evaluateSpline(spline, Number.NaN as never))).toBe(true)
    expect(Result.isFailure(api.evaluateSpline(spline, Number.NEGATIVE_INFINITY as never))).toBe(true)
  })

  it('retains a branded public Spline shape for static data', () => {
    const staticSpline: api.Spline = [
      [input(0), splineValue(0)],
      [input(1), splineValue(1)],
    ]
    expect(evaluateSpline(staticSpline, 0.25)).toBe(0.25)
  })
})
