import {
  type DensityBound,
  type DensityEvaluationContext,
  type DensityEvaluationSession,
  type DensityFunction,
  DensityFunctionFieldName,
  type DensityFunctionResult,
  type DensityFunctionVisitor,
  type DensityValue,
} from './density-function-types.js'
import {
  type DensityFunctionArrayContextProvider,
  type DensityFunctionContext,
  createDensityFunctionRuntime,
} from './density-function-runtime.js'
import {
  densityAbs,
  densityClamp,
  densityCube,
  densityHalfNegative,
  densityInvert,
  densityQuarterNegative,
  densitySquare,
  densitySqueeze,
} from './density-function.js'
import { Result } from 'effect'
import { requireDensityFunction } from './density-function-validation.js'

export type DensityFunctionNode = Readonly<{
  readonly compute: (context: DensityFunctionContext) => DensityFunctionResult<DensityValue>
  readonly fillArray: (
    array: number[] | Float64Array,
    contextProvider: DensityFunctionArrayContextProvider,
  ) => DensityFunctionResult<void>
  readonly mapAll: (
    visitor: DensityFunctionVisitor,
  ) => DensityFunctionResult<DensityFunctionNode>
  readonly minValue: () => DensityBound
  readonly maxValue: () => DensityBound
  readonly abs: () => DensityFunctionResult<DensityFunctionNode>
  readonly clamp: (
    min: DensityValue,
    max: DensityValue,
  ) => DensityFunctionResult<DensityFunctionNode>
  readonly cube: () => DensityFunctionResult<DensityFunctionNode>
  readonly halfNegative: () => DensityFunctionResult<DensityFunctionNode>
  readonly invert: () => DensityFunctionResult<DensityFunctionNode>
  readonly quarterNegative: () => DensityFunctionResult<DensityFunctionNode>
  readonly square: () => DensityFunctionResult<DensityFunctionNode>
  readonly squeeze: () => DensityFunctionResult<DensityFunctionNode>
}>

export const createDensityFunctionNode = (
  densityValue: unknown,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionResult<DensityFunctionNode> =>
  Result.gen(function* createDensityFunctionNodeResult() {
    const density = yield* requireDensityFunction(DensityFunctionFieldName('density'), densityValue)
    const runtime = yield* createDensityFunctionRuntime(density, contextOrSession)
    const derive = (
      nextDensity: DensityFunctionResult<DensityFunction>,
    ): DensityFunctionResult<DensityFunctionNode> =>
      Result.flatMap(nextDensity, (next) =>
        createDensityFunctionNode(next, contextOrSession),
      )

    return Object.freeze({
      abs: (): DensityFunctionResult<DensityFunctionNode> =>
        derive(densityAbs(density)),
      clamp: (
        min: DensityValue,
        max: DensityValue,
      ): DensityFunctionResult<DensityFunctionNode> =>
        derive(densityClamp(density, min, max)),
      compute: (context: DensityFunctionContext): DensityFunctionResult<DensityValue> =>
        runtime.compute(context),
      cube: (): DensityFunctionResult<DensityFunctionNode> =>
        derive(densityCube(density)),
      fillArray: (
        array: number[] | Float64Array,
        contextProvider: DensityFunctionArrayContextProvider,
      ): DensityFunctionResult<void> => runtime.fillArray(array, contextProvider),
      halfNegative: (): DensityFunctionResult<DensityFunctionNode> =>
        derive(densityHalfNegative(density)),
      invert: (): DensityFunctionResult<DensityFunctionNode> =>
        derive(densityInvert(density)),
      mapAll: (
        visitor: DensityFunctionVisitor,
      ): DensityFunctionResult<DensityFunctionNode> => derive(runtime.mapAll(visitor)),
      maxValue: (): DensityBound => runtime.maxValue,
      minValue: (): DensityBound => runtime.minValue,
      quarterNegative: (): DensityFunctionResult<DensityFunctionNode> =>
        derive(densityQuarterNegative(density)),
      square: (): DensityFunctionResult<DensityFunctionNode> =>
        derive(densitySquare(density)),
      squeeze: (): DensityFunctionResult<DensityFunctionNode> =>
        derive(densitySqueeze(density)),
    })
  })
