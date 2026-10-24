import { describe, expect, it } from 'vitest'
import * as DensityApi from '../src/index.js'
import {
  densityConstant,
  densityPosition,
  densityValue,
  expectDensitySuccess,
  expectResultFailure,
} from './density-function-test-utils.js'

describe('DensityFunctionNode', () => {
  it('exposes the official execution and bounds methods', () => {
    const node = expectDensitySuccess(
      DensityApi.createDensityFunctionNode(densityConstant(-2)),
    )
    const position = { x: 1, y: 2, z: 3 }
    const values = [0, 0]

    expect(expectDensitySuccess(node.compute(densityPosition(position)))).toBe(-2)
    expect(
      expectDensitySuccess(node.fillArray(values, () => densityPosition(position))),
    ).toBeUndefined()
    expect(values).toEqual([-2, -2])
    expect(node.minValue()).toBe(-2)
    expect(node.maxValue()).toBe(-2)
  })

  it('provides the default unary and clamp operations', () => {
    const node = expectDensitySuccess(
      DensityApi.createDensityFunctionNode(densityConstant(-2)),
    )

    const point = densityPosition({ x: 0, y: 0, z: 0 })
    expect(expectDensitySuccess(expectDensitySuccess(node.abs()).compute(point))).toBe(2)
    expect(
      expectDensitySuccess(
        expectDensitySuccess(node.clamp(densityValue(-1), densityValue(1))).compute(point),
      ),
    ).toBe(-1)
    expect(expectDensitySuccess(expectDensitySuccess(node.cube()).compute(point))).toBe(-8)
    expect(expectDensitySuccess(expectDensitySuccess(node.halfNegative()).compute(point))).toBe(-1)
    expect(expectDensitySuccess(expectDensitySuccess(node.invert()).compute(point))).toBe(-0.5)
    expect(
      expectDensitySuccess(expectDensitySuccess(node.quarterNegative()).compute(point)),
    ).toBe(-0.5)
    expect(expectDensitySuccess(expectDensitySuccess(node.square()).compute(point))).toBe(4)
    expect(
      expectDensitySuccess(expectDensitySuccess(node.squeeze()).compute(point)),
    ).toBeCloseTo(-11 / 24)
  })

  it('maps the complete density tree into another execution node', () => {
    const node = expectDensitySuccess(
      DensityApi.createDensityFunctionNode(densityConstant(2)),
    )
    const mapped = expectDensitySuccess(
      node.mapAll(() => densityConstant(7)),
    )

    expect(
      expectDensitySuccess(mapped.compute(densityPosition({ x: 0, y: 0, z: 0 }))),
    ).toBe(7)
    expect(mapped.minValue()).toBe(7)
    expect(mapped.maxValue()).toBe(7)
  })

  it('rejects invalid density values', () => {
    expect(
      expectResultFailure(
        DensityApi.createDensityFunctionNode(null as never),
      ).message,
    ).toBe('density must be a DensityFunction')
  })
})
