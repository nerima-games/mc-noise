import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import { channelSeed, fbm2D, latticeValue, valueNoise2D } from '../src/index'
import {
  NoiseChannelLabel,
  LatticeCoordinate,
  NoiseFrequency,
  ValueNoiseFbmSample,
} from '../src/domain/value-noise'
import { NoiseSeed } from '../src/domain/seed'
import { OctaveAmplitude, OctaveCount } from '../src/domain/octaves'

const expectSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

const fbmOptions = (octaves: number, frequency: number, persistence: number) => ({
  octaves: OctaveCount(octaves),
  frequency: NoiseFrequency(frequency),
  persistence: OctaveAmplitude(persistence),
})

describe('value noise compatibility API', () => {
  it('is deterministic and decorrelates named channels', () => {
    expect(channelSeed(NoiseSeed(42), NoiseChannelLabel('terrain'))).toBe(
      channelSeed(NoiseSeed(42), NoiseChannelLabel('terrain')),
    )
    expect(channelSeed(NoiseSeed(42), NoiseChannelLabel('terrain'))).not.toBe(
      channelSeed(NoiseSeed(42), NoiseChannelLabel('temperature')),
    )
  })

  it('matches the reference vectors for hashing and interpolation', () => {
    expect(channelSeed(NoiseSeed(42), NoiseChannelLabel('terrain'))).toBe(2699606907)
    expect(latticeValue(NoiseSeed(42), LatticeCoordinate(-16), LatticeCoordinate(32))).toBe(0.7420056120026857)
    expect(
      expectSuccess(valueNoise2D(NoiseSeed(42), -16.25, 32.75, NoiseFrequency(0.08))),
    ).toBe(0.6667454798861964)
  })

  it('keeps lattice and interpolated samples in the unit interval', () => {
    const fbmSample = expectSuccess(
      fbm2D(NoiseSeed(42), -16.25, 32.75, fbmOptions(4, 0.08, 0.5)),
    )
    const samples = [
      latticeValue(NoiseSeed(42), LatticeCoordinate(-16), LatticeCoordinate(32)),
      expectSuccess(valueNoise2D(NoiseSeed(42), -16.25, 32.75, NoiseFrequency(0.08))),
      fbmSample,
    ]

    expect(Result.isSuccess(ValueNoiseFbmSample.result(fbmSample))).toBe(true)
    for (const sample of samples) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(1)
    }
  })

  it('rejects non-finite and non-integral numeric parameters', () => {
    // @ts-expect-error malformed untrusted input exercises the channel brand
    expect(Result.isFailure(NoiseChannelLabel.result(42))).toBe(true)
    expect(Result.isFailure(NoiseFrequency.result(Number.POSITIVE_INFINITY))).toBe(true)
    expect(Result.isFailure(ValueNoiseFbmSample.result(Number.POSITIVE_INFINITY))).toBe(true)
    expect(Result.isFailure(LatticeCoordinate.result(1.5))).toBe(true)

    for (const frequency of [Number.NaN, Number.POSITIVE_INFINITY]) {
      // @ts-expect-error malformed runtime input exercises the frequency boundary
      const result = valueNoise2D(NoiseSeed(42), 1, 2, frequency)
      expect(Result.isFailure(result)).toBe(true)
    }

    // @ts-expect-error malformed runtime input exercises option validation
    const invalidOctaves = fbm2D(NoiseSeed(42), 1, 2, { octaves: 1.5, frequency: NoiseFrequency(0.1), persistence: OctaveAmplitude(0.5) })
    expect(Result.isFailure(invalidOctaves)).toBe(true)
    // @ts-expect-error malformed runtime input exercises option validation
    const invalidFrequency = fbm2D(NoiseSeed(42), 1, 2, { octaves: OctaveCount(1), frequency: Number.NaN, persistence: OctaveAmplitude(0.5) })
    expect(Result.isFailure(invalidFrequency)).toBe(true)
    // @ts-expect-error malformed runtime input exercises option validation
    const invalidPersistence = fbm2D(NoiseSeed(42), 1, 2, { octaves: OctaveCount(1), frequency: NoiseFrequency(0.1), persistence: Number.NEGATIVE_INFINITY })
    expect(Result.isFailure(invalidPersistence)).toBe(true)
  })

  it('returns range failures for invalid samples, lattice bounds, and overflowing fBm state', () => {
    const seed = NoiseSeed(42)
    const frequency = NoiseFrequency(1)
    expect(Result.isFailure(valueNoise2D(seed, Number.NaN, 0, frequency))).toBe(true)
    expect(Result.isFailure(valueNoise2D(seed, 0, Number.NaN, frequency))).toBe(true)
    expect(Result.isFailure(valueNoise2D(seed, Number.MAX_VALUE, 0, NoiseFrequency(2)))).toBe(true)
    expect(Result.isFailure(valueNoise2D(seed, 0, Number.MAX_VALUE, NoiseFrequency(2)))).toBe(true)
    expect(Result.isFailure(valueNoise2D(seed, Number.MAX_SAFE_INTEGER + 2, 0, frequency))).toBe(true)
    expect(Result.isFailure(valueNoise2D(seed, 0, Number.MAX_SAFE_INTEGER + 2, frequency))).toBe(true)
    expect(Result.isFailure(valueNoise2D(seed, Number.MAX_SAFE_INTEGER, 0, frequency))).toBe(true)
    expect(Result.isFailure(valueNoise2D(seed, 0, Number.MAX_SAFE_INTEGER, frequency))).toBe(true)

    expect(Result.isFailure(fbm2D(seed, Number.NaN, 0, fbmOptions(1, 1, 0.5)))).toBe(true)
    expect(Result.isFailure(fbm2D(seed, 0, Number.NaN, fbmOptions(1, 1, 0.5)))).toBe(true)
    expect(Result.isFailure(fbm2D(seed, Number.MAX_SAFE_INTEGER + 2, 0, fbmOptions(1, 1, 0.5)))).toBe(true)
    expect(Result.isFailure(fbm2D(seed, 0, 0, fbmOptions(2, Number.MAX_VALUE, 0.5)))).toBe(true)
    expect(Result.isFailure(fbm2D(seed, 1, 1, fbmOptions(3, 1, Number.MAX_VALUE)))).toBe(true)
    expect(Result.isFailure(fbm2D(seed, 1, 1, fbmOptions(2_000, 0, 1.5)))).toBe(true)
  })

  it('returns zero for an empty fBm configuration', () => {
    expect(expectSuccess(fbm2D(NoiseSeed(42), 1, 2, fbmOptions(0, 0.1, 0.5)))).toBe(0)
    expect(expectSuccess(fbm2D(NoiseSeed(42), 1, 2, fbmOptions(2, 0.1, -1)))).toBe(0)
  })
})
