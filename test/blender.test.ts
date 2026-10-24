import { Result } from 'effect'
import { PositionAxis, position } from '@nerima-games/mc-kernel/domain/coordinates'
import { describe, expect, it } from 'vitest'
import * as api from '../src/index.js'

const unwrap = <Value, ErrorValue>(result: Result.Result<Value, ErrorValue>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

const worldPosition = position(PositionAxis(2), PositionAxis(3), PositionAxis(5))
const density = (value: number): api.DensityValue => api.DensityValue(value)
const densityFunction = (value: number): api.DensityFunction =>
  unwrap(api.densityConstant(density(value)))

describe('Blender', () => {
  it('provides identity behavior by default', () => {
    const blender = api.emptyBlender()

    expect(Object.isFrozen(blender)).toBe(true)
    expect(unwrap(blender.blendDensity(worldPosition, density(7)))).toBe(7)
    expect(unwrap(blender.blendOffsetAndFactor(PositionAxis(2), PositionAxis(5))).alpha).toBe(1)
    expect(unwrap(blender.blendOffsetAndFactor(PositionAxis(2), PositionAxis(5)))).toEqual({
      alpha: 1,
      blendingOffset: 0,
    })
    expect(unwrap(api.requireBlender(blender))).not.toBe(blender)
  })

  it('validates and adapts Result callbacks', () => {
    const blender = unwrap(api.createBlender({
      blendDensity: (inputPosition, inputDensity) =>
        Result.succeed(density(inputDensity + inputPosition.y)),
      blendOffsetAndFactor: (x, z) => Result.succeed({
        alpha: density(x / 10),
        blendingOffset: density(z),
      }),
    }))
    const context = unwrap(api.createDensityEvaluationContextFromBlender(blender))

    expect(unwrap(blender.blendDensity(worldPosition, density(7)))).toBe(10)
    expect(unwrap(blender.blendOffsetAndFactor(PositionAxis(2), PositionAxis(5)))).toEqual({
      alpha: 0.2,
      blendingOffset: 5,
    })
    expect(
      unwrap(api.evaluateDensityFunction(api.densityBlendDensity(densityFunction(7)), worldPosition, context)),
    ).toBe(10)
    expect(unwrap(api.evaluateDensityFunction(api.densityBlendAlpha(), worldPosition, context))).toBe(0.2)
    expect(unwrap(api.evaluateDensityFunction(api.densityBlendOffset(), worldPosition, context))).toBe(5)
  })

  it('reports malformed options, callbacks, and callback outputs with Result', () => {
    expect(Result.isFailure(api.createBlender(null as never))).toBe(true)
    expect(Result.isFailure(api.createBlender({ blendDensity: 0 as never }))).toBe(true)
    expect(Result.isFailure(api.createBlender({ blendOffsetAndFactor: 0 as never }))).toBe(true)
    expect(Result.isFailure(api.requireBlender(null))).toBe(true)
    expect(Result.isFailure(api.requireBlender({}))).toBe(true)

    const invalidDensity = unwrap(api.createBlender({
      blendDensity: () => Result.succeed(Number.NaN as never),
    }))
    expect(Result.isFailure(invalidDensity.blendDensity(worldPosition, density(1)))).toBe(true)

    const invalidDensityType = unwrap(api.createBlender({
      blendDensity: () => Result.succeed('bad' as never),
    }))
    expect(Result.isFailure(invalidDensityType.blendDensity(worldPosition, density(1)))).toBe(true)

    const invalidAlpha = unwrap(api.createBlender({
      blendOffsetAndFactor: () => Result.succeed({
        alpha: Number.NaN as never,
        blendingOffset: density(0),
      }),
    }))
    expect(Result.isFailure(invalidAlpha.blendOffsetAndFactor(PositionAxis(0), PositionAxis(0)))).toBe(true)

    const invalidOffset = unwrap(api.createBlender({
      blendOffsetAndFactor: () => Result.succeed({
        alpha: density(0),
        blendingOffset: 'bad' as never,
      }),
    }))
    expect(Result.isFailure(invalidOffset.blendOffsetAndFactor(PositionAxis(0), PositionAxis(0)))).toBe(true)

    const nonObjectOutput = unwrap(api.createBlender({
      blendOffsetAndFactor: () => Result.succeed(null as never),
    }))
    expect(Result.isFailure(nonObjectOutput.blendOffsetAndFactor(PositionAxis(0), PositionAxis(0)))).toBe(true)

    const missingResult = unwrap(api.createBlender({
      blendDensity: (() => 1) as never,
    }))
    expect(Result.isFailure(missingResult.blendDensity(worldPosition, density(1)))).toBe(true)
    expect(Result.isFailure(invalidDensity.blendDensity(null as never, density(1)))).toBe(true)
    expect(Result.isFailure(invalidDensity.blendDensity(worldPosition, Number.NaN as never))).toBe(true)
    expect(Result.isFailure(invalidDensity.blendDensity({ x: 'bad', y: 3, z: 5 } as never, density(1)))).toBe(true)
    expect(Result.isFailure(invalidDensity.blendDensity({ x: Number.NaN, y: 3, z: 5 } as never, density(1)))).toBe(true)
  })

  it('preserves known callback failures and converts unknown failures to TypeError', () => {
    const typeErrorBlender = unwrap(api.createBlender({
      blendDensity: () => Result.fail(new TypeError('invalid callback input')),
    }))
    const rangeErrorBlender = unwrap(api.createBlender({
      blendDensity: () => Result.fail(new RangeError('invalid callback range')),
    }))
    const unknownErrorBlender = unwrap(api.createBlender({
      blendDensity: () => Result.fail(new Error('unknown callback failure') as never),
    }))

    const typeError = typeErrorBlender.blendDensity(worldPosition, density(1))
    const rangeError = rangeErrorBlender.blendDensity(worldPosition, density(1))
    const unknownError = unknownErrorBlender.blendDensity(worldPosition, density(1))

    expect(Result.isFailure(typeError) && typeError.failure).toBeInstanceOf(TypeError)
    expect(Result.isFailure(rangeError) && rangeError.failure).toBeInstanceOf(RangeError)
    expect(Result.isFailure(unknownError) && unknownError.failure).toBeInstanceOf(TypeError)
  })
})
