import { describe, expect, it } from 'vitest'
import {
  blendAlpha,
  blendDensity,
  blendOffset,
  beardifier,
  cache2d,
  cacheAllInCell,
  cacheOnce,
  densityBlendAlpha,
  densityBlendDensity,
  densityBlendOffset,
  densityCache2D,
  densityCacheAllInCell,
  densityCacheOnce,
  densityFlatCache,
  densityInterpolated,
  densityBounds,
  flatCache,
  interpolated,
} from '../src/index.js'
import * as DensityApi from '../src/index.js'
import {
  createDensityEvaluationContext,
  createDensityEvaluationSession,
  densityAdd,
  densityConstant,
  densityCoordinate,
  densityCube,
  densitySquare,
  densityPosition,
  evaluateDensityFunction,
  expectResultFailure,
} from './density-function-test-utils.js'

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

    expect(evaluateDensityFunction(cached, { x: 1, y: 2, z: 3 }, session)).toBe(1)
    expect(evaluateDensityFunction(cached, { x: 9, y: 2, z: 3 }, session)).toBe(1)
    expect(Object.isFrozen(session)).toBe(true)

    session.clear()
    expect(evaluateDensityFunction(cached, { x: 9, y: 2, z: 3 }, session)).toBe(9)
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
    expect(evaluateDensityFunction(flat, { x: 3, y: 4, z: 5 }, session)).toBe(4)
    expect(evaluateDensityFunction(flat, { x: 3, y: 8, z: 5 }, session)).toBe(4)
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

    expect(evaluateDensityFunction(allInCell, position, session)).toBe(2)
    expect(evaluateDensityFunction(allInCell, position, session)).toBe(2)
    expect(evaluateDensityFunction(allInCell, { x: 1, y: 3, z: 1 }, session)).toBe(3)
    expect(evaluateDensityFunction(interpolatedDensity, position, session)).toBe(35)
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
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(cached, densityPosition(position)),
      ).message,
    ).toContain('cache-once requires an evaluation context')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          blendDensity(densityConstant(1)),
          densityPosition(position),
        ),
      ).message,
    ).toContain('blend-density requires an evaluation context')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(densityBlendAlpha(), densityPosition(position)),
      ).message,
    ).toContain('blend-alpha requires an evaluation context')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(densityBlendOffset(), densityPosition(position)),
      ).message,
    ).toContain('blend-offset requires an evaluation context')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(beardifier(), densityPosition(position)),
      ).message,
    ).toContain('beardifier requires an evaluation context')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          densityBlendDensity(densityConstant(1)),
          densityPosition(position),
          createDensityEvaluationContext(),
        ),
      ).message,
    ).toContain('blend-density requires context.blendDensity')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          densityBlendAlpha(),
          densityPosition(position),
          createDensityEvaluationContext(),
        ),
      ).message,
    ).toContain('blend-alpha requires context.blendAlpha')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          densityBlendOffset(),
          densityPosition(position),
          createDensityEvaluationContext(),
        ),
      ).message,
    ).toContain('blend-offset requires context.blendOffset')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          beardifier(),
          densityPosition(position),
          createDensityEvaluationContext(),
        ),
      ).message,
    ).toContain('beardifier requires context.beardifier')
    expect(
      expectResultFailure(DensityApi.createDensityEvaluationSession(null as never)).message,
    ).toContain('evaluation context must be an object')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(densityConstant(1), null as never),
      ).message,
    ).toContain('position must be an object')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          densityConstant(1),
          densityPosition(position),
          null as never,
        ),
      ).message,
    ).toContain('evaluation context must be an object')
  })

  it('rejects invalid cell sizes and callback values', () => {
    expect(
      expectResultFailure(DensityApi.createDensityEvaluationContext(null as never)).message,
    ).toContain('evaluation context options must be an object')
    expect(
      expectResultFailure(
        DensityApi.createDensityEvaluationContext({ cellWidth: 0 as never }),
      ).message,
    ).toContain('cellWidth must be a positive integer')
    expect(
      expectResultFailure(
        DensityApi.createDensityEvaluationContext({ cellWidth: 1.5 as never }),
      ).message,
    ).toContain('cellWidth must be a positive integer')
    expect(
      expectResultFailure(
        DensityApi.createDensityEvaluationContext({ cellHeight: -1 as never }),
      ).message,
    ).toContain('cellHeight must be a positive integer')
    expect(
      expectResultFailure(
        DensityApi.createDensityEvaluationContext({
          cellHeight: Number.NaN as never,
        }),
      ).message,
    ).toContain('cellHeight must be a positive integer')
    expect(
      expectResultFailure(
        DensityApi.createDensityEvaluationContext({ blendDensity: null as never }),
      ).message,
    ).toContain('context.blendDensity must be a function when provided')
    expect(
      expectResultFailure(
        DensityApi.createDensityEvaluationContext({ blendAlpha: null as never }),
      ).message,
    ).toContain('context.blendAlpha must be a function when provided')
    expect(
      expectResultFailure(
        DensityApi.createDensityEvaluationContext({ blendOffset: null as never }),
      ).message,
    ).toContain('context.blendOffset must be a function when provided')
    expect(
      expectResultFailure(
        DensityApi.createDensityEvaluationContext({ beardifier: null as never }),
      ).message,
    ).toContain('context.beardifier must be a function when provided')
    const overflowingInput = densityBlendDensity(
      densitySquare(densityConstant(Number.MAX_VALUE)),
    )
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          overflowingInput,
          densityPosition(position),
          createDensityEvaluationContext({ blendDensity: (value) => value }),
        ),
      ).message,
    ).toContain('density value must be finite')
  })
})
