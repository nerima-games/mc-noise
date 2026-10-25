import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import { densityBounds, densityZero } from '../src/index.js'
import * as DensityApi from '../src/index.js'
import {
  createDensityNoiseSource,
  createSpline,
  densityAbs,
  densityAdd,
  densityClamp,
  densityConstant,
  densityCoordinate,
  densityEndIslands,
  densityCube,
  densityFindTopSurface,
  densityHalfNegative,
  densityInvert,
  densityLinearOperation,
  densityLerp,
  densityMap,
  densityMapRange,
  densityMappedNoise,
  densityNoiseInRange,
  densityMax,
  densityMin,
  densityMul,
  densityNoise,
  densityQuarterNegative,
  densityRangeChoice,
  densityShift,
  densityShiftA,
  densityShiftB,
  densityShiftedNoise,
  densityShiftedNoise2D,
  densitySqueeze,
  densitySpline,
  densitySquare,
  densityUnary,
  densityWeirdScaledSampler,
  densityYClampedGradient,
  evaluateDensityFunction,
  blockAxis,
  densityBound,
  densityCellSize,
  densityValue,
  densityPosition,
  expectDensitySuccess,
  expectResultFailure,
} from './density-function-test-utils.js'

const position = { x: 2, y: 4, z: -3 }

