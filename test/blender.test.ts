import { describe, expect, it } from 'vitest'
import {
  createBlender,
  createDensityEvaluationContextFromBlender,
  densityBlendAlpha,
  densityBlendDensity,
  densityBlendOffset,
  densityConstant,
  emptyBlender,
  evaluateDensityFunction,
  requireBlender,
} from '../src/index.js'

const position = { x: 2, y: 3, z: 5 }

describe('Blender', () => {
  it('provides identity behavior by default', () => {
    const blender = emptyBlender()

    expect(Object.isFrozen(blender)).toBe(true)
    expect(blender.blendDensity(position, 7)).toBe(7)
    expect(blender.blendOffsetAndFactor(2, 5)).toEqual({
      alpha: 1,
      blendingOffset: 0,
    })
    expect(requireBlender(blender)).toBe(blender)
  })

  it('validates and adapts custom blend callbacks', () => {
    const blender = createBlender({
      blendDensity: (inputPosition, density) => density + inputPosition.y,
      blendOffsetAndFactor: (x, z) => ({
        alpha: x / 10,
        blendingOffset: z,
      }),
    })
    const context = createDensityEvaluationContextFromBlender(blender)

    expect(blender.blendDensity(position, 7)).toBe(10)
    expect(blender.blendOffsetAndFactor(2, 5)).toEqual({
      alpha: 0.2,
      blendingOffset: 5,
    })
    expect(
      evaluateDensityFunction(densityBlendDensity(densityConstant(7)), position, context),
    ).toBe(10)
    expect(evaluateDensityFunction(densityBlendAlpha(), position, context)).toBe(0.2)
    expect(evaluateDensityFunction(densityBlendOffset(), position, context)).toBe(5)
  })

  it('rejects malformed options, callbacks, and callback outputs', () => {
    expect(() => createBlender(null as never)).toThrow('options must be an object')
    expect(() => createBlender({ blendDensity: 0 as never })).toThrow(
      'blendDensity must be a function',
    )
    expect(() => createBlender({ blendOffsetAndFactor: 0 as never })).toThrow(
      'blendOffsetAndFactor must be a function',
    )
    expect(() => requireBlender(null)).toThrow('blender must be an object')
    expect(() => requireBlender({})).toThrow('blender must provide blend functions')
    expect(() =>
      createBlender({ blendDensity: () => Number.NaN }).blendDensity(position, 1),
    ).toThrow('blended density must be finite')
    expect(() =>
      createBlender({ blendDensity: () => 'bad' as never }).blendDensity(position, 1),
    ).toThrow('blended density must be a number')
    expect(() =>
      createBlender({
        blendOffsetAndFactor: () => ({ alpha: Number.NaN, blendingOffset: 0 }),
      }).blendOffsetAndFactor(0, 0),
    ).toThrow('blending output alpha must be finite')
    expect(() =>
      createBlender({
        blendOffsetAndFactor: () => ({
          alpha: 0,
          blendingOffset: 'bad',
        }) as never,
      }).blendOffsetAndFactor(0, 0),
    ).toThrow('blending output offset must be a number')
    expect(() =>
      createBlender({
        blendOffsetAndFactor: () => null as never,
      }).blendOffsetAndFactor(0, 0),
    ).toThrow('blending output must be an object')
    expect(() =>
      createBlender({ blendDensity: () => 1 }).blendDensity(null as never, 1),
    ).toThrow()
    expect(() =>
      createBlender({ blendDensity: () => 1 }).blendDensity(position, Number.NaN),
    ).toThrow('density must be finite')
  })
})
