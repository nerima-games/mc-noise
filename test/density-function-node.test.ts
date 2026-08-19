import { describe, expect, it } from 'vitest'
import {
  createDensityFunctionNode,
  densityConstant,
} from '../src/index.js'

describe('DensityFunctionNode', () => {
  it('exposes the official execution and bounds methods', () => {
    const node = createDensityFunctionNode(densityConstant(-2))
    const position = { x: 1, y: 2, z: 3 }
    const values = [0, 0]

    expect(node.compute(position)).toBe(-2)
    node.fillArray(values, () => position)
    expect(values).toEqual([-2, -2])
    expect(node.minValue()).toBe(-2)
    expect(node.maxValue()).toBe(-2)
  })

  it('provides the default unary and clamp operations', () => {
    const node = createDensityFunctionNode(densityConstant(-2))

    expect(node.abs().compute({ x: 0, y: 0, z: 0 })).toBe(2)
    expect(node.clamp(-1, 1).compute({ x: 0, y: 0, z: 0 })).toBe(-1)
    expect(node.cube().compute({ x: 0, y: 0, z: 0 })).toBe(-8)
    expect(node.halfNegative().compute({ x: 0, y: 0, z: 0 })).toBe(-1)
    expect(node.quarterNegative().compute({ x: 0, y: 0, z: 0 })).toBe(-0.5)
    expect(node.square().compute({ x: 0, y: 0, z: 0 })).toBe(4)
    expect(node.squeeze().compute({ x: 0, y: 0, z: 0 })).toBeCloseTo(-11 / 24)
  })

  it('maps the complete density tree into another execution node', () => {
    const node = createDensityFunctionNode(densityConstant(2))
    const mapped = node.mapAll(() => densityConstant(7))

    expect(mapped.compute({ x: 0, y: 0, z: 0 })).toBe(7)
    expect(mapped.minValue()).toBe(7)
    expect(mapped.maxValue()).toBe(7)
  })

  it('rejects invalid density values', () => {
    expect(() => createDensityFunctionNode(null as never)).toThrow(
      'density must be a DensityFunction',
    )
  })
})
