import { describe, expect, it } from 'vitest'
import * as DensityApi from '../src/index.js'
import type {
  DensityOldBlendedNoiseOctave,
  DensityOldBlendedNoiseOctaveSource,
} from '../src/domain/density-function-types.js'
import {
  createDensityOldBlendedNoiseSource,
  densityBound,
  densityOldBlendedNoise,
  densityPosition,
  densityScale,
  densityValue,
  evaluateDensityFunction,
  expectDensitySuccess,
  expectResultFailure,
} from './density-function-test-utils.js'

const bounds = { minValue: densityBound(-4), maxValue: densityBound(4) }
const options = {
  smearScaleMultiplier: densityScale(4),
  xzFactor: densityScale(2),
  xzScale: densityScale(1),
  yFactor: densityScale(2),
  yScale: densityScale(1),
}

const createOctave = (
  value: number,
  calls?: number[][],
): DensityOldBlendedNoiseOctave => ({
  sample: (x, y, z, yScale, yMax) => {
    calls?.push([x, y, z, yScale, yMax])
    return densityValue(value)
  },
})

const createZeroOctaveSource = (
  value: number,
  calls?: number[][],
): DensityOldBlendedNoiseOctaveSource => {
  const octave = createOctave(value, calls)
  return (index) => {
    if (Number(index) === 0) {
      return octave
    }
    return globalThis.undefined
  }
}

const createOctaveSource = (
  samples: ReadonlyArray<number | undefined>,
): DensityOldBlendedNoiseOctaveSource => (index) => {
  const value = samples[Number(index)]
  if (typeof value === 'undefined') {
    return globalThis.undefined
  }
  return createOctave(value)
}

const createSource = (mainValue: number) => createDensityOldBlendedNoiseSource(
  {
    mainNoise: createZeroOctaveSource(mainValue),
    maxLimitNoise: createZeroOctaveSource(4),
    minLimitNoise: createZeroOctaveSource(2),
  },
  bounds,
)

const createSourceWithSamples = (
  mainSamples: ReadonlyArray<number | undefined>,
  maxLimitSamples: ReadonlyArray<number | undefined> = [],
  minLimitSamples: ReadonlyArray<number | undefined> = [],
) => expectDensitySuccess(DensityApi.createDensityOldBlendedNoiseSource({
  mainNoise: createOctaveSource(mainSamples),
  maxLimitNoise: createOctaveSource(maxLimitSamples),
  minLimitNoise: createOctaveSource(minLimitSamples),
}, bounds))

