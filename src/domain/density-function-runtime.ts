import {
  type Blender,
  createDensityEvaluationContextFromBlender,
  emptyBlender,
  requireBlender,
} from './blender.js'
import type {
  DensityEvaluationContext,
  DensityEvaluationSession,
  DensityFunction,
  DensityFunctionVisitor,
  DensityPosition,
} from './density-function-types.js'
import {
  createDensityEvaluationSession,
  evaluateDensityFunction,
} from './density-function-evaluator.js'
import { densityBounds } from './density-function-bounds.js'
import { mapAll } from './density-function-transform.js'
import { requireDensityFunction } from './density-function-validation.js'
import { requireFiniteNumber } from './number-validation.js'

export type DensityFunctionFunctionContext = Readonly<{
  readonly blockX: () => number
  readonly blockY: () => number
  readonly blockZ: () => number
  readonly getBlender: () => Blender
}>

export type DensityFunctionContext =
  | DensityPosition
  | DensityFunctionFunctionContext

export type DensityFunctionIndexContextProvider = (
  index: number,
) => DensityFunctionContext

export type DensityFunctionContextProvider = Readonly<{
  readonly forIndex: (index: number) => DensityFunctionFunctionContext
  readonly fillAllDirectly: (
    array: number[] | Float64Array,
    density: DensityFunction,
  ) => void
}>

export type DensityFunctionArrayContextProvider =
  | DensityFunctionIndexContextProvider
  | DensityFunctionContextProvider

const DENSITY_INDEX_INCREMENT = 1
const DENSITY_INDEX_START = 0

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
  const candidate = value as Partial<DensityFunctionFunctionContext>
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
  const candidate = value as Partial<DensityFunctionContextProvider>
  return (
    typeof candidate.forIndex === 'function' &&
    typeof candidate.fillAllDirectly === 'function'
  )
}

const evaluatorFor = (
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): ((density: DensityFunction, position: DensityPosition) => number) => {
  if (typeof contextOrSession === 'undefined') {
    return (density, position) => evaluateDensityFunction(density, position)
  }
  if (isDensityEvaluationSession(contextOrSession)) {
    return contextOrSession.evaluate
  }
  return createDensityEvaluationSession(contextOrSession).evaluate
}

const requireArray = (array: number[] | Float64Array): number[] | Float64Array => {
  if (!Array.isArray(array) && !(array instanceof Float64Array)) {
    throw new TypeError('array must be an Array or Float64Array')
  }
  return array
}

const requireDensityIndex = (index: number): number => {
  if (!Number.isSafeInteger(index) || index < DENSITY_INDEX_START) {
    throw new TypeError('index must be a non-negative safe integer')
  }
  return index
}

const requireContextProvider = (
  contextProvider: DensityFunctionArrayContextProvider,
): DensityFunctionArrayContextProvider => {
  if (
    typeof contextProvider !== 'function' &&
    !isDensityFunctionContextProvider(contextProvider)
  ) {
    throw new TypeError('contextProvider must be a function or ContextProvider')
  }
  return contextProvider
}

const requireDensityPosition = (position: DensityPosition): DensityPosition => {
  if (position === null || typeof position !== 'object') {
    throw new TypeError('position must be an object')
  }
  return Object.freeze({
    x: requireFiniteNumber('position.x', position.x),
    y: requireFiniteNumber('position.y', position.y),
    z: requireFiniteNumber('position.z', position.z),
  })
}

