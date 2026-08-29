import { describe, expect, it } from 'vitest'
import {
  blendAlpha,
  blendDensity,
  blendOffset,
  beardifier,
  cache2d,
  cacheAllInCell,
  cacheOnce,
  createDensityEvaluationContext,
  createDensityEvaluationSession,
  densityAdd,
  densityBlendAlpha,
  densityBlendDensity,
  densityBlendOffset,
  densityCache2D,
  densityCacheAllInCell,
  densityCacheOnce,
  densityConstant,
  densityCoordinate,
  densityCube,
  densityFlatCache,
  densityInterpolated,
  densitySquare,
  densityBounds,
  evaluateDensityFunction,
  flatCache,
  interpolated,
} from '../src/index.js'

const position = { x: 1, y: 2, z: 1 }

describe('DensityFunction evaluation contexts', () => {
  it('creates validated, frozen contexts and exposes the official wrappers', () => {
    const context = createDensityEvaluationContext({
      cellWidth: 2,
      cellHeight: 4,
      blendDensity: (value, point) => value + point.y,
      blendAlpha: (point) => point.x / 10,
      blendOffset: (point) => point.z + 1,
      beardifier: (point) => point.x - point.z,
    })

    expect(context.cellWidth).toBe(2)
    expect(context.cellHeight).toBe(4)
    expect(Object.isFrozen(context)).toBe(true)
    expect(densityBounds(densityBlendAlpha())).toEqual({ minValue: 0, maxValue: 1 })
    expect(densityBounds(densityBlendDensity(densityConstant(1)))).toEqual({
      minValue: -Infinity,
      maxValue: Infinity,
    })
    expect(densityBounds(densityBlendOffset())).toEqual({
      minValue: -Infinity,
      maxValue: Infinity,
    })
    expect(densityInterpolated(densityConstant(1)).kind).toBe('interpolated')
    expect(densityFlatCache(densityConstant(1)).kind).toBe('flat-cache')
    expect(densityCache2D(densityConstant(1)).kind).toBe('cache-2d')
    expect(densityCacheOnce(densityConstant(1)).kind).toBe('cache-once')
    expect(densityCacheAllInCell(densityConstant(1)).kind).toBe('cache-all-in-cell')
    expect(interpolated(densityConstant(1)).kind).toBe('interpolated')
    expect(flatCache(densityConstant(1)).kind).toBe('flat-cache')
    expect(cache2d(densityConstant(1)).kind).toBe('cache-2d')
    expect(cacheOnce(densityConstant(1)).kind).toBe('cache-once')
    expect(cacheAllInCell(densityConstant(1)).kind).toBe('cache-all-in-cell')
    expect(blendDensity(densityConstant(1)).kind).toBe('blend-density')
    expect(blendAlpha().kind).toBe('blend-alpha')
    expect(blendOffset().kind).toBe('blend-offset')
    expect(beardifier().kind).toBe('beardifier')
  })

  it('caches once and clears every cache in a reusable session', () => {
    const session = createDensityEvaluationSession(createDensityEvaluationContext())
    const cached = cacheOnce(densityCoordinate('x'))

    expect(session.evaluate(cached, { x: 1, y: 2, z: 3 })).toBe(1)
    expect(session.evaluate(cached, { x: 9, y: 2, z: 3 })).toBe(1)
    expect(Object.isFrozen(session)).toBe(true)

    session.clear()
    expect(session.evaluate(cached, { x: 9, y: 2, z: 3 })).toBe(9)
  })

  it('caches flat and two-dimensional values by the horizontal position', () => {
    const context = createDensityEvaluationContext()
    const flat = flatCache(densityCoordinate('y'))
    const twoDimensional = cache2d(densityCoordinate('y'))

    expect(evaluateDensityFunction(flat, { x: 3, y: 4, z: 5 }, context)).toBe(4)
    expect(evaluateDensityFunction(flat, { x: 3, y: 8, z: 5 }, context)).toBe(8)
    expect(evaluateDensityFunction(twoDimensional, { x: 3, y: 4, z: 5 }, context)).toBe(4)
    expect(evaluateDensityFunction(twoDimensional, { x: 3, y: 8, z: 5 }, context)).toBe(8)

    const session = createDensityEvaluationSession(context)
    expect(session.evaluate(flat, { x: 3, y: 4, z: 5 })).toBe(4)
    expect(session.evaluate(flat, { x: 3, y: 8, z: 5 })).toBe(4)
  })

  it('caches exact samples within a cell and interpolates all eight corners', () => {
    const context = createDensityEvaluationContext({ cellWidth: 2, cellHeight: 4 })
    const allInCell = cacheAllInCell(densityCoordinate('y'))
    const nonlinear = densityAdd(
      densityAdd(densitySquare(densityCoordinate('x')), densityCube(densityCoordinate('y'))),
      densityCoordinate('z'),
    )
    const interpolatedDensity = interpolated(nonlinear)
    const session = createDensityEvaluationSession(context)

    expect(session.evaluate(allInCell, position)).toBe(2)
    expect(session.evaluate(allInCell, position)).toBe(2)
    expect(session.evaluate(allInCell, { x: 1, y: 3, z: 1 })).toBe(3)
    expect(session.evaluate(interpolatedDensity, position)).toBe(35)
  })

  it('delegates blend nodes to the context callbacks', () => {
    const context = createDensityEvaluationContext({
      blendDensity: (value, point) => value + point.y,
      blendAlpha: (point) => point.x / 10,
      blendOffset: (point) => point.z + 1,
    })

    expect(evaluateDensityFunction(blendDensity(densityConstant(2)), position, context)).toBe(4)
    expect(evaluateDensityFunction(blendAlpha(), position, context)).toBe(0.1)
    expect(evaluateDensityFunction(blendOffset(), position, context)).toBe(2)
  })

  it('delegates the official beardifier marker to its runtime callback', () => {
    const context = createDensityEvaluationContext({
      beardifier: (point) => point.x - point.z,
    })

    expect(evaluateDensityFunction(beardifier(), position, context)).toBe(0)
  })

  it('accepts sessions and distinguishes them from context-like values', () => {
    const context = createDensityEvaluationContext()
    const session = createDensityEvaluationSession(context)
    expect(evaluateDensityFunction(densityConstant(3), position, session)).toBe(3)
    expect(evaluateDensityFunction(
      densityConstant(3),
      position,
      { ...context, evaluate: true } as never,
    )).toBe(3)
  })

  it('rejects missing or malformed context data at the evaluation boundary', () => {
    const cached = cacheOnce(densityConstant(1))
    expect(() => evaluateDensityFunction(cached, position)).toThrow(
      'cache-once requires an evaluation context',
    )
    expect(() => evaluateDensityFunction(blendDensity(densityConstant(1)), position)).toThrow(
      'blend-density requires an evaluation context',
    )
    expect(() => evaluateDensityFunction(densityBlendAlpha(), position)).toThrow(
      'blend-alpha requires an evaluation context',
    )
    expect(() => evaluateDensityFunction(densityBlendOffset(), position)).toThrow(
      'blend-offset requires an evaluation context',
    )
    expect(() => evaluateDensityFunction(beardifier(), position)).toThrow(
      'beardifier requires an evaluation context',
    )
    expect(() => evaluateDensityFunction(
      densityBlendDensity(densityConstant(1)),
      position,
      createDensityEvaluationContext(),
    )).toThrow('blend-density requires context.blendDensity')
    expect(() => evaluateDensityFunction(
      densityBlendAlpha(),
      position,
      createDensityEvaluationContext(),
    )).toThrow('blend-alpha requires context.blendAlpha')
    expect(() => evaluateDensityFunction(
      densityBlendOffset(),
      position,
      createDensityEvaluationContext(),
    )).toThrow('blend-offset requires context.blendOffset')
    expect(() => evaluateDensityFunction(
      beardifier(),
      position,
      createDensityEvaluationContext(),
    )).toThrow('beardifier requires context.beardifier')
    expect(() => createDensityEvaluationSession(null as never)).toThrow(
      'evaluation context must be an object',
    )
    expect(() => evaluateDensityFunction(densityConstant(1), null as never)).toThrow(
      'position must be an object',
    )
    expect(() => evaluateDensityFunction(densityConstant(1), position, null as never)).toThrow(
      'evaluation context must be an object',
    )
  })

  it('rejects invalid cell sizes and callback values', () => {
    expect(() => createDensityEvaluationContext({ cellWidth: 0 })).toThrow(
      'cellWidth must be a positive integer',
    )
    expect(() => createDensityEvaluationContext({ cellWidth: 1.5 })).toThrow(
      'cellWidth must be a positive integer',
    )
    expect(() => createDensityEvaluationContext({ cellHeight: -1 })).toThrow(
      'cellHeight must be a positive integer',
    )
    expect(() => createDensityEvaluationContext({ cellHeight: Number.NaN })).toThrow(
      'cellHeight must be finite',
    )
    expect(() => createDensityEvaluationContext({ blendDensity: null as never })).toThrow(
      'context.blendDensity must be a function when provided',
    )
    expect(() => createDensityEvaluationContext({ blendAlpha: null as never })).toThrow(
      'context.blendAlpha must be a function when provided',
    )
    expect(() => createDensityEvaluationContext({ blendOffset: null as never })).toThrow(
      'context.blendOffset must be a function when provided',
    )
    expect(() => createDensityEvaluationContext({ beardifier: null as never })).toThrow(
      'context.beardifier must be a function when provided',
    )
  })
})
