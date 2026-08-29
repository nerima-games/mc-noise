import { describe, expect, it } from 'vitest'
import {
  beardifier,
  createDensityOldBlendedNoiseSource,
  createDensityNoiseSource,
  decodeDensityFunction,
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
  densityFindTopSurface,
  densityFlatCache,
  densityInterpolated,
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
  encodeDensityFunction,
  parseDensityFunction,
  stringifyDensityFunction,
} from '../src/index.js'

const noiseSource = createDensityNoiseSource(
  (x, y, z) => x + y * 2 + z * 3,
  { minValue: -6, maxValue: 6 },
)

const oldBlendedNoiseSource = createDensityOldBlendedNoiseSource(
  {
    mainNoise: () => ({ sample: () => 1 }),
    minLimitNoise: () => ({ sample: () => 2 }),
    maxLimitNoise: () => ({ sample: () => 3 }),
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
      beardifier(),
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
      densitySpline(input, [[0, 1], [1, 3]]),
      densityInterpolated(input),
      densityFlatCache(input),
      densityCache2D(input),
      densityCacheOnce(input),
      densityCacheAllInCell(input),
      densityBlendDensity(input),
      densityBlendAlpha(),
      densityBlendOffset(),
    ]

    for (const node of nodes) {
      const encoded = encodeDensityFunction(node, codecOptions)
      expect(encoded.kind).toBe(node.kind)
      expect(decodeDensityFunction(encoded, codecOptions).kind).toBe(node.kind)
      expect(parseDensityFunction(stringifyDensityFunction(node, codecOptions), codecOptions).kind).toBe(node.kind)
    }
  })

  it('rejects malformed values and missing source codecs', () => {
    const noise = densityNoise(noiseSource)

    expect(() => encodeDensityFunction(null as never)).toThrow()
    expect(() => encodeDensityFunction(densityConstant(1), null as never)).toThrow()
    expect(() => encodeDensityFunction(densityConstant(1), 1 as never)).toThrow()
    expect(() => encodeDensityFunction(noise)).toThrow()
    expect(() => encodeDensityFunction(noise, {
      encodeNoiseSource: () => '',
    })).toThrow()
    expect(() => encodeDensityFunction(noise, {
      encodeNoiseSource: () => 1 as never,
    })).toThrow()
    const oldBlendedNoise = densityOldBlendedNoise(oldBlendedNoiseSource, {
      xzScale: 1,
      yScale: 1,
      xzFactor: 80,
      yFactor: 160,
      smearScaleMultiplier: 4,
    })
    expect(() => encodeDensityFunction(oldBlendedNoise)).toThrow(
      'encodeOldBlendedNoiseSource is required for old blended noise functions',
    )
    expect(() => encodeDensityFunction(oldBlendedNoise, {
      encodeOldBlendedNoiseSource: () => '',
    })).toThrow()
    expect(() => encodeDensityFunction(oldBlendedNoise, {
      encodeOldBlendedNoiseSource: () => 1 as never,
    })).toThrow()
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
    expect(() => encodeDensityFunction(unsupportedDensity as never)).toThrow(
      'unsupported density function kind',
    )

    expect(() => decodeDensityFunction(null as never)).toThrow()
    expect(() => decodeDensityFunction([] as never)).toThrow()
    expect(() => decodeDensityFunction(1 as never)).toThrow()
    expect(() => decodeDensityFunction({ kind: 1 } as never)).toThrow()
    expect(() => decodeDensityFunction({ kind: 'unknown' } as never)).toThrow()
    expect(() => decodeDensityFunction({ kind: 'constant', value: 'x' } as never)).toThrow()
    expect(() => decodeDensityFunction({ kind: 'constant', value: Number.POSITIVE_INFINITY } as never)).toThrow()
    expect(() => decodeDensityFunction({
      kind: 'coordinate',
      axis: 'x',
      scale: 1,
    } as never)).toThrow()
    expect(() => decodeDensityFunction({
      kind: 'coordinate',
      axis: 'w',
      offset: 0,
      scale: 1,
    } as never)).toThrow()
    expect(() => decodeDensityFunction({
      kind: 'linear-operation',
      argument: 1,
      input: encodeDensityFunction(densityConstant(1)),
      operation: 'div',
    } as never)).toThrow()
    expect(() => decodeDensityFunction({
      kind: 'binary',
      left: encodeDensityFunction(densityConstant(1)),
      operation: 'div',
      right: encodeDensityFunction(densityConstant(1)),
    } as never)).toThrow()
    expect(() => decodeDensityFunction({
      kind: 'unary',
      input: encodeDensityFunction(densityConstant(1)),
      operation: 'negate',
    } as never)).toThrow()
    expect(() => decodeDensityFunction({
      input: encodeDensityFunction(densityConstant(1)),
      kind: 'weird-scaled-sampler',
      rarityValueMapper: 'type-3',
      source: 'test-source',
    } as never, codecOptions)).toThrow()
    expect(() => decodeDensityFunction({ kind: 'end-islands', seed: 'x' } as never)).toThrow()
    expect(() => decodeDensityFunction({
      kind: 'spline',
      input: encodeDensityFunction(densityConstant(1)),
      spline: null,
    } as never)).toThrow()
    expect(() => decodeDensityFunction({
      kind: 'spline',
      input: encodeDensityFunction(densityConstant(1)),
      spline: [[0]],
    } as never)).toThrow()
    expect(() => decodeDensityFunction({
      kind: 'spline',
      input: encodeDensityFunction(densityConstant(1)),
      spline: [['x', 1]],
    } as never)).toThrow()
    expect(() => decodeDensityFunction({
      kind: 'find-top-surface',
      density: encodeDensityFunction(densityConstant(1)),
      upperBound: encodeDensityFunction(densityConstant(16)),
      lowerBound: -32,
      cellHeight: 0,
    } as never)).toThrow()

    const encodedNoise = {
      kind: 'noise',
      source: 'test-source',
      xzScale: 1,
      yScale: 1,
    } as const
    expect(() => decodeDensityFunction({
      ...encodedNoise,
      source: '',
    })).toThrow()
    expect(() => decodeDensityFunction(encodedNoise)).toThrow()
    expect(() => decodeDensityFunction(encodedNoise, {
      decodeNoiseSource: () => null as never,
    })).toThrow()
    expect(() => decodeDensityFunction(encodedNoise, {
      decodeNoiseSource: () => ({} as never),
    })).toThrow()
    expect(() => decodeDensityFunction(encodedNoise, {
      decodeNoiseSource: () => ({
        sample: 1,
        minValue: -1,
        maxValue: 1,
      } as never),
    })).toThrow()
    expect(() => decodeDensityFunction(encodedNoise, {
      decodeNoiseSource: () => ({
        sample: () => 0,
        minValue: Number.NaN,
        maxValue: 1,
      } as never),
    })).toThrow()

    const encodedOldBlendedNoise = {
      kind: 'old-blended-noise',
      source: 'old-test-source',
      xzScale: 1,
      yScale: 1,
      xzFactor: 80,
      yFactor: 160,
      smearScaleMultiplier: 4,
    } as const
    expect(() => decodeDensityFunction(encodedOldBlendedNoise)).toThrow(
      'decodeOldBlendedNoiseSource is required for old blended noise functions',
    )
    expect(() => decodeDensityFunction({
      ...encodedOldBlendedNoise,
      source: '',
    }, codecOptions)).toThrow()
    expect(() => decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => null as never,
    })).toThrow()
    expect(() => decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({} as never),
    })).toThrow()
    expect(() => decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({
        maxLimitNoise: () => 0 as never,
        minLimitNoise: () => 0 as never,
        minValue: -1,
        maxValue: 1,
      } as never),
    })).toThrow()
    expect(() => decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({
        mainNoise: () => 0 as never,
        maxLimitNoise: () => 0 as never,
        minValue: -1,
        maxValue: 1,
      } as never),
    })).toThrow()
    expect(() => decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({
        mainNoise: () => 0 as never,
        minLimitNoise: () => 0 as never,
        minValue: -1,
        maxValue: 1,
      } as never),
    })).toThrow()
    expect(() => decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({
        mainNoise: () => 0 as never,
        maxLimitNoise: () => 0 as never,
        minLimitNoise: () => 0 as never,
        minValue: Number.NaN,
        maxValue: 1,
      } as never),
    })).toThrow()
    expect(() => decodeDensityFunction(encodedOldBlendedNoise, {
      decodeOldBlendedNoiseSource: () => ({
        mainNoise: () => 0 as never,
        maxLimitNoise: () => 0 as never,
        minLimitNoise: () => 0 as never,
        minValue: -1,
        maxValue: Number.NaN,
      } as never),
    })).toThrow()

    expect(() => parseDensityFunction(1 as never)).toThrow()
    expect(() => stringifyDensityFunction(densityConstant(1), null as never)).toThrow()
  })
})
