import * as DensityApi from '../src/index.js'
import {
  createDensityOldBlendedNoiseSource,
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
  densityOldBlendedNoise,
  densityRangeChoice,
  densityShift,
  densityShiftA,
  densityShiftB,
  densityShiftedNoise,
  densitySpline,
  densityUnary,
  densityWeirdScaledSampler,
  densityYClampedGradient,
  densityValue,
  expectDensitySuccess,
  expectResultFailure,
} from './density-function-test-utils.js'
import { describe, expect, it } from 'vitest'
import { Result } from 'effect'

const noiseSource = createDensityNoiseSource(
  (x, y, z) => x + y * 2 + z * 3,
  { minValue: -6, maxValue: 6 },
)

const oldBlendedNoiseSource = createDensityOldBlendedNoiseSource(
  {
    mainNoise: () => ({ sample: () => densityValue(1) }),
    minLimitNoise: () => ({ sample: () => densityValue(2) }),
    maxLimitNoise: () => ({ sample: () => densityValue(3) }),
  },
  { minValue: -3, maxValue: 3 },
)

const codecOptions = {
  encodeNoiseSource: () => 'test-source',
  decodeNoiseSource: (identifier: string) => {
    expect(identifier).toBe('test-source')
    return noiseSource
  },
  encodeOldBlendedNoiseSource: () => 'old-test-source',
  decodeOldBlendedNoiseSource: (identifier: string) => {
    expect(identifier).toBe('old-test-source')
    return oldBlendedNoiseSource
  },
}

const expectFailure = <Value, Failure>(
  result: Result.Result<Value, Failure>,
): Failure => {
  expect(Result.isFailure(result)).toBe(true)
  return expectResultFailure(result)
}

const failureMessage = (failure: unknown): string => {
  if (failure instanceof Error) {
    return failure.message
  }
  return String(failure)
}

const expectFailureContaining = <Value, Failure>(
  result: Result.Result<Value, Failure>,
  message: string,
): void => {
  const failure = expectFailure(result)
  expect(failureMessage(failure)).toContain(message)
}

