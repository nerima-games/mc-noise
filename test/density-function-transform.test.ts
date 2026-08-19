import { describe, expect, it } from 'vitest'
import {
  createDensityNoiseSource,
  createSpline,
  densityBinary,
  densityBlendAlpha,
  densityBlendDensity,
  densityBlendOffset,
  densityCache2D,
  densityCacheAllInCell,
  densityCacheOnce,
  densityClamp,
  densityConstant,
  densityCoordinate,
  densityEndIslands,
  densityFlatCache,
  densityInterpolated,
  densityLinearOperation,
  densityNoise,
  densityRangeChoice,
  densityShift,
  densityShiftA,
  densityShiftB,
  densityShiftedNoise,
  densitySpline,
  densityUnary,
  densityWeirdScaledSampler,
  densityYClampedGradient,
  mapAll,
  mapDensityFunction,
} from '../src/index.js'

describe('DensityFunction recursive transformation', () => {
  it('visits every official density node and rebuilds child nodes', () => {
    const source = createDensityNoiseSource(
      (x, y, z) => x + y + z,
      { minValue: -10, maxValue: 10 },
    )
    const constant = densityConstant(2)
    const nodes = [
      constant,
      densityCoordinate('x'),
      densityNoise(source),
      densityShift(source),
      densityShiftA(source),
      densityShiftB(source),
      densityShiftedNoise(source, {
        x: constant,
        y: densityConstant(3),
        z: densityConstant(4),
      }),
      densityLinearOperation('add', constant, 3),
      densityWeirdScaledSampler(constant, source, 'type-1'),
      densityEndIslands(0n),
      densityBinary('add', constant, densityConstant(1)),
      densityUnary('abs', constant),
      densityClamp(constant, -1, 1),
      densityRangeChoice(constant, { minInclusive: -1, maxExclusive: 1 }, constant, constant),
      densityYClampedGradient(0, 10, -1, 1),
      densitySpline(constant, createSpline([[0, 0], [1, 1]])),
      densityInterpolated(constant),
      densityFlatCache(constant),
      densityCache2D(constant),
      densityCacheOnce(constant),
      densityCacheAllInCell(constant),
      densityBlendDensity(constant),
      densityBlendAlpha(),
      densityBlendOffset(),
    ]
    const visited: string[] = []
    const visitor = (density: (typeof nodes)[number]) => {
      visited.push(density.kind)
      if (density.kind === 'constant') {
        return densityConstant(density.value + 1)
      }
      return density
    }

    const mapped = nodes.map((density) => mapDensityFunction(density, visitor))

    expect(mapped).toHaveLength(nodes.length)
    expect(new Set(visited)).toEqual(new Set(nodes.map((density) => density.kind)))
    expect(mapped[0]).toMatchObject({ kind: 'constant', value: 3 })
    expect(mapAll(nodes[10]!, () => densityConstant(7))).toMatchObject({
      kind: 'constant',
      value: 7,
    })
  })

  it('rejects invalid density values, visitors, and visitor results', () => {
    expect(() => mapDensityFunction(null as never, (density) => density)).toThrow(
      'density must be a DensityFunction',
    )
    expect(() => mapDensityFunction(densityConstant(1), null as never)).toThrow(
      'visitor must be a function',
    )
    expect(() => mapDensityFunction(densityConstant(1), () => null as never)).toThrow(
      'visitor result must be a DensityFunction',
    )
  })
})
