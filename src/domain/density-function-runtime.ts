import {
  type Blender,
  createDensityEvaluationContextFromBlender,
  emptyBlender,
  requireBlender,
} from './blender.js'
import { Brand, Result } from 'effect'
import {
  type DensityBound,
  type DensityEvaluationContext,
  type DensityEvaluationSession,
  type DensityFunction,
  DensityFunctionFieldName,
  type DensityFunctionResult,
  type DensityFunctionVisitor,
  type DensityPosition,
  type DensityValue as DensityValueType,
} from './density-function-types.js'
import {
  createDensityEvaluationSession,
  evaluateDensityFunction,
} from './density-function-evaluator.js'
import { DENSITY_ZERO } from './density-function-constants.js'
import { PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { densityBounds } from './density-function-bounds.js'
import { mapAll } from './density-function-transform.js'
import { requireDensityFunction } from './density-function-validation.js'

export type DensityArrayIndex = number & Brand.Brand<'DensityArrayIndex'>
export const DensityArrayIndex: Brand.Constructor<DensityArrayIndex> = Brand.make<DensityArrayIndex>(
  (value) => Number.isSafeInteger(value) && value >= DENSITY_ZERO || 'density array index must be non-negative',
)

export type DensityFunctionFunctionContext = Readonly<{
  readonly blockX: () => PositionAxis
  readonly blockY: () => PositionAxis
  readonly blockZ: () => PositionAxis
  readonly getBlender: () => Blender
}>

export type DensityFunctionContext =
  | DensityPosition
  | DensityFunctionFunctionContext

export type DensityFunctionIndexContextProvider = (
  index: DensityArrayIndex,
) => DensityFunctionContext

export type DensityFunctionContextProvider = Readonly<{
  readonly forIndex: (index: DensityArrayIndex) => DensityFunctionResult<DensityFunctionFunctionContext>
  readonly fillAllDirectly: (
    array: number[] | Float64Array,
    density: DensityFunction,
  ) => DensityFunctionResult<void>
}>

export type DensityFunctionArrayContextProvider =
  | DensityFunctionIndexContextProvider
  | DensityFunctionContextProvider

const DENSITY_INDEX_INCREMENT = 1
const DENSITY_INDEX_START = DENSITY_ZERO

type FunctionContextRecord = Partial<DensityFunctionFunctionContext>
type ContextProviderRecord = Partial<DensityFunctionContextProvider>

const isDensityEvaluationSession = (
  value: DensityEvaluationContext | DensityEvaluationSession | undefined,
): value is DensityEvaluationSession =>
  value !== null &&
  typeof value === 'object' &&
  'evaluate' in value &&
  typeof value.evaluate === 'function'

const isDensityFunctionFunctionContext = (
  value: unknown,
): value is DensityFunctionFunctionContext => {
  if (value === null || typeof value !== 'object') {
    return false
  }
  const candidate: FunctionContextRecord = value
  return (
    typeof candidate.blockX === 'function' &&
    typeof candidate.blockY === 'function' &&
    typeof candidate.blockZ === 'function' &&
    typeof candidate.getBlender === 'function'
  )
}

const isDensityFunctionContextProvider = (
  value: unknown,
): value is DensityFunctionContextProvider => {
  if (value === null || typeof value !== 'object') {
    return false
  }
  const candidate: ContextProviderRecord = value
  return (
    typeof candidate.forIndex === 'function' &&
    typeof candidate.fillAllDirectly === 'function'
  )
}

const requireArray = (
  array: number[] | Float64Array,
): Result.Result<number[] | Float64Array, TypeError> => {
  if (Array.isArray(array) || array instanceof Float64Array) {
    return Result.succeed(array)
  }
  return Result.fail(new TypeError('array must be an Array or Float64Array'))
}

const requireDensityArrayIndex = (
  index: number,
): Result.Result<DensityArrayIndex, TypeError> => {
  if (DensityArrayIndex.is(index)) {
    return Result.succeed(index)
  }
  return Result.fail(new TypeError('index must be a non-negative safe integer'))
}

const requireContextProvider = (
  contextProvider: DensityFunctionArrayContextProvider,
): Result.Result<DensityFunctionArrayContextProvider, TypeError> => {
  if (typeof contextProvider === 'function' || isDensityFunctionContextProvider(contextProvider)) {
    return Result.succeed(contextProvider)
  }
  return Result.fail(new TypeError('contextProvider must be a function or ContextProvider'))
}

const requireDensityPosition = (
  position: DensityPosition,
): DensityFunctionResult<DensityPosition> => {
  if (position === null || typeof position !== 'object') {
    return Result.fail(new TypeError('position must be an object'))
  }
  return Result.gen(function* requireDensityPositionResult() {
    const x = yield* Result.mapError(
      PositionAxis.result(position.x),
      (error) => new RangeError(`position.x ${error.message}`),
    )
    const y = yield* Result.mapError(
      PositionAxis.result(position.y),
      (error) => new RangeError(`position.y ${error.message}`),
    )
    const z = yield* Result.mapError(
      PositionAxis.result(position.z),
      (error) => new RangeError(`position.z ${error.message}`),
    )
    return Object.freeze({ x, y, z })
  })
}

const densityPositionFromContext = (
  context: DensityFunctionContext,
): DensityFunctionResult<DensityPosition> => {
  if (isDensityFunctionFunctionContext(context)) {
    return requireDensityPosition({
      x: context.blockX(),
      y: context.blockY(),
      z: context.blockZ(),
    })
  }
  return requireDensityPosition(context)
}

const densityEvaluationContextForFunctionContext = (
  context: DensityFunctionFunctionContext,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionResult<DensityEvaluationContext> => {
  if (isDensityEvaluationSession(contextOrSession)) {
    return createDensityEvaluationContextFromBlender(
      context.getBlender(),
      contextOrSession.context,
    )
  }
  if (typeof contextOrSession === 'undefined') {
    return createDensityEvaluationContextFromBlender(context.getBlender())
  }
  return createDensityEvaluationContextFromBlender(
    context.getBlender(),
    contextOrSession,
  )
}

const evaluateWithContextOrSession = (
  density: DensityFunction,
  position: DensityPosition,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionResult<DensityValueType> => {
  if (typeof contextOrSession === 'undefined') {
    return evaluateDensityFunction(density, position)
  }
  if (isDensityEvaluationSession(contextOrSession)) {
    return contextOrSession.evaluate(density, position)
  }
  return Result.flatMap(
    createDensityEvaluationSession(contextOrSession),
    (session) => session.evaluate(density, position),
  )
}

const evaluateDensityFunctionContext = (
  density: DensityFunction,
  context: DensityFunctionContext,
  contextOrSession: DensityEvaluationContext | DensityEvaluationSession | undefined,
): DensityFunctionResult<DensityValueType> =>
  Result.gen(function* evaluateDensityFunctionContextResult() {
    const position = yield* densityPositionFromContext(context)
    if (!isDensityFunctionFunctionContext(context)) {
      return yield* evaluateWithContextOrSession(density, position, contextOrSession)
    }
    const evaluationContext = yield* densityEvaluationContextForFunctionContext(
      context,
      contextOrSession,
    )
    return yield* evaluateWithContextOrSession(density, position, evaluationContext)
  })

const readDensityFunctionFunctionContext = (
  position: DensityPosition,
  blender: Blender,
): DensityFunctionResult<DensityFunctionFunctionContext> =>
  Result.gen(function* readDensityFunctionFunctionContextResult() {
    const normalizedPosition = yield* requireDensityPosition(position)
    const normalizedBlender = yield* requireBlender(blender)
    return Object.freeze({
      blockX: (): PositionAxis => normalizedPosition.x,
      blockY: (): PositionAxis => normalizedPosition.y,
      blockZ: (): PositionAxis => normalizedPosition.z,
      getBlender: (): Blender => normalizedBlender,
    })
  })

export const createDensityFunctionFunctionContext = (
  position: DensityPosition,
  blender: Blender = emptyBlender(),
): DensityFunctionResult<DensityFunctionFunctionContext> =>
  readDensityFunctionFunctionContext(position, blender)

export const createDensityFunctionContextProvider = (
  contextSource: DensityFunctionIndexContextProvider,
  blender: Blender = emptyBlender(),
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionResult<DensityFunctionContextProvider> => {
  if (typeof contextSource !== 'function') {
    return Result.fail(new TypeError('contextSource must be a function'))
  }
  return Result.map(requireBlender(blender), (normalizedBlender) => {
    const forIndex = (
      index: DensityArrayIndex,
    ): DensityFunctionResult<DensityFunctionFunctionContext> =>
      Result.flatMap(requireDensityArrayIndex(index), (validatedIndex) =>
        Result.flatMap(
          densityPositionFromContext(contextSource(validatedIndex)),
          (position) => readDensityFunctionFunctionContext(position, normalizedBlender),
        ),
      )
    const fillAllDirectly = (
      arrayValue: number[] | Float64Array,
      densityValue: DensityFunction,
    ): DensityFunctionResult<void> =>
      Result.gen(function* fillArrayDirectlyResult() {
        const target = yield* requireArray(arrayValue)
        const density = yield* requireDensityFunction(DensityFunctionFieldName('density'), densityValue)
        for (
          let index = DENSITY_INDEX_START;
          index < target.length;
          index += DENSITY_INDEX_INCREMENT
        ) {
          const context = yield* forIndex(DensityArrayIndex(index))
          target[index] = yield* evaluateDensityFunctionContext(
            density,
            context,
            contextOrSession,
          )
        }
      })
    return Object.freeze({ fillAllDirectly, forIndex })
  })
}

export type DensityFunctionRuntime = Readonly<{
  readonly compute: (context: DensityFunctionContext) => DensityFunctionResult<DensityValueType>
  readonly fillArray: (
    array: number[] | Float64Array,
    contextProvider: DensityFunctionArrayContextProvider,
  ) => DensityFunctionResult<void>
  readonly mapAll: (visitor: DensityFunctionVisitor) => DensityFunctionResult<DensityFunction>
  readonly minValue: DensityBound
  readonly maxValue: DensityBound
}>

export const computeDensityFunction = (
  densityValue: DensityFunction,
  context: DensityFunctionContext,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionResult<DensityValueType> =>
  Result.flatMap(requireDensityFunction(DensityFunctionFieldName('density'), densityValue), (density) =>
    evaluateDensityFunctionContext(density, context, contextOrSession),
  )

export const fillDensityFunctionArray = (
  densityValue: DensityFunction,
  array: number[] | Float64Array,
  contextProvider: DensityFunctionArrayContextProvider,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionResult<void> =>
  Result.gen(function* fillDensityFunctionArrayResult() {
    const density = yield* requireDensityFunction(DensityFunctionFieldName('density'), densityValue)
    const target = yield* requireArray(array)
    const provider = yield* requireContextProvider(contextProvider)
    if (typeof provider !== 'function') {
      return yield* provider.fillAllDirectly(target, density)
    }
    for (
      let index = DENSITY_INDEX_START;
      index < target.length;
      index += DENSITY_INDEX_INCREMENT
    ) {
      const brandedIndex = DensityArrayIndex(index)
      target[index] = yield* evaluateDensityFunctionContext(
        density,
        provider(brandedIndex),
        contextOrSession,
      )
    }
  })

export const mapAllDensityFunction: typeof mapAll = mapAll

export const densityFunctionMinValue = (
  densityValue: DensityFunction,
): DensityFunctionResult<DensityBound> =>
  Result.map(requireDensityFunction(DensityFunctionFieldName('density'), densityValue), (density) =>
    densityBounds(density).minValue,
  )

export const densityFunctionMaxValue = (
  densityValue: DensityFunction,
): DensityFunctionResult<DensityBound> =>
  Result.map(requireDensityFunction(DensityFunctionFieldName('density'), densityValue), (density) =>
    densityBounds(density).maxValue,
  )

export const createDensityFunctionRuntime = (
  densityValue: DensityFunction,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionResult<DensityFunctionRuntime> =>
  Result.map(requireDensityFunction(DensityFunctionFieldName('density'), densityValue), (density) => {
    const bounds = densityBounds(density)
    return Object.freeze({
      compute: (context: DensityFunctionContext): DensityFunctionResult<DensityValueType> =>
        computeDensityFunction(density, context, contextOrSession),
      fillArray: (
        array: number[] | Float64Array,
        contextProvider: DensityFunctionArrayContextProvider,
      ): DensityFunctionResult<void> =>
        fillDensityFunctionArray(density, array, contextProvider, contextOrSession),
      mapAll: (visitor: DensityFunctionVisitor): DensityFunctionResult<DensityFunction> =>
        mapAll(density, visitor),
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
    })
  })
