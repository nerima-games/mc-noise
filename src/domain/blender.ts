import {
  type DensityEvaluationContext,
  type DensityEvaluationContextOptions,
  type DensityFunctionResult,
  type DensityPosition,
  type DensityValue,
  DensityValue as makeDensityValue,
} from './density-function-types.js'
import {
  type Position,
  PositionAxis,
  position,
} from '@nerima-games/mc-kernel/domain/coordinates'
import { Result } from 'effect'
import { createDensityEvaluationContext } from './density-function-context.js'

export type BlendingOutput = Readonly<{
  readonly alpha: DensityValue
  readonly blendingOffset: DensityValue
}>

export type BlenderBlendDensity = (
  position: Position,
  density: DensityValue,
) => DensityFunctionResult<DensityValue>

export type BlenderBlendOffsetAndFactor = (
  x: PositionAxis,
  z: PositionAxis,
) => DensityFunctionResult<BlendingOutput>

export type Blender = Readonly<{
  readonly blendDensity: BlenderBlendDensity
  readonly blendOffsetAndFactor: BlenderBlendOffsetAndFactor
}>

export type BlenderOptions = Readonly<{
  readonly blendDensity?: BlenderBlendDensity
  readonly blendOffsetAndFactor?: BlenderBlendOffsetAndFactor
}>

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

const isUnknownFunction = (
  value: unknown,
): value is (...args: ReadonlyArray<unknown>) => unknown =>
  typeof value === 'function'

const readCallbackResult = <Value>(
  name: string,
  value: unknown,
  read: (output: unknown) => DensityFunctionResult<Value>,
): DensityFunctionResult<Value> => {
  if (!Result.isResult(value)) {
    return Result.fail(new TypeError(`${name} must return a Result`))
  }
  if (Result.isFailure(value)) {
    if (value.failure instanceof TypeError || value.failure instanceof RangeError) {
      return Result.fail(value.failure)
    }
    return Result.fail(new TypeError(`${name} returned an invalid error`))
  }
  return read(value.success)
}

const readPositionAxis = (
  name: string,
  value: unknown,
): DensityFunctionResult<PositionAxis> => {
  if (typeof value !== 'number') {
    return Result.fail(new TypeError(`${name} must be a number`))
  }
  return Result.mapError(
    PositionAxis.result(value),
    (error) => new RangeError(error.message),
  )
}

const readPosition = (value: unknown): DensityFunctionResult<Position> => {
  if (!isObject(value)) {
    return Result.fail(new TypeError('position must be an object'))
  }
  return Result.gen(function* readPositionResult() {
    const x = yield* readPositionAxis('position.x', value['x'])
    const y = yield* readPositionAxis('position.y', value['y'])
    const z = yield* readPositionAxis('position.z', value['z'])
    return position(x, y, z)
  })
}

const readDensityValue = (
  name: string,
  value: unknown,
): DensityFunctionResult<DensityValue> => {
  if (typeof value !== 'number') {
    return Result.fail(new TypeError(`${name} must be a number`))
  }
  return Result.mapError(
    makeDensityValue.result(value),
    (error) => new RangeError(error.message),
  )
}

const readBlendingOutput = (value: unknown): DensityFunctionResult<BlendingOutput> => {
  if (!isObject(value)) {
    return Result.fail(new TypeError('blending output must be an object'))
  }
  return Result.gen(function* readBlendingOutputResult() {
    return Object.freeze({
      alpha: yield* readDensityValue('blending output alpha', value['alpha']),
      blendingOffset: yield* readDensityValue(
        'blending output offset',
        value['blendingOffset'],
      ),
    })
  })
}

const IDENTITY_BLEND_ALPHA = 1
const IDENTITY_BLEND_OFFSET = 0

const identityBlendingOutput: BlendingOutput = Object.freeze({
  alpha: makeDensityValue(IDENTITY_BLEND_ALPHA),
  blendingOffset: makeDensityValue(IDENTITY_BLEND_OFFSET),
})

const EMPTY_BLENDER: Blender = Object.freeze({
  blendDensity: (_position, density) => Result.succeed(density),
  blendOffsetAndFactor: () => Result.succeed(identityBlendingOutput),
})

const readPositionFromDensity = (
  value: DensityPosition,
): DensityFunctionResult<Position> =>
  Result.gen(function* readPositionFromDensityResult() {
    const x = yield* readPositionAxis('position.x', value.x)
    const y = yield* readPositionAxis('position.y', value.y)
    const z = yield* readPositionAxis('position.z', value.z)
    return position(x, y, z)
  })

