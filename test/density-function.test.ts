import { describe, expect, it } from 'vitest'
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
  densityBinary,
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
  densityZero,
  densityBounds,
  evaluateDensityFunction,
} from '../src/index.js'

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
        { sample: () => Number.POSITIVE_INFINITY, minValue: 0, maxValue: 0 },
        { xzScale: 1, yScale: 1 },
      ),
      -8,
      4,
    )
    expect(evaluateDensityFunction(nonFiniteUpperBound, position)).toBe(-8)
  })

  it('rejects invalid public inputs at construction and evaluation boundaries', () => {
    const validSource = { sample: () => 0, minValue: -1, maxValue: 1 }
    const invalidSource = { sample: null as never, minValue: -1, maxValue: 1 }
    expect(() => densityConstant(Number.NaN)).toThrow('value must be finite')
    expect(() => densityCoordinate('q' as never)).toThrow('axis must be x, y, or z')
    expect(() => densityCoordinate('x', { scale: Infinity })).toThrow('scale must be finite')
    expect(() => createDensityNoiseSource(null as never, { minValue: -1, maxValue: 1 })).toThrow(
      'noise source sample must be a function',
    )
    expect(() => createDensityNoiseSource(() => 0, { minValue: Number.NaN, maxValue: 1 })).toThrow(
      'minValue must not be NaN',
    )
    expect(() => createDensityNoiseSource(() => 0, { minValue: 1, maxValue: -1 })).toThrow(
      'minValue must not exceed maxValue',
    )
    expect(() => densityNoise(invalidSource, {})).toThrow('noise source sample must be a function')
    expect(densityBounds(densityNoise(validSource, { xzScale: 0, yScale: 0 }))).toEqual({
      minValue: -1,
      maxValue: 1,
    })
    expect(() => densityNoise(validSource, { xzScale: Infinity })).toThrow('xzScale must be finite')
    expect(() => densityNoise(validSource, { yScale: Infinity })).toThrow('yScale must be finite')
    expect(() => densityMapRange(densityZero, Number.NaN, 1)).toThrow('min must be finite')
    expect(() => densityMapRange(densityZero, -1, Number.POSITIVE_INFINITY)).toThrow(
      'max must be finite',
    )
    expect(() => densityLerp(densityZero, Number.POSITIVE_INFINITY, densityZero)).toThrow(
      'min must be finite',
    )
    expect(() => densityNoiseInRange(validSource, { min: -1, max: 1, xzScale: Infinity })).toThrow(
      'xzScale must be finite',
    )
    expect(() =>
      densityShiftedNoise2D(
        validSource,
        { x: densityZero, z: densityZero },
        { xzScale: Infinity },
      ),
    ).toThrow('xzScale must be finite')
    expect(() => densityShiftedNoise(validSource, { x: densityZero, y: densityZero, z: densityZero })).not.toThrow()
    expect(() => densityBinary('bad' as never, densityZero, densityZero)).toThrow(
      'unsupported binary operation',
    )
    expect(() => densityUnary('bad' as never, densityZero)).toThrow('unsupported unary operation')
    expect(() => densityLinearOperation('bad' as never, densityZero, 1)).toThrow(
      'unsupported linear operation',
    )
    expect(() => densityWeirdScaledSampler(densityZero, validSource, 'bad' as never)).toThrow(
      'unsupported rarity value mapper',
    )
    expect(() => densityClamp(densityZero, 2, 1)).toThrow('min must not exceed max')
    expect(() => densityRangeChoice(densityZero, { minInclusive: 2, maxExclusive: 1 }, densityZero, densityZero)).toThrow(
      'minInclusive must not exceed maxExclusive',
    )
    expect(() => densityYClampedGradient(1, 1, 0, 1)).toThrow('fromY and toY must differ')
    expect(() => densityFindTopSurface(densityZero, densityZero, 0, 0)).toThrow(
      'cellHeight must be a positive integer',
    )
    expect(() => densityFindTopSurface(densityZero, densityZero, 0.5, 1)).toThrow(
      'lowerBound must be a safe integer',
    )
    expect(() => evaluateDensityFunction(densityZero, { x: Number.NaN, y: 0, z: 0 })).toThrow(
      'position.x must be finite',
    )
    expect(() => evaluateDensityFunction(densityZero, { x: 0, y: Infinity, z: 0 })).toThrow(
      'position.y must be finite',
    )
    expect(() => evaluateDensityFunction(densityZero, { x: 0, y: 0, z: Number.NEGATIVE_INFINITY })).toThrow(
      'position.z must be finite',
    )
  })
})