describe('old blended noise', () => {
  it('evaluates the three official octave stacks', () => {
    const calls: number[][] = []
    const source = createDensityOldBlendedNoiseSource(
      {
        mainNoise: createZeroOctaveSource(1, calls),
        maxLimitNoise: createZeroOctaveSource(4, calls),
        minLimitNoise: createZeroOctaveSource(2, calls),
      },
      bounds,
    )
    const density = densityOldBlendedNoise(source, options)

    expect(evaluateDensityFunction(density, { x: 0, y: 0, z: 0 })).toBeCloseTo(
      (2 / 512 + (4 / 512 - 2 / 512) * 0.55) / 128,
    )
    expect(calls).toHaveLength(3)
    expect(calls[0]?.[3]).toBeCloseTo(1368.824)
    expect(Object.isFrozen(source)).toBe(true)
    expect(Object.isFrozen(density)).toBe(true)
  })

  it('clamps the main blend and skips the irrelevant limit stack', () => {
    const lower = densityOldBlendedNoise(createSource(-20), options)
    const upper = densityOldBlendedNoise(createSource(20), options)

    expect(evaluateDensityFunction(lower, { x: 0, y: 0, z: 0 })).toBeCloseTo(2 / 512 / 128)
    expect(evaluateDensityFunction(upper, { x: 0, y: 0, z: 0 })).toBeCloseTo(4 / 512 / 128)
  })

  it('rejects invalid sources and options at construction', () => {
    expect(
      expectResultFailure(
        DensityApi.createDensityOldBlendedNoiseSource(null as never, bounds),
      ).message,
    ).toContain('old blended noise source must be an object')
    expect(
      expectResultFailure(DensityApi.createDensityOldBlendedNoiseSource({
        mainNoise: () => globalThis.undefined,
        maxLimitNoise: () => globalThis.undefined,
        minLimitNoise: () => globalThis.undefined,
      }, null as never)).message,
    ).toContain('old blended noise bounds must be an object')
    expect(
      expectResultFailure(DensityApi.densityOldBlendedNoise(null as never, options)).message,
    ).toContain('old blended noise source must be an object')
    expect(
      expectResultFailure(DensityApi.createDensityOldBlendedNoiseSource({
        mainNoise: null as never,
        maxLimitNoise: () => 0 as never,
        minLimitNoise: () => 0 as never,
      }, bounds)).message,
    ).toContain('old blended noise mainNoise must be a function')
    expect(
      expectResultFailure(DensityApi.createDensityOldBlendedNoiseSource({
        mainNoise: () => 0 as never,
        minLimitNoise: null as never,
        maxLimitNoise: () => 0 as never,
      }, bounds)).message,
    ).toContain('old blended noise minLimitNoise must be a function')
    expect(
      expectResultFailure(DensityApi.createDensityOldBlendedNoiseSource({
        mainNoise: () => 0 as never,
        minLimitNoise: () => 0 as never,
        maxLimitNoise: null as never,
      }, bounds)).message,
    ).toContain('old blended noise maxLimitNoise must be a function')
    expect(
      expectResultFailure(DensityApi.densityOldBlendedNoise(createSource(1), null as never)).message,
    ).toContain('old blended noise options must be an object')
    expect(
      expectResultFailure(DensityApi.densityOldBlendedNoise(createSource(1), {
        ...options,
        yFactor: Number.NaN as never,
      })).message,
    ).toContain('yFactor must be finite')
  })

  it('rejects invalid coordinates, scales, and octave callback samples', () => {
    const density = densityOldBlendedNoise(createSource(1), options)
    expect(
      expectResultFailure(DensityApi.evaluateDensityFunction(
        density,
        densityPosition({ x: Number.MAX_VALUE, y: 0, z: 0 }),
      )).message,
    ).toContain('old blended noise x must be finite')

    const overflowingSmear = densityOldBlendedNoise(createSource(1), {
      ...options,
      yScale: Number.MAX_VALUE,
    })
    expect(
      expectResultFailure(DensityApi.evaluateDensityFunction(
        overflowingSmear,
        densityPosition({ x: 0, y: 0, z: 0 }),
      )).message,
    ).toContain('old blended noise smear must be finite')

    const nonFiniteSampleSource = expectDensitySuccess(DensityApi.createDensityOldBlendedNoiseSource({
      mainNoise: () => ({ sample: () => Number.NaN as never }),
      maxLimitNoise: () => globalThis.undefined,
      minLimitNoise: () => globalThis.undefined,
    }, bounds))
    const nonFiniteSampleDensity = densityOldBlendedNoise(nonFiniteSampleSource, options)
    expect(
      expectResultFailure(DensityApi.evaluateDensityFunction(
        nonFiniteSampleDensity,
        densityPosition({ x: 0, y: 0, z: 0 }),
      )).message,
    ).toContain('old blended noise octave result must be finite')

    const nonNumericSampleSource = expectDensitySuccess(DensityApi.createDensityOldBlendedNoiseSource({
      mainNoise: () => ({ sample: () => 'invalid' as never }),
      maxLimitNoise: () => globalThis.undefined,
      minLimitNoise: () => globalThis.undefined,
    }, bounds))
    const nonNumericSampleDensity = densityOldBlendedNoise(nonNumericSampleSource, options)
    expect(
      expectResultFailure(DensityApi.evaluateDensityFunction(
        nonNumericSampleDensity,
        densityPosition({ x: 0, y: 0, z: 0 }),
      )).message,
    ).toContain('old blended noise octave result must be a number')
  })

  it('rejects overflow in normalized and accumulated octave samples', () => {
    const normalizedMainOverflow = densityOldBlendedNoise(
      createSourceWithSamples([globalThis.undefined, Number.MAX_VALUE]),
      options,
    )
    expect(
      expectResultFailure(DensityApi.evaluateDensityFunction(
        normalizedMainOverflow,
        densityPosition({ x: 0, y: 0, z: 0 }),
      )).message,
    ).toContain('old blended noise octave result must be finite')

    const normalizedLimitOverflow = densityOldBlendedNoise(
      createSourceWithSamples([0], [globalThis.undefined, Number.MAX_VALUE]),
      options,
    )
    expect(
      expectResultFailure(DensityApi.evaluateDensityFunction(
        normalizedLimitOverflow,
        densityPosition({ x: 0, y: 0, z: 0 }),
      )).message,
    ).toContain('old blended noise octave result must be finite')

    const largeFiniteSample = Number.MAX_VALUE * 0.4
    const mainSumOverflow = densityOldBlendedNoise(
      createSourceWithSamples([largeFiniteSample, largeFiniteSample]),
      options,
    )
    expect(
      expectResultFailure(DensityApi.evaluateDensityFunction(
        mainSumOverflow,
        densityPosition({ x: 0, y: 0, z: 0 }),
      )).message,
    ).toContain('old blended noise main sum must be finite')
  })

  it('rejects overflow in each accumulated limit octave stack', () => {
    const main = [0]
    const largeLimitSamples = [Number.MAX_VALUE * 0.4, Number.MAX_VALUE * 0.4]
    const maxLimitOverflow = densityOldBlendedNoise(
      createSourceWithSamples(main, largeLimitSamples),
      options,
    )
    expect(
      expectResultFailure(DensityApi.evaluateDensityFunction(
        maxLimitOverflow,
        densityPosition({ x: 0, y: 0, z: 0 }),
      )).message,
    ).toContain('old blended noise max sum must be finite')

    const minLimitOverflow = densityOldBlendedNoise(
      createSourceWithSamples(main, [], largeLimitSamples),
      options,
    )
    expect(
      expectResultFailure(DensityApi.evaluateDensityFunction(
        minLimitOverflow,
        densityPosition({ x: 0, y: 0, z: 0 }),
      )).message,
    ).toContain('old blended noise min sum must be finite')
  })
})