export const createBlender = (
  options: BlenderOptions = {},
): DensityFunctionResult<Blender> => {
  if (!isObject(options)) {
    return Result.fail(new TypeError('options must be an object'))
  }
  const blendDensity = options['blendDensity'] ?? EMPTY_BLENDER.blendDensity
  const blendOffsetAndFactor =
    options['blendOffsetAndFactor'] ?? EMPTY_BLENDER.blendOffsetAndFactor
  if (typeof blendDensity !== 'function') {
    return Result.fail(new TypeError('blendDensity must be a function'))
  }
  if (typeof blendOffsetAndFactor !== 'function') {
    return Result.fail(new TypeError('blendOffsetAndFactor must be a function'))
  }
  return Result.succeed(Object.freeze({
    blendDensity: (positionValue: Position, density: DensityValue) =>
      Result.gen(function* blendDensityResult() {
        const normalizedPosition = yield* readPosition(positionValue)
        const normalizedDensity = yield* readDensityValue('density', density)
        return yield* readCallbackResult(
          'blendDensity',
          blendDensity(normalizedPosition, normalizedDensity),
          (output) => readDensityValue('blended density', output),
        )
      }),
    blendOffsetAndFactor: (x: PositionAxis, z: PositionAxis) =>
      Result.gen(function* blendOffsetAndFactorResult() {
        const normalizedX = yield* readPositionAxis('x', x)
        const normalizedZ = yield* readPositionAxis('z', z)
        return yield* readCallbackResult(
          'blendOffsetAndFactor',
          blendOffsetAndFactor(normalizedX, normalizedZ),
          readBlendingOutput,
        )
      }),
  }))
}

export const emptyBlender = (): Blender => EMPTY_BLENDER

export const requireBlender = (value: unknown): DensityFunctionResult<Blender> => {
  if (!isObject(value)) {
    return Result.fail(new TypeError('blender must be an object'))
  }
  const { blendDensity, blendOffsetAndFactor } = value
  if (!isUnknownFunction(blendDensity) || !isUnknownFunction(blendOffsetAndFactor)) {
    return Result.fail(new TypeError('blender must provide blend functions'))
  }
  return Result.succeed(Object.freeze({
    blendDensity: (positionValue: Position, density: DensityValue) =>
      Result.gen(function* validatedBlendDensityResult() {
        const normalizedPosition = yield* readPosition(positionValue)
        const normalizedDensity = yield* readDensityValue('density', density)
        const rawResult = blendDensity(normalizedPosition, normalizedDensity)
        return yield* readCallbackResult('blender.blendDensity', rawResult, (output) =>
          readDensityValue('blended density', output),
        )
      }),
    blendOffsetAndFactor: (x: PositionAxis, z: PositionAxis) =>
      Result.gen(function* validatedBlendOffsetAndFactorResult() {
        const normalizedX = yield* readPositionAxis('x', x)
        const normalizedZ = yield* readPositionAxis('z', z)
        const rawResult = blendOffsetAndFactor(normalizedX, normalizedZ)
        return yield* readCallbackResult('blender.blendOffsetAndFactor', rawResult, readBlendingOutput)
      }),
  }))
}

export const createDensityEvaluationContextFromBlender = (
  blender: Blender = emptyBlender(),
  options: DensityEvaluationContextOptions = {},
): DensityFunctionResult<DensityEvaluationContext> =>
  Result.gen(function* createDensityEvaluationContextFromBlenderResult() {
    const normalizedBlender = yield* requireBlender(blender)
    return yield* createDensityEvaluationContext({
      ...options,
      blendAlpha: (positionValue) =>
        Result.map(
          normalizedBlender.blendOffsetAndFactor(positionValue.x, positionValue.z),
          ({ alpha }) => alpha,
        ),
      blendDensity: (inputValue, positionValue) =>
        Result.flatMap(
          readPositionFromDensity(positionValue),
          (normalizedPosition) =>
            normalizedBlender.blendDensity(normalizedPosition, inputValue),
        ),
      blendOffset: (positionValue) =>
        Result.map(
          normalizedBlender.blendOffsetAndFactor(positionValue.x, positionValue.z),
          ({ blendingOffset }) => blendingOffset,
        ),
    })
  })
