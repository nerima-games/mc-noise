import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import { PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { JavaRandomBound, createJavaRandom } from '../src/domain/java-random.js'
import { DefinedValueName, requireDefined } from '../src/domain/defined.js'
import {
  DensityBound,
  DensityValue,
  decodeDensityFunction,
} from '../src/index.js'
import { evaluateDensityFunction } from '../src/domain/density-function-evaluator.js'

describe('validated boundaries', () => {
  it('rejects an absent indexed value', () => {
    const absent = Reflect.get({}, 'absent')
    const result = requireDefined(absent, DefinedValueName('value'))
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailure(result) && result.failure).toBeInstanceOf(RangeError)
  })

  it('rejects an explicitly undefined random bound', () => {
    const random = createJavaRandom(1n)
    expect(Result.isSuccess(random)).toBe(true)
    if (Result.isFailure(random)) {
      return
    }
    const absent = JavaRandomBound.result(Reflect.get({}, 'absent'))
    expect(Result.isFailure(absent)).toBe(true)
    const result = random.success.nextInt(globalThis.undefined)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailure(result) && result.failure).toBeInstanceOf(TypeError)
  })

  it('validates old blended noise callbacks after decoding', () => {
    const encoded = {
      kind: 'old-blended-noise',
      source: 'source',
      xzScale: 1,
      yScale: 1,
      xzFactor: 1,
      yFactor: 1,
      smearScaleMultiplier: 1,
    } as const
    const decode = (mainNoise: (octave: number) => unknown) =>
      decodeDensityFunction(encoded, {
        decodeOldBlendedNoiseSource: () => ({
          mainNoise: mainNoise as never,
          minLimitNoise: () => ({ sample: () => DensityValue(0) }),
          maxLimitNoise: () => ({ sample: () => DensityValue(0) }),
          minValue: DensityBound(-1),
          maxValue: DensityBound(1),
        }),
      })
    const position = {
      x: PositionAxis(0),
      y: PositionAxis(0),
      z: PositionAxis(0),
    }
    const missingSource = decode(() => null)
    expect(Result.isFailure(missingSource)).toBe(true)
    expect(Result.isFailure(missingSource) && missingSource.failure).toBeInstanceOf(TypeError)

    const absentOctave = decode(() => Reflect.get({}, 'absent'))
    expect(Result.isSuccess(absentOctave)).toBe(true)
    if (Result.isSuccess(absentOctave)) {
      const evaluated = evaluateDensityFunction(absentOctave.success, position)
      expect(Result.isSuccess(evaluated)).toBe(true)
    }

    const invalidSampler = decode(() => ({ sample: 'bad' }))
    expect(Result.isFailure(invalidSampler)).toBe(true)
    expect(Result.isFailure(invalidSampler) && invalidSampler.failure).toBeInstanceOf(TypeError)

    const invalidSample = decode(() => ({ sample: () => 'bad' }))
    expect(Result.isSuccess(invalidSample)).toBe(true)
    if (Result.isSuccess(invalidSample)) {
      const evaluated = evaluateDensityFunction(invalidSample.success, position)
      expect(Result.isFailure(evaluated)).toBe(true)
      expect(Result.isFailure(evaluated) && evaluated.failure).toBeInstanceOf(TypeError)
    }

    const valid = decode(() => ({ sample: () => 1 }))
    expect(Result.isSuccess(valid)).toBe(true)
    if (Result.isSuccess(valid)) {
      const evaluated = evaluateDensityFunction(valid.success, position)
      expect(Result.isSuccess(evaluated)).toBe(true)
      expect(Result.isSuccess(evaluated) && evaluated.success).toBeTypeOf('number')
    }
  })
})
