import { GridDimension, GridStep } from './sampling.js'
import { requireFinite, requirePositiveFinite, requirePositiveInteger } from './number-validation.js'
import { PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { Result } from 'effect'

const DEFAULT_GRID_ORIGIN = 0
const SINGLE_GRID_STEP = 1
const DEFAULT_GRID_STEP: GridStep = GridStep(SINGLE_GRID_STEP)

const withDefault = <Value>(value: Value | undefined, fallback: Value): Value => {
  if (typeof value === 'undefined') {
    return fallback
  }
  return value
}

export const GRID_LOOP_STEP = 1

export type NoiseGrid3DOptions = Readonly<{
  readonly width: GridDimension
  readonly height: GridDimension
  readonly depth: GridDimension
  readonly originX?: number
  readonly originY?: number
  readonly originZ?: number
  readonly stepX?: GridStep
  readonly stepY?: GridStep
  readonly stepZ?: GridStep
}>

export type NormalizedNoiseGrid3DOptions = Readonly<{
  readonly width: GridDimension
  readonly height: GridDimension
  readonly depth: GridDimension
  readonly originX: PositionAxis
  readonly originY: PositionAxis
  readonly originZ: PositionAxis
  readonly stepX: GridStep
  readonly stepY: GridStep
  readonly stepZ: GridStep
}>

const requireGridDimension = (value: GridDimension, name: string): Result.Result<GridDimension, RangeError> =>
  Result.map(
    requirePositiveInteger(value, () => `${name} must be a positive safe integer, received ${String(value)}`),
    GridDimension,
  )

const requireGridOrigin = (value: number | undefined, name: string): Result.Result<PositionAxis, RangeError> => {
  const origin = withDefault(value, DEFAULT_GRID_ORIGIN)
  return Result.map(requireFinite(origin, () => `${name} must be finite, received ${String(origin)}`), PositionAxis)
}

const requireGridStep = (value: GridStep | undefined, name: string): Result.Result<GridStep, RangeError> => {
  const step = withDefault(value, DEFAULT_GRID_STEP)
  return Result.map(
    requirePositiveFinite(step, () => `${name} must be positive and finite, received ${String(step)}`),
    GridStep,
  )
}

export const normalizeNoiseGrid3DOptions = (
  options: NoiseGrid3DOptions,
): Result.Result<NormalizedNoiseGrid3DOptions, RangeError> =>
  Result.gen(function* normalizeNoiseGrid3DOptionsResult() {
    const width = yield* requireGridDimension(options.width, 'width')
    const height = yield* requireGridDimension(options.height, 'height')
    const depth = yield* requireGridDimension(options.depth, 'depth')
    const originX = yield* requireGridOrigin(options.originX, 'originX')
    const originY = yield* requireGridOrigin(options.originY, 'originY')
    const originZ = yield* requireGridOrigin(options.originZ, 'originZ')
    const stepX = yield* requireGridStep(options.stepX, 'stepX')
    const stepY = yield* requireGridStep(options.stepY, 'stepY')
    const stepZ = yield* requireGridStep(options.stepZ, 'stepZ')
    return { depth, height, originX, originY, originZ, stepX, stepY, stepZ, width }
  })
