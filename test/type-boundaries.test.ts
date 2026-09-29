import { describe, expect, it } from 'vitest'
import { createJavaRandom } from '../src/domain/java-random.js'
import { requireDefined } from '../src/domain/defined.js'
import {
  decodeDensityFunction,
} from '../src/index.js'
import { evaluateDensityFunction } from '../src/domain/density-function-evaluator.js'

describe('validated boundaries', () => {
  it('rejects an absent indexed value', () => {
    const absent = Reflect.get({}, 'absent')
    expect(() => requireDefined(absent, 'value')).toThrow(RangeError)
  })

  it('rejects an explicitly undefined random bound', () => {
    const absent = Reflect.get({}, 'absent')
    expect(() => createJavaRandom(1n).nextInt(absent)).toThrow(TypeError)
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
          minLimitNoise: () => ({ sample: () => 0 }),
          maxLimitNoise: () => ({ sample: () => 0 }),
          minValue: -1,
          maxValue: 1,
        }),
      })
    const position = { x: 0, y: 0, z: 0 }
    expect(() => evaluateDensityFunction(decode(() => null), position)).toThrow(TypeError)
    expect(evaluateDensityFunction(
      decode(() => Reflect.get({}, 'absent')),
      position,
    )).toBeTypeOf('number')
    expect(() => evaluateDensityFunction(decode(() => ({ sample: 'bad' })), position)).toThrow(TypeError)
    expect(() => evaluateDensityFunction(decode(() => ({ sample: () => 'bad' })), position)).toThrow(TypeError)
    expect(evaluateDensityFunction(
      decode(() => ({ sample: () => 1 })),
      position,
    )).toBeTypeOf('number')
  })
})
