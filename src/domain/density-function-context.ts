import type {
  DensityEvaluationContext,
  DensityEvaluationContextOptions,
} from './density-function-types.js'
import { requireFiniteNumber } from './number-validation.js'

const DEFAULT_CELL_SIZE = 4
const MINIMUM_CELL_SIZE = 0

type MutableDensityEvaluationContext = {
  cellHeight: number
  cellWidth: number
  blendDensity?: NonNullable<DensityEvaluationContext['blendDensity']>
  blendAlpha?: NonNullable<DensityEvaluationContext['blendAlpha']>
  blendOffset?: NonNullable<DensityEvaluationContext['blendOffset']>
  beardifier?: NonNullable<DensityEvaluationContext['beardifier']>
}

const requireCellSize = (name: string, value: number): number => {
  const finiteValue = requireFiniteNumber(name, value)
  if (
    !Number.isInteger(finiteValue) ||
    finiteValue <= MINIMUM_CELL_SIZE
  ) {
    throw new RangeError(`${name} must be a positive integer`)
  }
  return finiteValue
}

const requireOptionalFunction = (name: string, value: unknown): void => {
  if (
    typeof value !== 'undefined' &&
    typeof value !== 'function'
  ) {
    throw new TypeError(`${name} must be a function when provided`)
  }
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
): DensityEvaluationContext => {
  if (context === null || typeof context !== 'object') {
    throw new TypeError('evaluation context must be an object')
  }
  requireCellSize('context.cellWidth', context.cellWidth)
  requireCellSize('context.cellHeight', context.cellHeight)
  requireOptionalFunction('context.blendDensity', context.blendDensity)
  requireOptionalFunction('context.blendAlpha', context.blendAlpha)
  requireOptionalFunction('context.blendOffset', context.blendOffset)
  requireOptionalFunction('context.beardifier', context.beardifier)
  return context
}

export const createDensityEvaluationContext = (
  options: DensityEvaluationContextOptions = {},
): DensityEvaluationContext => {
  const context: MutableDensityEvaluationContext = {
    cellHeight: requireCellSize(
      'cellHeight',
      options.cellHeight ?? DEFAULT_CELL_SIZE,
    ),
    cellWidth: requireCellSize(
      'cellWidth',
      options.cellWidth ?? DEFAULT_CELL_SIZE,
    ),
  }
  assignOptionalContextCallbacks(context, options)
  requireDensityEvaluationContext(context)
  return Object.freeze(context)
}
