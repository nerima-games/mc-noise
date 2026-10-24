import {
  DensityCellSize,
  type DensityCellSize as DensityCellSizeValue,
  type DensityEvaluationContext,
  type DensityEvaluationContextOptions,
  type DensityFunctionResult,
} from './density-function-types.js'
import { Result } from 'effect'
import { requirePositiveInteger } from './number-validation.js'

const DEFAULT_CELL_SIZE_VALUE = 4
const DEFAULT_CELL_SIZE = DensityCellSize(DEFAULT_CELL_SIZE_VALUE)

type MutableDensityEvaluationContext = {
  cellHeight: DensityCellSizeValue
  cellWidth: DensityCellSizeValue
  blendDensity?: NonNullable<DensityEvaluationContext['blendDensity']>
  blendAlpha?: NonNullable<DensityEvaluationContext['blendAlpha']>
  blendOffset?: NonNullable<DensityEvaluationContext['blendOffset']>
  beardifier?: NonNullable<DensityEvaluationContext['beardifier']>
}

const requireCellSize = (
  name: string,
  value: DensityCellSizeValue,
): Result.Result<DensityCellSizeValue, RangeError> =>
  Result.map(
    requirePositiveInteger(value, () => `${name} must be a positive integer`),
    DensityCellSize,
  )

const requireOptionalFunction = (
  name: string,
  value: unknown,
): Result.Result<true, TypeError> => {
  if (typeof value === 'undefined' || typeof value === 'function') {
    return Result.succeed(true)
  }
  return Result.fail(new TypeError(`${name} must be a function when provided`))
}

const assignOptionalContextCallbacks = (
  context: MutableDensityEvaluationContext,
  options: DensityEvaluationContextOptions,
): void => {
  if (typeof options.beardifier !== 'undefined') {
    context.beardifier = options.beardifier
  }
  if (typeof options.blendAlpha !== 'undefined') {
    context.blendAlpha = options.blendAlpha
  }
  if (typeof options.blendDensity !== 'undefined') {
    context.blendDensity = options.blendDensity
  }
  if (typeof options.blendOffset !== 'undefined') {
    context.blendOffset = options.blendOffset
  }
}

export const requireDensityEvaluationContext = (
  context: DensityEvaluationContext,
): DensityFunctionResult<DensityEvaluationContext> => {
  if (context === null || typeof context !== 'object') {
    return Result.fail(new TypeError('evaluation context must be an object'))
  }
  return Result.gen(function* requireDensityEvaluationContextResult() {
    yield* requireCellSize('context.cellWidth', context.cellWidth)
    yield* requireCellSize('context.cellHeight', context.cellHeight)
    yield* requireOptionalFunction('context.blendDensity', context.blendDensity)
    yield* requireOptionalFunction('context.blendAlpha', context.blendAlpha)
    yield* requireOptionalFunction('context.blendOffset', context.blendOffset)
    yield* requireOptionalFunction('context.beardifier', context.beardifier)
    return context
  })
}

export const createDensityEvaluationContext = (
  options: DensityEvaluationContextOptions = {},
): DensityFunctionResult<DensityEvaluationContext> => {
  if (options === null || typeof options !== 'object') {
    return Result.fail(new TypeError('evaluation context options must be an object'))
  }
  return Result.gen(function* createDensityEvaluationContextResult() {
    const context: MutableDensityEvaluationContext = {
      cellHeight: yield* requireCellSize(
        'cellHeight',
        options.cellHeight ?? DEFAULT_CELL_SIZE,
      ),
      cellWidth: yield* requireCellSize(
        'cellWidth',
        options.cellWidth ?? DEFAULT_CELL_SIZE,
      ),
    }
    yield* requireOptionalFunction('context.blendDensity', options.blendDensity)
    yield* requireOptionalFunction('context.blendAlpha', options.blendAlpha)
    yield* requireOptionalFunction('context.blendOffset', options.blendOffset)
    yield* requireOptionalFunction('context.beardifier', options.beardifier)
    assignOptionalContextCallbacks(context, options)
    return Object.freeze(context)
  })
}