describe('portable DensityFunction composition', () => {
  it('evaluates constants, coordinates, and frozen bounds', () => {
    const constant = densityConstant(4)
    const coordinate = densityCoordinate('x', { scale: -2, offset: 3 })
    const zeroCoordinate = densityCoordinate('y', { scale: 0, offset: 7 })

    expect(evaluateDensityFunction(constant, position)).toBe(4)
    expect(evaluateDensityFunction(coordinate, position)).toBe(-1)
    expect(evaluateDensityFunction(zeroCoordinate, position)).toBe(7)
    expect(evaluateDensityFunction(densityZero, position)).toBe(0)
    expect(densityBounds(constant)).toEqual({ minValue: 4, maxValue: 4 })
    expect(densityBounds(zeroCoordinate)).toEqual({ minValue: 7, maxValue: 7 })
    expect(Object.isFrozen(constant)).toBe(true)
    expect(Object.isFrozen(densityZero)).toBe(true)
  })

  it('evaluates direct, scaled, and shifted noise sources', () => {
    const calls: Array<readonly [number, number, number]> = []
    const source = createDensityNoiseSource(
      (x, y, z) => {
        calls.push([x, y, z])
        return x + y + z
      },
      { minValue: -10, maxValue: 10 },
    )
    const direct = densityShift(source)
    const shiftA = densityShiftA(source)
    const shiftB = densityShiftB(source)
    const scaled = densityNoise(source, { xzScale: 2, yScale: 3 })
    const shifted = densityShiftedNoise(
      source,
      { x: densityConstant(1), y: densityConstant(2), z: densityConstant(3) },
      { xzScale: 2, yScale: 3 },
    )

    expect(evaluateDensityFunction(direct, position)).toBe(3)
    expect(evaluateDensityFunction(shiftA, position)).toBe(-1)
    expect(evaluateDensityFunction(shiftB, position)).toBe(-1)
    expect(evaluateDensityFunction(scaled, position)).toBe(10)
    expect(evaluateDensityFunction(shifted, position)).toBe(16)
    expect(calls).toEqual([
      [0.5, 1, -0.75],
      [0.5, 0, -0.75],
      [-0.75, 0.5, 0],
      [4, 12, -6],
      [5, 14, -3],
    ])
    expect(densityBounds(direct)).toEqual({ minValue: -40, maxValue: 40 })
    expect(densityBounds(shiftA)).toEqual({ minValue: -40, maxValue: 40 })
    expect(densityBounds(shiftB)).toEqual({ minValue: -40, maxValue: 40 })
    expect(densityBounds(scaled)).toEqual({ minValue: -10, maxValue: 10 })
    expect(densityBounds(shifted)).toEqual({ minValue: -10, maxValue: 10 })
  })

  it('evaluates map, range, 2D shifted noise, and lerp helpers', () => {
    const source = createDensityNoiseSource(
      (x, y, z) => x + y + z,
      { minValue: -10, maxValue: 10 },
    )
    const mapped = densityMap(densityConstant(-2), 'abs')
    const mappedRange = densityMapRange(densityConstant(-0.5), -2, 6)
    const noiseInRangeDefault = densityNoiseInRange(source, { min: -2, max: 6 })
    const noiseInRangeScaled = densityNoiseInRange(source, {
      min: -2,
      max: 6,
      xzScale: 2,
      yScale: 3,
    })
    const mappedNoiseDefault = densityMappedNoise(source, -2, 6)
    const mappedNoiseYScaled = densityMappedNoise(source, 3, -2, 6)
    const mappedNoiseScaled = densityMappedNoise(source, 2, 3, -2, 6)
    const shifted2dDefault = densityShiftedNoise2D(source, {
      x: densityConstant(1),
      z: densityConstant(3),
    })
    const shifted2dScaled = densityShiftedNoise2D(
      source,
      { x: densityConstant(1), z: densityConstant(3) },
      { xzScale: 2 },
    )
    const numericLerp = densityLerp(densityConstant(0.25), -2, 6)
    const dynamicLerp = densityLerp(
      densityConstant(0.5),
      densityCoordinate('x'),
      densityCoordinate('z'),
    )

    expect(evaluateDensityFunction(mapped, position)).toBe(2)
    expect(evaluateDensityFunction(mappedRange, position)).toBe(0)
    expect(evaluateDensityFunction(noiseInRangeDefault, position)).toBe(14)
    expect(evaluateDensityFunction(noiseInRangeScaled, position)).toBe(42)
    expect(evaluateDensityFunction(mappedNoiseDefault, position)).toBe(14)
    expect(evaluateDensityFunction(mappedNoiseYScaled, position)).toBe(46)
    expect(evaluateDensityFunction(mappedNoiseScaled, position)).toBe(42)
    expect(densityBounds(mappedNoiseDefault)).toEqual({
      minValue: -38,
      maxValue: 42,
    })
    expect(evaluateDensityFunction(shifted2dDefault, position)).toBe(3)
    expect(evaluateDensityFunction(shifted2dScaled, position)).toBe(2)
    expect(evaluateDensityFunction(numericLerp, position)).toBe(0)
    expect(evaluateDensityFunction(dynamicLerp, position)).toBe(-0.5)
    expect(densityBounds(mapped)).toEqual({ minValue: 2, maxValue: 2 })
    expect(densityBounds(mappedRange)).toEqual({ minValue: 0, maxValue: 0 })
    expect(densityBounds(noiseInRangeDefault)).toEqual({
      minValue: -38,
      maxValue: 42,
    })
    expect(densityBounds(numericLerp)).toEqual({ minValue: 0, maxValue: 0 })
  })

  it('evaluates linear operations, weird scaled samplers, and end islands', () => {
    const source = createDensityNoiseSource(
      (x, y, z) => x + y + z + 1,
      { minValue: -10, maxValue: 10 },
    )
    const add = densityLinearOperation('add', densityConstant(-2), 3)
    const multiply = densityLinearOperation('mul', densityConstant(-2), -2)
    const zeroMultiply = densityLinearOperation('mul', densityCoordinate('x'), 0)
    const type1 = densityWeirdScaledSampler(
      densityConstant(-0.8),
      source,
      'type-1',
    )
    const type2 = densityWeirdScaledSampler(
      densityConstant(-0.25),
      source,
      'type-2',
    )
    const endIslands = densityEndIslands(0n)
    const mapperSource = createDensityNoiseSource(() => 1, {
      minValue: 1,
      maxValue: 1,
    })
    const rarityCases = [
      ['type-1', -0.8, 0.5],
      ['type-1', -0.6, 0.75],
      ['type-1', 0, 1],
      ['type-1', 0.6, 2],
      ['type-1', 0.8, 3],
      ['type-2', -0.6, 0.75],
      ['type-2', -0.25, 1],
      ['type-2', 0.25, 1.5],
      ['type-2', 0.75, 2],
    ] as const

    for (const [mapper, input, expected] of rarityCases) {
      expect(
        evaluateDensityFunction(
          densityWeirdScaledSampler(densityConstant(input), mapperSource, mapper),
          position,
        ),
      ).toBe(expected)
    }

    expect(evaluateDensityFunction(add, position)).toBe(1)
    expect(evaluateDensityFunction(multiply, position)).toBe(4)
    expect(evaluateDensityFunction(zeroMultiply, position)).toBe(0)
    expect(evaluateDensityFunction(type1, position)).toBe(3.5)
    expect(evaluateDensityFunction(type2, position)).toBe(4)
    expect(evaluateDensityFunction(endIslands, position)).toBeGreaterThanOrEqual(
      endIslands.minValue,
    )
    expect(evaluateDensityFunction(endIslands, position)).toBeLessThanOrEqual(
      endIslands.maxValue,
    )
    expect(densityBounds(add)).toEqual({ minValue: 1, maxValue: 1 })
    expect(densityBounds(multiply)).toEqual({ minValue: 4, maxValue: 4 })
    expect(densityBounds(zeroMultiply)).toEqual({ minValue: 0, maxValue: 0 })
    expect(densityBounds(type1)).toEqual({ minValue: 0, maxValue: 30 })
    expect(densityBounds(type2)).toEqual({ minValue: 0, maxValue: 20 })
    expect(densityBounds(endIslands)).toEqual({
      minValue: -0.84375,
      maxValue: 0.5625,
    })
  })

  it('evaluates all binary operations and combines conservative bounds', () => {
    const negative = densityConstant(-2)
    const positive = densityConstant(3)

    expect(evaluateDensityFunction(densityAdd(negative, positive), position)).toBe(1)
    expect(evaluateDensityFunction(densityMul(negative, positive), position)).toBe(-6)
    expect(evaluateDensityFunction(densityMin(negative, positive), position)).toBe(-2)
    expect(evaluateDensityFunction(densityMax(negative, positive), position)).toBe(3)
    expect(densityBounds(densityMul(negative, positive))).toEqual({ minValue: -6, maxValue: -6 })
    expect(densityBounds(densityAdd(negative, positive))).toEqual({ minValue: 1, maxValue: 1 })
    expect(densityBounds(densityMul(densityCoordinate('x'), densityZero))).toEqual({
      minValue: -Infinity,
      maxValue: Infinity,
    })
    const unboundedSource = createDensityNoiseSource(() => 0, {
      minValue: Infinity,
      maxValue: Infinity,
    })
    expect(densityBounds(densityAdd(densityCoordinate('x'), densityNoise(unboundedSource)))).toEqual({
      minValue: -Infinity,
      maxValue: Infinity,
    })
  })

  it('evaluates all unary operations', () => {
    expect(evaluateDensityFunction(densityAbs(densityConstant(-3)), position)).toBe(3)
    expect(evaluateDensityFunction(densitySquare(densityConstant(-3)), position)).toBe(9)
    expect(evaluateDensityFunction(densityCube(densityConstant(-2)), position)).toBe(-8)
    expect(evaluateDensityFunction(densityHalfNegative(densityConstant(-2)), position)).toBe(-1)
    expect(evaluateDensityFunction(densityHalfNegative(densityConstant(2)), position)).toBe(2)
    expect(evaluateDensityFunction(densityQuarterNegative(densityConstant(-2)), position)).toBe(-0.5)
    expect(evaluateDensityFunction(densityQuarterNegative(densityConstant(2)), position)).toBe(2)
    expect(evaluateDensityFunction(densitySqueeze(densityConstant(2)), position)).toBe(11 / 24)
    expect(evaluateDensityFunction(densitySqueeze(densityConstant(-2)), position)).toBe(-11 / 24)
    expect(evaluateDensityFunction(densityInvert(densityConstant(2)), position)).toBe(0.5)
    expect(evaluateDensityFunction(densityUnary('abs', densityConstant(-2)), position)).toBe(2)
    expect(densityBounds(densityInvert(densityCoordinate('x')))).toEqual({
      minValue: -Infinity,
      maxValue: Infinity,
    })
    expect(densityBounds(densityAbs(densityCoordinate('x')))).toEqual({
      minValue: 0,
      maxValue: Infinity,
    })
    expect(densityBounds(densitySquare(densityCoordinate('x')))).toEqual({
      minValue: 0,
      maxValue: Infinity,
    })
  })

  it('evaluates clamp, range choice, gradients, and splines', () => {
    const clamped = densityClamp(densityConstant(4), 0, 3)
    const range = densityRangeChoice(
      densityCoordinate('x'),
      { minInclusive: 2, maxExclusive: 3 },
      densityConstant(10),
      densityConstant(-10),
    )
    const gradient = densityYClampedGradient(0, 10, -1, 1)
    const reversedGradient = densityYClampedGradient(10, 0, 1, -1)
    const spline = densitySpline(densityCoordinate('x'), createSpline([[0, 0], [10, 10]]))
    const emptySpline = densitySpline(densityConstant(1), [])

    expect(evaluateDensityFunction(clamped, position)).toBe(3)
    expect(densityBounds(clamped)).toEqual({ minValue: 3, maxValue: 3 })
    expect(evaluateDensityFunction(range, position)).toBe(10)
    expect(evaluateDensityFunction(range, { ...position, x: 3 })).toBe(-10)
    expect(evaluateDensityFunction(gradient, { ...position, y: -1 })).toBe(-1)
    expect(evaluateDensityFunction(gradient, { ...position, y: 5 })).toBe(0)
    expect(evaluateDensityFunction(gradient, { ...position, y: 11 })).toBe(1)
    expect(evaluateDensityFunction(reversedGradient, { ...position, y: 5 })).toBe(0)
    expect(evaluateDensityFunction(spline, { ...position, x: 5 })).toBe(5)
    expect(evaluateDensityFunction(emptySpline, position)).toBe(0)
    expect(densityBounds(gradient)).toEqual({ minValue: -1, maxValue: 1 })
    expect(densityBounds(spline)).toEqual({ minValue: 0, maxValue: 10 })
  })

  it('finds the top surface using floored, inclusive cell-height scans', () => {
    const calls: Array<readonly [number, number, number]> = []
    const source = createDensityNoiseSource(
      (x, y, z) => {
        calls.push([x, y, z])
        if (y === 4) {
          return 0
        }
        if (y === 0) {
          return 1
        }
        return -1
      },
      { minValue: -1, maxValue: 1 },
    )
    const surface = densityFindTopSurface(
      densityNoise(source, { xzScale: 1, yScale: 1 }),
      densityConstant(9),
      -4,
      4,
    )

    expect(evaluateDensityFunction(surface, { x: 2, y: 99, z: -3 })).toBe(0)
    expect(calls).toEqual([
      [2, 8, -3],
      [2, 4, -3],
      [2, 0, -3],
    ])
    expect(densityBounds(surface)).toEqual({ minValue: -4, maxValue: 9 })

    const negativeCalls: number[] = []
    const negativeSurface = densityFindTopSurface(
      densityNoise(
        createDensityNoiseSource(
          (_x, y, _z) => {
            negativeCalls.push(y)
            if (y === -4) {
              return 1
            }
            return -1
          },
          { minValue: -1, maxValue: 1 },
        ),
        { xzScale: 1, yScale: 1 },
      ),
      densityConstant(-1),
      -8,
      4,
    )
    expect(evaluateDensityFunction(negativeSurface, position)).toBe(-4)
    expect(negativeCalls).toEqual([-4])

    const noScanCalls: number[] = []
    const noScanSurface = densityFindTopSurface(
      densityNoise(
        createDensityNoiseSource(
          (_x, y, _z) => {
            noScanCalls.push(y)
            return 1
          },
          { minValue: -1, maxValue: 1 },
        ),
        { xzScale: 1, yScale: 1 },
      ),
      densityConstant(-9),
      -8,
      4,
    )
    expect(evaluateDensityFunction(noScanSurface, position)).toBe(-8)
    expect(noScanCalls).toEqual([])

    const fallbackSurface = densityFindTopSurface(densityZero, densityConstant(4), -4, 4)
    expect(evaluateDensityFunction(fallbackSurface, position)).toBe(-4)

    const nonFiniteUpperBound = densityFindTopSurface(
      densityZero,
      densityNoise(
        createDensityNoiseSource(() => Number.POSITIVE_INFINITY, {
          minValue: 0,
          maxValue: 0,
        }),
        { xzScale: 1, yScale: 1 },
      ),
      -8,
      4,
    )
    expect(evaluateDensityFunction(nonFiniteUpperBound, position)).toBe(-8)
  })

  it('rejects invalid public inputs at construction and evaluation boundaries', () => {
    const validSource = createDensityNoiseSource(() => 0, { minValue: -1, maxValue: 1 })
    const invalidSource = { sample: null as never, minValue: -1, maxValue: 1 }
    expect(expectResultFailure(DensityApi.densityConstant(Number.NaN as never)).message).toContain(
      'value must be finite',
    )
    expect(
      expectResultFailure(DensityApi.densityCoordinate('q' as never)).message,
    ).toContain('axis must be x, y, or z')
    expect(
      expectResultFailure(
        DensityApi.densityCoordinate('x', { scale: Number.POSITIVE_INFINITY as never }),
      ).message,
    ).toContain('scale must be finite')
    expect(
      expectResultFailure(
        DensityApi.densityCoordinate('x', { offset: Number.POSITIVE_INFINITY as never }),
      ).message,
    ).toContain('offset must be finite')
    expect(
      expectResultFailure(DensityApi.densityCoordinate('x', null as never)).message,
    ).toContain('coordinate options must be an object')
    expect(
      expectResultFailure(
        DensityApi.createDensityNoiseSource(null as never, {
          minValue: densityBound(-1),
          maxValue: densityBound(1),
        }),
      ).message,
    ).toContain('noise source sample must be a function')
    expect(
      expectResultFailure(
        DensityApi.createDensityNoiseSource(() => 0, {
          minValue: Number.NaN as never,
          maxValue: densityBound(1),
        }),
      ).message,
    ).toContain('minValue must not be NaN')
    expect(
      expectResultFailure(
        DensityApi.createDensityNoiseSource(() => 0, {
          minValue: densityBound(-1),
          maxValue: Number.NaN as never,
        }),
      ).message,
    ).toContain('maxValue must not be NaN')
    expect(
      expectResultFailure(
        DensityApi.createDensityNoiseSource(() => 0, null as never),
      ).message,
    ).toContain('noise source bounds must be an object')
    expect(
      expectResultFailure(
        DensityApi.createDensityNoiseSource(() => 0, {
          minValue: densityBound(1),
          maxValue: densityBound(-1),
        }),
      ).message,
    ).toContain('minValue must not exceed maxValue')
    expect(
      expectResultFailure(DensityApi.densityNoise(invalidSource as never, {})).message,
    ).toContain('noise source sample must be a function')
    expect(
      expectResultFailure(DensityApi.densityNoise(null as never, {})).message,
    ).toContain('noise source must be an object')
    expect(
      expectResultFailure(DensityApi.densityNoise(validSource, null as never)).message,
    ).toContain('noise options must be an object')
    expect(densityBounds(densityNoise(validSource, { xzScale: 0, yScale: 0 }))).toEqual({
      minValue: -1,
      maxValue: 1,
    })
    expect(
      expectResultFailure(
        DensityApi.densityNoise(validSource as never, {
          xzScale: Number.POSITIVE_INFINITY as never,
        }),
      ).message,
    ).toContain('xzScale must be finite')
    expect(
      expectResultFailure(
        DensityApi.densityNoise(validSource as never, {
          yScale: Number.POSITIVE_INFINITY as never,
        }),
      ).message,
    ).toContain('yScale must be finite')
    expect(
      expectResultFailure(
        DensityApi.densityMapRange(densityZero, Number.NaN as never, densityValue(1)),
      ).message,
    ).toContain('min must be finite')
    expect(
      expectResultFailure(
        DensityApi.densityMapRange(
          densityZero,
          densityValue(-1),
          Number.POSITIVE_INFINITY as never,
        ),
      ).message,
    ).toContain('max must be finite')
    expect(
      expectResultFailure(
        DensityApi.densityMapRange(
          densityZero,
          densityValue(Number.MAX_VALUE),
          densityValue(Number.MAX_VALUE),
        ),
      ).message,
    ).toContain('map range midpoint must be finite')
    expect(
      expectResultFailure(
        DensityApi.densityMapRange(
          densityZero,
          densityValue(-Number.MAX_VALUE),
          densityValue(Number.MAX_VALUE),
        ),
      ).message,
    ).toContain('map range scale must be finite')
    expect(
      expectResultFailure(
        DensityApi.densityLerp(
          densityZero,
          Number.POSITIVE_INFINITY as never,
          densityZero,
        ),
      ).message,
    ).toContain('min must be finite')
    expect(
      expectResultFailure(
        DensityApi.densityNoiseInRange(validSource as never, {
          min: densityValue(-1),
          max: densityValue(1),
          xzScale: Number.POSITIVE_INFINITY as never,
        }),
      ).message,
    ).toContain('xzScale must be finite')
    expect(
      expectResultFailure(
        DensityApi.densityShiftedNoise2D(
          validSource as never,
          { x: densityZero, z: densityZero },
          { xzScale: Number.POSITIVE_INFINITY as never },
        ),
      ).message,
    ).toContain('xzScale must be finite')
    expect(
      densityShiftedNoise(validSource, {
        x: densityZero,
        y: densityZero,
        z: densityZero,
      }),
    ).toMatchObject({ kind: 'shifted-noise' })
    expect(
      expectResultFailure(DensityApi.densityBinary('bad' as never, densityZero, densityZero))
        .message,
    ).toContain('unsupported binary operation')
    expect(
      expectResultFailure(DensityApi.densityUnary('bad' as never, densityZero)).message,
    ).toContain('unsupported unary operation')
    expect(
      expectResultFailure(
        DensityApi.densityLinearOperation('bad' as never, densityZero, densityValue(1)),
      ).message,
    ).toContain('unsupported linear operation')
    expect(
      expectResultFailure(
        DensityApi.densityWeirdScaledSampler(densityZero, validSource as never, 'bad' as never),
      ).message,
    ).toContain('unsupported rarity value mapper')
    expect(
      expectResultFailure(
        DensityApi.densityClamp(densityZero, densityValue(2), densityValue(1)),
      ).message,
    ).toContain('min must not exceed max')
    expect(
      expectResultFailure(
        DensityApi.densityRangeChoice(
          densityZero,
          { minInclusive: densityValue(2), maxExclusive: densityValue(1) },
          densityZero,
          densityZero,
        ),
      ).message,
    ).toContain('minInclusive must not exceed maxExclusive')
    expect(
      expectResultFailure(
        DensityApi.densityYClampedGradient(
          blockAxis(1),
          blockAxis(1),
          densityValue(0),
          densityValue(1),
        ),
      ).message,
    ).toContain('fromY and toY must differ')
    expect(
      expectResultFailure(
        DensityApi.densityFindTopSurface(
          densityZero,
          densityZero,
          blockAxis(0),
          0 as never,
        ),
      ).message,
    ).toContain('cellHeight must be a positive integer')
    expect(
      expectResultFailure(
        DensityApi.densityFindTopSurface(
          densityZero,
          densityZero,
          0.5 as never,
          densityCellSize(1),
        ),
      ).message,
    ).toContain('lowerBound must be a safe integer')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          densityZero,
          { x: Number.NaN, y: 0, z: 0 } as never,
        ),
      ).message,
    ).toContain('position.x PositionAxis must be a finite number of blocks')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          densityZero,
          { x: 0, y: Number.POSITIVE_INFINITY, z: 0 } as never,
        ),
      ).message,
    ).toContain('position.y PositionAxis must be a finite number of blocks')
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          densityZero,
          { x: 0, y: 0, z: Number.NEGATIVE_INFINITY } as never,
        ),
      ).message,
    ).toContain('position.z PositionAxis must be a finite number of blocks')
  })

  it('fails on finite-but-overflowing evaluations and invalid end-island coordinates', () => {
    const overflowingSquare = densitySquare(densityConstant(Number.MAX_VALUE))
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(overflowingSquare, densityPosition(position)),
      ).message,
    ).toContain('density evaluation result must be finite')

    const overflowingSpline = densitySpline(
      overflowingSquare,
      createSpline([[0, 0], [1, 1]]),
    )
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(overflowingSpline, densityPosition(position)),
      ).message,
    ).toContain('spline input must be finite')

    const blendFailureContext = expectDensitySuccess(DensityApi.createDensityEvaluationContext({
      blendDensity: () => Result.fail(new RangeError('blend callback failed')),
    }))
    const blendNode = DensityApi.densityBlendDensity(densityConstant(1))
    const failedSurface = densityFindTopSurface(blendNode, densityConstant(16), -4, 4)
    expect(
      expectResultFailure(
        DensityApi.evaluateDensityFunction(
          failedSurface,
          densityPosition(position),
          blendFailureContext,
        ),
      ).message,
    ).toContain('blend callback failed')

    const endIslands = densityEndIslands(0n)
    for (const invalidPosition of [
      { x: Number.MAX_VALUE, y: 0, z: 0 },
      { x: 0, y: 0, z: Number.MAX_VALUE },
    ]) {
      expect(
        expectResultFailure(
          DensityApi.evaluateDensityFunction(endIslands, densityPosition(invalidPosition)),
        ).message,
      ).toContain('safe integer')
    }
  })
})
