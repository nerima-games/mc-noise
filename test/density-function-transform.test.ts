import { describe, expect, it } from 'vitest'
import {
  densityBlendAlpha,
  densityBlendDensity,
  densityBlendOffset,
  densityCache2D,
  densityCacheAllInCell,
  densityCacheOnce,
  densityFlatCache,
  densityInterpolated,
  mapAll,
  mapDensityFunction,
} from '../src/index.js'
import * as DensityApi from '../src/index.js'
import {
  createDensityNoiseSource,
  createSpline,
  densityBinary,
  densityClamp,
  densityConstant,
  densityCoordinate,
  densityEndIslands,
  densityFindTopSurface,
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
  expectDensitySuccess,
  expectResultFailure,
} from './density-function-test-utils.js'

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
      densityFindTopSurface(constant, densityCoordinate('y'), -16, 4),
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

    const mapped = nodes.map((density) =>
      expectDensitySuccess(mapDensityFunction(density, visitor)),
    )

    expect(mapped).toHaveLength(nodes.length)
    expect(new Set(visited)).toEqual(new Set(nodes.map((density) => density.kind)))
    expect(mapped[0]).toMatchObject({ kind: 'constant', value: 3 })
    expect(expectDensitySuccess(mapAll(nodes[10]!, () => densityConstant(7)))).toMatchObject({
      kind: 'constant',
      value: 7,
    })
  })

  it('rejects invalid density values, visitors, and visitor results', () => {
    expect(
      expectResultFailure(
        DensityApi.mapDensityFunction(null as never, (density) => density),
      ).message,
    ).toContain('density must be a DensityFunction')
    expect(
      expectResultFailure(
        DensityApi.mapDensityFunction(densityConstant(1), null as never),
      ).message,
    ).toContain('visitor must be a function')
    expect(
      expectResultFailure(
        DensityApi.mapDensityFunction(densityConstant(1), () => null as never),
      ).message,
    ).toContain('visitor result must be a DensityFunction')
  })
})