const densityPositionFromContext = (
  context: DensityFunctionContext,
): DensityPosition => {
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
): DensityEvaluationContext => {
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

const evaluateDensityFunctionContext = (
  density: DensityFunction,
  context: DensityFunctionContext,
  contextOrSession: DensityEvaluationContext | DensityEvaluationSession | undefined,
  fallbackEvaluate: (
    density: DensityFunction,
    position: DensityPosition,
  ) => number,
): number => {
  const position = densityPositionFromContext(context)
  if (!isDensityFunctionFunctionContext(context)) {
    return fallbackEvaluate(density, position)
  }
  return evaluateDensityFunction(
    density,
    position,
    densityEvaluationContextForFunctionContext(context, contextOrSession),
  )
}

export const createDensityFunctionFunctionContext = (
  position: DensityPosition,
  blender: Blender = emptyBlender(),
): DensityFunctionFunctionContext => {
  const normalizedPosition = requireDensityPosition(position)
  const normalizedBlender = requireBlender(blender)
  return Object.freeze({
    blockX: (): number => normalizedPosition.x,
    blockY: (): number => normalizedPosition.y,
    blockZ: (): number => normalizedPosition.z,
    getBlender: (): Blender => normalizedBlender,
  })
}

export const createDensityFunctionContextProvider = (
  contextSource: DensityFunctionIndexContextProvider,
  blender: Blender = emptyBlender(),
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionContextProvider => {
  if (typeof contextSource !== 'function') {
    throw new TypeError('contextSource must be a function')
  }
  const normalizedBlender = requireBlender(blender)
  const forIndex = (index: number): DensityFunctionFunctionContext =>
    createDensityFunctionFunctionContext(
      densityPositionFromContext(contextSource(requireDensityIndex(index))),
      normalizedBlender,
    )
  const fillAllDirectly = (
    array: number[] | Float64Array,
    densityValue: DensityFunction,
  ): void => {
    const target = requireArray(array)
    const density = requireDensityFunction('density', densityValue)
    const evaluate = evaluatorFor(contextOrSession)
    for (
      let index = 0;
      index < target.length;
      index += DENSITY_INDEX_INCREMENT
    ) {
      target[index] = evaluateDensityFunctionContext(
        density,
        forIndex(index),
        contextOrSession,
        evaluate,
      )
    }
  }
  return Object.freeze({ fillAllDirectly, forIndex })
}

export type DensityFunctionRuntime = Readonly<{
  readonly compute: (context: DensityFunctionContext) => number
  readonly fillArray: (
    array: number[] | Float64Array,
    contextProvider: DensityFunctionArrayContextProvider,
  ) => void
  readonly mapAll: (visitor: DensityFunctionVisitor) => DensityFunction
  readonly minValue: number
  readonly maxValue: number
}>

export const computeDensityFunction = (
  densityValue: DensityFunction,
  context: DensityFunctionContext,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): number => {
  const density = requireDensityFunction('density', densityValue)
  return evaluateDensityFunctionContext(
    density,
    context,
    contextOrSession,
    evaluatorFor(contextOrSession),
  )
}

export const fillDensityFunctionArray = (
  densityValue: DensityFunction,
  array: number[] | Float64Array,
  contextProvider: DensityFunctionArrayContextProvider,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): void => {
  const density = requireDensityFunction('density', densityValue)
  const target = requireArray(array)
  const provider = requireContextProvider(contextProvider)
  if (typeof provider !== 'function') {
    provider.fillAllDirectly(target, density)
    return
  }
  const evaluate = evaluatorFor(contextOrSession)
  for (
    let index = 0;
    index < target.length;
    index += DENSITY_INDEX_INCREMENT
  ) {
    target[index] = evaluateDensityFunctionContext(
      density,
      provider(index),
      contextOrSession,
      evaluate,
    )
  }
}

export const mapAllDensityFunction = mapAll

export const densityFunctionMinValue = (densityValue: DensityFunction): number =>
  densityBounds(requireDensityFunction('density', densityValue)).minValue

export const densityFunctionMaxValue = (densityValue: DensityFunction): number =>
  densityBounds(requireDensityFunction('density', densityValue)).maxValue

export const createDensityFunctionRuntime = (
  densityValue: DensityFunction,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionRuntime => {
  const density = requireDensityFunction('density', densityValue)
  const bounds = densityBounds(density)
  return Object.freeze({
    compute: (context: DensityFunctionContext): number =>
      computeDensityFunction(density, context, contextOrSession),
    fillArray: (
      array: number[] | Float64Array,
      contextProvider: DensityFunctionArrayContextProvider,
    ): void => fillDensityFunctionArray(density, array, contextProvider, contextOrSession),
    mapAll: (visitor: DensityFunctionVisitor): DensityFunction => mapAll(density, visitor),
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
  })
}
