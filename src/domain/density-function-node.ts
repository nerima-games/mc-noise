import type {
  DensityEvaluationContext,
  DensityEvaluationSession,
  DensityFunction,
  DensityFunctionVisitor,
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
  densityQuarterNegative,
  densitySquare,
  densitySqueeze,
} from './density-function.js'
import { requireDensityFunction } from './density-function-validation.js'

export type DensityFunctionNode = Readonly<{
  readonly compute: (context: DensityFunctionContext) => number
  readonly fillArray: (
    array: number[] | Float64Array,
    contextProvider: DensityFunctionArrayContextProvider,
  ) => void
  readonly mapAll: (visitor: DensityFunctionVisitor) => DensityFunctionNode
  readonly minValue: () => number
  readonly maxValue: () => number
  readonly abs: () => DensityFunctionNode
  readonly clamp: (min: number, max: number) => DensityFunctionNode
  readonly cube: () => DensityFunctionNode
  readonly halfNegative: () => DensityFunctionNode
  readonly quarterNegative: () => DensityFunctionNode
  readonly square: () => DensityFunctionNode
  readonly squeeze: () => DensityFunctionNode
}>

export const createDensityFunctionNode = (
  densityValue: DensityFunction,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionNode => {
  const density = requireDensityFunction('density', densityValue)
  const runtime = createDensityFunctionRuntime(density, contextOrSession)
  const derive = (nextDensity: DensityFunction): DensityFunctionNode =>
    createDensityFunctionNode(nextDensity, contextOrSession)

  return Object.freeze({
    abs: (): DensityFunctionNode => derive(densityAbs(density)),
    clamp: (min: number, max: number): DensityFunctionNode =>
      derive(densityClamp(density, min, max)),
    compute: (context: DensityFunctionContext): number => runtime.compute(context),
    cube: (): DensityFunctionNode => derive(densityCube(density)),
    fillArray: (
      array: number[] | Float64Array,
      contextProvider: DensityFunctionArrayContextProvider,
    ): void => runtime.fillArray(array, contextProvider),
    halfNegative: (): DensityFunctionNode => derive(densityHalfNegative(density)),
    mapAll: (visitor: DensityFunctionVisitor): DensityFunctionNode =>
      derive(runtime.mapAll(visitor)),
    maxValue: (): number => runtime.maxValue,
    minValue: (): number => runtime.minValue,
    quarterNegative: (): DensityFunctionNode =>
      derive(densityQuarterNegative(density)),
    square: (): DensityFunctionNode => derive(densitySquare(density)),
    squeeze: (): DensityFunctionNode => derive(densitySqueeze(density)),
  })
}