describe('DensityFunction codec', () => {
  it('round-trips every density function kind', () => {
    const input = densityConstant(2)
    const nodes = [
      input,
      densityCoordinate('z', { scale: 2, offset: -1 }),
      densityNoise(noiseSource, { xzScale: 0.5, yScale: 2 }),
      densityOldBlendedNoise(oldBlendedNoiseSource, {
        xzScale: 0.25,
        yScale: 0.5,
        xzFactor: 80,
        yFactor: 160,
        smearScaleMultiplier: 4,
      }),
      DensityApi.densityBeardifier(),
      densityShift(noiseSource),
      densityShiftA(noiseSource),
      densityShiftB(noiseSource),
      densityShiftedNoise(noiseSource, {
        x: densityConstant(1),
        y: densityConstant(2),
        z: densityConstant(3),
      }, { xzScale: 0.5, yScale: 2 }),
      densityLinearOperation('mul', input, 3),
      densityWeirdScaledSampler(input, noiseSource, 'type-2'),
      densityEndIslands(123n),
      densityBinary('max', input, densityConstant(4)),
      densityUnary('invert', input),
      densityClamp(input, -1, 1),
      densityRangeChoice(input, {
        minInclusive: -1,
        maxExclusive: 1,
      }, densityConstant(4), densityConstant(5)),
      densityFindTopSurface(input, densityConstant(16), -32, 4),
      densityYClampedGradient(0, 10, -1, 1),
      densitySpline(input, createSpline([[0, 1], [1, 3]])),
      DensityApi.densityInterpolated(input),
      DensityApi.densityFlatCache(input),
      DensityApi.densityCache2D(input),
      DensityApi.densityCacheOnce(input),
      DensityApi.densityCacheAllInCell(input),
      DensityApi.densityBlendDensity(input),
      DensityApi.densityBlendAlpha(),
      DensityApi.densityBlendOffset(),
    ]

    for (const node of nodes) {
      const encoded = expectDensitySuccess(DensityApi.encodeDensityFunction(node, codecOptions))
      expect(encoded.kind).toBe(node.kind)
      expect(expectDensitySuccess(DensityApi.decodeDensityFunction(encoded, codecOptions)).kind)
        .toBe(node.kind)
      expect(
        expectDensitySuccess(
          DensityApi.parseDensityFunction(
            expectDensitySuccess(DensityApi.stringifyDensityFunction(node, codecOptions)),
            codecOptions,
          ),
        ).kind,
      ).toBe(node.kind)
    }
  })

  it('rejects malformed values and missing source codecs', () => {
    const noise = densityNoise(noiseSource)

    expectFailure(DensityApi.encodeDensityFunction(null as never))
    expectFailure(DensityApi.encodeDensityFunction(densityConstant(1), null as never))
    expectFailure(DensityApi.encodeDensityFunction(densityConstant(1), 1 as never))
    expectFailure(DensityApi.encodeDensityFunction(noise))
    expectFailure(DensityApi.encodeDensityFunction(noise, {
      encodeNoiseSource: () => '',
    }))
    expectFailure(DensityApi.encodeDensityFunction(noise, {
      encodeNoiseSource: () => 1 as never,
    }))
    const oldBlendedNoise = densityOldBlendedNoise(oldBlendedNoiseSource, {
      xzScale: 1,
      yScale: 1,
      xzFactor: 80,
      yFactor: 160,
      smearScaleMultiplier: 4,
    })
    expectFailureContaining(
      DensityApi.encodeDensityFunction(oldBlendedNoise),
      'encodeOldBlendedNoiseSource is required for old blended noise functions',
    )
    expectFailure(DensityApi.encodeDensityFunction(oldBlendedNoise, {
      encodeOldBlendedNoiseSource: () => '',
    }))
    expectFailure(DensityApi.encodeDensityFunction(oldBlendedNoise, {
      encodeOldBlendedNoiseSource: () => 1 as never,
    }))
    let kindReads = 0
    const unsupportedDensity = {
      get kind() {
        kindReads += 1
        if (kindReads <= 2) {
          return 'blend-alpha'
        }
        return 'unknown'
      },
      minValue: 0,
      maxValue: 0,
    }
    expectFailureContaining(
      DensityApi.encodeDensityFunction(unsupportedDensity as never),
      'unsupported density function kind',
    )

    expectFailure(DensityApi.decodeDensityFunction(null as never))
    expectFailure(DensityApi.decodeDensityFunction([] as never))
    expectFailure(DensityApi.decodeDensityFunction(1 as never))
    expectFailure(DensityApi.decodeDensityFunction({ kind: 1 } as never))
    expectFailure(DensityApi.decodeDensityFunction({ kind: 'unknown' } as never))
    expectFailure(DensityApi.decodeDensityFunction({ kind: 'constant', value: 'x' } as never))
    expectFailure(DensityApi.decodeDensityFunction({ kind: 'constant', value: Number.POSITIVE_INFINITY } as never))
    expectFailure(DensityApi.decodeDensityFunction({
      kind: 'coordinate',
      axis: 'x',
      scale: 1,
    } as never))
    expectFailure(DensityApi.decodeDensityFunction({
      kind: 'coordinate',
      axis: 'w',
      offset: 0,
      scale: 1,
    } as never))
    expectFailure(DensityApi.decodeDensityFunction({
      kind: 'linear-operation',
      argument: 1,
      input: expectDensitySuccess(DensityApi.encodeDensityFunction(densityConstant(1))),
      operation: 'div',
    } as never))
    expectFailure(DensityApi.decodeDensityFunction({
      kind: 'binary',
      left: expectDensitySuccess(DensityApi.encodeDensityFunction(densityConstant(1))),
      operation: 'div',
      right: expectDensitySuccess(DensityApi.encodeDensityFunction(densityConstant(1))),
    } as never))
    expectFailure(DensityApi.decodeDensityFunction({
      kind: 'unary',
      input: expectDensitySuccess(DensityApi.encodeDensityFunction(densityConstant(1))),
      operation: 'negate',
    } as never))
    expectFailure(DensityApi.decodeDensityFunction({
      input: expectDensitySuccess(DensityApi.encodeDensityFunction(densityConstant(1))),
      kind: 'weird-scaled-sampler',
      rarityValueMapper: 'type-3',
      source: 'test-source',
    } as never, codecOptions))
    expectFailure(DensityApi.decodeDensityFunction({ kind: 'end-islands', seed: 'x' } as never))
    expectFailure(DensityApi.decodeDensityFunction({
      kind: 'spline',
      input: expectDensitySuccess(DensityApi.encodeDensityFunction(densityConstant(1))),
      spline: null,
    } as never))
    expectFailure(DensityApi.decodeDensityFunction({
      kind: 'spline',
      input: expectDensitySuccess(DensityApi.encodeDensityFunction(densityConstant(1))),
      spline: [[0]],
    } as never))
    expectFailure(DensityApi.decodeDensityFunction({
      kind: 'spline',
      input: expectDensitySuccess(DensityApi.encodeDensityFunction(densityConstant(1))),
      spline: [['x', 1]],
    } as never))
    expectFailure(DensityApi.decodeDensityFunction({
      kind: 'find-top-surface',
      density: expectDensitySuccess(DensityApi.encodeDensityFunction(densityConstant(1))),
      upperBound: expectDensitySuccess(DensityApi.encodeDensityFunction(densityConstant(16))),
      lowerBound: -32,
      cellHeight: 0,
    } as never))
    const encodedSurfaceDensity = expectDensitySuccess(
      DensityApi.encodeDensityFunction(densityConstant(1)),
    )
    const encodedSurfaceUpperBound = expectDensitySuccess(
      DensityApi.encodeDensityFunction(densityConstant(16)),
    )
    expectFailureContaining(DensityApi.decodeDensityFunction({
      kind: 'find-top-surface',
      density: encodedSurfaceDensity,
      upperBound: encodedSurfaceUpperBound,
      lowerBound: '-32',
      cellHeight: 4,
    } as never), 'lowerBound must be a number')
    expectFailureContaining(DensityApi.decodeDensityFunction({
      kind: 'find-top-surface',
      density: encodedSurfaceDensity,
      upperBound: encodedSurfaceUpperBound,
      lowerBound: -31.5,
      cellHeight: 4,
    } as never), 'lowerBound must be a safe integer')
    expectFailureContaining(DensityApi.decodeDensityFunction({
      kind: 'find-top-surface',
      density: encodedSurfaceDensity,
      upperBound: encodedSurfaceUpperBound,
      lowerBound: -32,
      cellHeight: '4',
    } as never), 'cellHeight must be a number')

    const encodedNoise = {
      kind: 'noise',
      source: 'test-source',
      xzScale: 1,
      yScale: 1,
    } as const
    expectFailure(DensityApi.decodeDensityFunction({
      ...encodedNoise,
      source: '',
    }))
    expectFailure(DensityApi.decodeDensityFunction(encodedNoise))
    expectFailure(DensityApi.decodeDensityFunction(encodedNoise, {
      decodeNoiseSource: () => null as never,
    }))
    expectFailure(DensityApi.decodeDensityFunction(encodedNoise, {
      decodeNoiseSource: () => ({} as never),
    }))
    expectFailure(DensityApi.decodeDensityFunction(encodedNoise, {
      decodeNoiseSource: () => ({
        sample: 1,
        minValue: -1,
        maxValue: 1,
      } as never),
    }))
    expectFailure(DensityApi.decodeDensityFunction(encodedNoise, {
      decodeNoiseSource: () => ({
        sample: () => 0,
        minValue: Number.NaN,
        maxValue: 1,
      } as never),
    }))
    expectFailureContaining(DensityApi.decodeDensityFunction(encodedNoise, {
      decodeNoiseSource: () => ({
        sample: () => 0,
        minValue: -1,
        maxValue: '1',
      } as never),
    }), 'maxValue must be a number')

    const encodedOldBlendedNoise = {
      kind: 'old-blended-noise',
      source: 'old-test-source',
      xzScale: 1,
      yScale: 1,
      xzFactor: 80,
      yFactor: 160,
      smearScaleMultiplier: 4,
    } as const
    expectFailureContaining(
      DensityApi.decodeDensityFunction(encodedOldBlendedNoise),
      'decodeOldBlendedNoiseSource is required for old blended noise functions',
    )
    expectFailure(DensityApi.decodeDensityFunction({
      ...encodedOldBlendedNoise,
      source: '',
    }, codecOptions))
    expectFailure(DensityApi.decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => null as never,
    }))
    expectFailure(DensityApi.decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({} as never),
    }))
    expectFailure(DensityApi.decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({
        maxLimitNoise: () => 0 as never,
        minLimitNoise: () => 0 as never,
        minValue: -1,
        maxValue: 1,
      } as never),
    }))
    expectFailure(DensityApi.decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({
        mainNoise: () => 0 as never,
        maxLimitNoise: () => 0 as never,
        minValue: -1,
        maxValue: 1,
      } as never),
    }))
    expectFailure(DensityApi.decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({
        mainNoise: () => 0 as never,
        minLimitNoise: () => 0 as never,
        minValue: -1,
        maxValue: 1,
      } as never),
    }))
    expectFailure(DensityApi.decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({
        mainNoise: () => 0 as never,
        maxLimitNoise: () => 0 as never,
        minLimitNoise: () => 0 as never,
        minValue: Number.NaN,
        maxValue: 1,
      } as never),
    }))
    expectFailure(DensityApi.decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({
        mainNoise: () => 0 as never,
        maxLimitNoise: () => 0 as never,
        minLimitNoise: () => 0 as never,
        minValue: -1,
        maxValue: Number.NaN,
      } as never),
    }))

    expectFailure(DensityApi.parseDensityFunction(1 as never))
    expectFailure(DensityApi.stringifyDensityFunction(densityConstant(1), null as never))
  })
})
