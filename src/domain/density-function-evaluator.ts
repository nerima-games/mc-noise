import { BlockAxis, PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import {
  DENSITY_FOUR,
  DENSITY_HALF,
  DENSITY_NEGATIVE_HALF,
  DENSITY_NEGATIVE_ONE,
  DENSITY_NEGATIVE_THREE_QUARTERS,
  DENSITY_ONE,
  DENSITY_ONE_AND_HALF,
  DENSITY_SHIFT_COORDINATE_SCALE,
  DENSITY_SHIFT_OUTPUT_SCALE,
  DENSITY_THREE,
  DENSITY_THREE_QUARTERS,
  DENSITY_TWENTY_FOUR,
  DENSITY_TWO,
  DENSITY_ZERO,
} from './density-function-constants.js'
import { DefinedValueName, requireDefined } from './defined.js'
import {
  type DensityBeardifier,
  type DensityBinary,
  type DensityBlendAlpha,
  type DensityBlendDensity,
  type DensityBlendOffset,
  type DensityCache2D,
  type DensityCacheAllInCell,
  type DensityCacheOnce,
  DensityCellSize,
  type DensityClamp,
  type DensityConstant,
  type DensityCoordinate,
  type DensityCoordinateAxis,
  type DensityEndIslands,
  type DensityEvaluationContext,
  type DensityEvaluationSession,
  type DensityFindTopSurface,
  type DensityFlatCache,
  type DensityFunction,
  type DensityFunctionError,
  DensityFunctionFieldName,
  type DensityFunctionResult,
  type DensityInterpolated,
  type DensityLinearOperation,
  type DensityNoise,
  type DensityOldBlendedNoise,
  type DensityPosition,
  type DensityRangeChoice,
  type DensityRarityValueMapper,
  type DensityShift,
  type DensityShiftA,
  type DensityShiftB,
  type DensityShiftedNoise,
  type DensitySpline,
  type DensityUnary,
  type DensityUnaryOperation,
  DensityValue,
  type DensityValue as DensityValueType,
  type DensityWeirdScaledSampler,
  type DensityYClampedGradient,
} from './density-function-types.js'
import { SplineInput, SplineValue, evaluateSpline } from './spline.js'
import { BoundedNoise } from './noise-primitives.js'
import { Result } from 'effect'
import { evaluateOldBlendedNoise } from './old-blended-noise.js'
import { requireDensityEvaluationContext } from './density-function-context.js'
import { requireDensityFunction } from './density-function-validation.js'
import { requireFiniteNumber } from './number-validation.js'

const DENSITY_INTERPOLATION_LOWER_BOUNDARY = 0
const DENSITY_INTERPOLATION_UPPER_BOUNDARY = 1
const DENSITY_SURFACE_THRESHOLD = 0
const DENSITY_CELL_SIZE_ONE = 1

type DensityLeaf =
  | DensityConstant
  | DensityCoordinate
  | DensityOldBlendedNoise
  | DensityBeardifier
  | DensityEndIslands
  | DensityNoise
  | DensityShift
  | DensityShiftA
  | DensityShiftB
  | DensityYClampedGradient

type DensityOperationComposite =
  | DensityShiftedNoise
  | DensityLinearOperation
  | DensityWeirdScaledSampler
  | DensityBinary
  | DensityUnary

type DensityBranchComposite = DensityClamp | DensityFindTopSurface | DensityRangeChoice | DensitySpline

type DensityContextComposite =
  | DensityInterpolated
  | DensityFlatCache
  | DensityCache2D
  | DensityCacheOnce
  | DensityCacheAllInCell
  | DensityBlendDensity
  | DensityBlendAlpha
  | DensityBlendOffset

type DensityCacheComposite =
  | DensityInterpolated
  | DensityFlatCache
  | DensityCache2D
  | DensityCacheOnce
  | DensityCacheAllInCell

type DensityBlendComposite =
  | DensityBlendDensity
  | DensityBlendAlpha
  | DensityBlendOffset

type DensityComposite =
  | DensityOperationComposite
  | DensityBranchComposite
  | DensityContextComposite

type DensityEvaluator = (
  density: DensityFunction,
  position: DensityPosition,
) => number

type DensityCache = WeakMap<DensityFunction, Map<string, number>>

type EvaluationState = {
  readonly context: DensityEvaluationContext | undefined
  failure?: DensityFunctionError
  cacheOnce: WeakMap<DensityFunction, number>
  flatCache: DensityCache
  cache2D: DensityCache
  cacheAllInCell: DensityCache
  interpolated: DensityCache
}

const createEvaluationState = (
  context?: DensityEvaluationContext,
): EvaluationState => ({
  cache2D: new WeakMap(),
  cacheAllInCell: new WeakMap(),
  cacheOnce: new WeakMap(),
  context,
  flatCache: new WeakMap(),
  interpolated: new WeakMap(),
})

const EMPTY_EVALUATION_CONTEXT: DensityEvaluationContext = Object.freeze({
  cellHeight: DensityCellSize(DENSITY_CELL_SIZE_ONE),
  cellWidth: DensityCellSize(DENSITY_CELL_SIZE_ONE),
})

const captureResult = <Value>(
  state: EvaluationState,
  result: Result.Result<Value, DensityFunctionError>,
  fallback: Value,
): Value => {
  if (Result.isFailure(result)) {
    state.failure ??= result.failure
    return fallback
  }
  return result.success
}

const requireDensityValue = (
  state: EvaluationState,
  value: number,
): DensityValueType =>
  captureResult(
    state,
    Result.mapError(DensityValue.result(value), (error) => new RangeError(error.message)),
    DensityValue(DENSITY_ZERO),
  )

const clearEvaluationState = (state: EvaluationState): void => {
  state.cache2D = new WeakMap()
  state.cacheAllInCell = new WeakMap()
  state.cacheOnce = new WeakMap()
  state.flatCache = new WeakMap()
  state.interpolated = new WeakMap()
}

const coordinateValue = (position: DensityPosition, axis: DensityCoordinateAxis): number =>
  position[axis]

const clampUnit = (value: number): number =>
  Math.max(DENSITY_NEGATIVE_ONE, Math.min(DENSITY_ONE, value))

const clamp01 = (value: number): number =>
  Math.max(DENSITY_ZERO, Math.min(DENSITY_ONE, value))

const halfNegative = (value: number): number => {
  if (value < DENSITY_ZERO) {
    return value / DENSITY_TWO
  }
  return value
}

const quarterNegative = (value: number): number => {
  if (value < DENSITY_ZERO) {
    return value / DENSITY_FOUR
  }
  return value
}

const squeeze = (value: number): number => {
  const clamped = clampUnit(value)
  return clamped / DENSITY_TWO - clamped * clamped * clamped / DENSITY_TWENTY_FOUR
}

const unaryEvaluators: Readonly<Record<DensityUnaryOperation, (value: number) => number>> = {
  abs: Math.abs,
  cube: (value) => value * value * value,
  'half-negative': halfNegative,
  invert: (value) => DENSITY_ONE / value,
  'quarter-negative': quarterNegative,
  square: (value) => value * value,
  squeeze,
}

const evaluateUnary = (operation: DensityUnaryOperation, value: number): number =>
  unaryEvaluators[operation](value)

const evaluateCoordinate = (density: DensityCoordinate, position: DensityPosition): number =>
  coordinateValue(position, density.axis) * density.scale + density.offset

const evaluateNoise = (density: DensityNoise, position: DensityPosition): number =>
  density.source.sample(
    position.x * density.xzScale,
    position.y * density.yScale,
    position.z * density.xzScale,
  )

type DensityShiftVariant = DensityShift | DensityShiftA | DensityShiftB

type ShiftCoordinates = readonly [number, number, number]

const shiftCoordinates: Readonly<Record<
  DensityShiftVariant['kind'],
  (position: DensityPosition) => ShiftCoordinates
>> = {
  shift: (position) => [position.x, position.y, position.z],
  'shift-a': (position) => [position.x, DENSITY_ZERO, position.z],
  'shift-b': (position) => [position.z, position.x, DENSITY_ZERO],
}

const evaluateShift = (density: DensityShiftVariant, position: DensityPosition): number => {
  const [x, y, z] = shiftCoordinates[density.kind](position)
  return density.source.sample(
    x * DENSITY_SHIFT_COORDINATE_SCALE,
    y * DENSITY_SHIFT_COORDINATE_SCALE,
    z * DENSITY_SHIFT_COORDINATE_SCALE,
  ) * DENSITY_SHIFT_OUTPUT_SCALE
}

const evaluateGradient = (
  density: DensityYClampedGradient,
  position: DensityPosition,
): number => {
  const ratio = clamp01((position.y - density.fromY) / (density.toY - density.fromY))
  return density.fromValue + (density.toValue - density.fromValue) * ratio
}

const rarityValueMappers: Readonly<
  Record<DensityRarityValueMapper, (value: number) => number>
> = {
  'type-1': (value) => {
    if (value < DENSITY_NEGATIVE_THREE_QUARTERS) {
      return DENSITY_HALF
    }
    if (value < DENSITY_NEGATIVE_HALF) {
      return DENSITY_THREE_QUARTERS
    }
    if (value < DENSITY_HALF) {
      return DENSITY_ONE
    }
    if (value < DENSITY_THREE_QUARTERS) {
      return DENSITY_TWO
    }
    return DENSITY_THREE
  },
  'type-2': (value) => {
    if (value < DENSITY_NEGATIVE_HALF) {
      return DENSITY_THREE_QUARTERS
    }
    if (value < DENSITY_ZERO) {
      return DENSITY_ONE
    }
    if (value < DENSITY_HALF) {
      return DENSITY_ONE_AND_HALF
    }
    return DENSITY_TWO
  },
}

const evaluateLinearOperation = (
  density: DensityLinearOperation,
  position: DensityPosition,
  evaluate: (node: DensityFunction, point: DensityPosition) => number,
): number => {
  const input = evaluate(density.input, position)
  if (density.operation === 'add') {
    return input + density.argument
  }
  return input * density.argument
}

const evaluateWeirdScaledSampler = (
  density: DensityWeirdScaledSampler,
  position: DensityPosition,
  evaluate: (node: DensityFunction, point: DensityPosition) => number,
): number => {
  const rarity = rarityValueMappers[density.rarityValueMapper](
    evaluate(density.input, position),
  )
  return Math.abs(
    rarity *
      density.source.sample(position.x / rarity, position.y / rarity, position.z / rarity),
  )
}

const DENSITY_END_ISLANDS_COORDINATE_SCALE = 8

const evaluateEndIslands = (
  density: DensityEndIslands,
  position: DensityPosition,
  state: EvaluationState,
): number => {
  const x = Result.mapError(
    BlockAxis.result(Math.trunc(position.x / DENSITY_END_ISLANDS_COORDINATE_SCALE)),
    (error) => new RangeError(error.message),
  )
  const z = Result.mapError(
    BlockAxis.result(Math.trunc(position.z / DENSITY_END_ISLANDS_COORDINATE_SCALE)),
    (error) => new RangeError(error.message),
  )
  const sample = Result.flatMap(x, (blockX) =>
    Result.flatMap(z, (blockZ) => density.sampler.sample(blockX, blockZ)),
  )
  return captureResult(state, sample, BoundedNoise(DENSITY_ZERO))
}

type DensityShiftOrGradient =
  | DensityShift
  | DensityShiftA
  | DensityShiftB
  | DensityYClampedGradient

type DensityPrimaryLeaf = Exclude<DensityLeaf, DensityBeardifier | DensityShiftOrGradient>

const evaluateShiftOrGradient = (
  density: DensityShiftOrGradient,
  position: DensityPosition,
): number => {
  if (
    density.kind === 'shift' ||
    density.kind === 'shift-a' ||
    density.kind === 'shift-b'
  ) {
    return evaluateShift(density, position)
  }
  return evaluateGradient(density, position)
}

const requireEvaluationContext = (
  state: EvaluationState,
  kind: string,
): DensityEvaluationContext => {
  if (typeof state.context === 'undefined') {
    state.failure ??= new RangeError(`${kind} requires an evaluation context`)
    return EMPTY_EVALUATION_CONTEXT
  }
  return state.context
}

const evaluateBeardifier = (
  density: DensityBeardifier,
  position: DensityPosition,
  state: EvaluationState,
): number => {
  const context = requireEvaluationContext(state, density.kind)
  if (typeof context.beardifier !== 'function') {
    state.failure ??= new RangeError('beardifier requires context.beardifier')
    return DENSITY_ZERO
  }
  return captureResult(state, context.beardifier(position), DensityValue(DENSITY_ZERO))
}

type DensityPrimaryLeafKind = DensityPrimaryLeaf['kind']

type DensityPrimaryLeafByKind<Kind extends DensityPrimaryLeafKind> =
  Extract<DensityPrimaryLeaf, { readonly kind: Kind }>

type DensityPrimaryLeafHandlers = {
  [Kind in DensityPrimaryLeafKind]: (
    density: DensityPrimaryLeafByKind<Kind>,
    position: DensityPosition,
    state: EvaluationState,
  ) => number
}

const densityPrimaryLeafHandlers: DensityPrimaryLeafHandlers = {
  constant: (density) => density.value,
  coordinate: (density, position) => evaluateCoordinate(density, position),
  'end-islands': (density, position, state) =>
    evaluateEndIslands(density, position, state),
  noise: (density, position) => evaluateNoise(density, position),
  'old-blended-noise': (density, position, state) =>
    captureResult(
      state,
      evaluateOldBlendedNoise(density, position),
      DensityValue(DENSITY_ZERO),
    ),
}
const evaluatePrimaryLeaf = <Kind extends DensityPrimaryLeafKind>(
  density: DensityPrimaryLeafByKind<Kind>,
  position: DensityPosition,
  state: EvaluationState,
): number => densityPrimaryLeafHandlers[density.kind](density, position, state)

const evaluateLeaf = (
  density: DensityLeaf,
  position: DensityPosition,
  state: EvaluationState,
): number => {
  switch (density.kind) {
    case 'beardifier':
      return evaluateBeardifier(density, position, state)
    case 'shift':
    case 'shift-a':
    case 'shift-b':
    case 'y-clamped-gradient':
      return evaluateShiftOrGradient(density, position)
    default:
      return evaluatePrimaryLeaf(density, position, state)
  }
}

const evaluateShiftedNoise = (
  density: DensityShiftedNoise,
  position: DensityPosition,
  evaluate: (node: DensityFunction, point: DensityPosition) => number,
): number => {
  const shiftX = evaluate(density.shiftX, position)
  const shiftY = evaluate(density.shiftY, position)
  const shiftZ = evaluate(density.shiftZ, position)
  return density.source.sample(
    position.x * density.xzScale + shiftX,
    position.y * density.yScale + shiftY,
    position.z * density.xzScale + shiftZ,
  )
}

const evaluateBinary = (
  density: DensityBinary,
  position: DensityPosition,
  evaluate: (node: DensityFunction, point: DensityPosition) => number,
): number => {
  const left = evaluate(density.left, position)
  const right = evaluate(density.right, position)
  if (density.operation === 'add') {
    return left + right
  }
  if (density.operation === 'mul') {
    return left * right
  }
  if (density.operation === 'min') {
    return Math.min(left, right)
  }
  return Math.max(left, right)
}

const evaluateUnaryNode = (
  density: DensityUnary,
  position: DensityPosition,
  evaluate: (node: DensityFunction, point: DensityPosition) => number,
): number => evaluateUnary(density.operation, evaluate(density.input, position))

const evaluateClamp = (
  density: DensityClamp,
  position: DensityPosition,
  evaluate: (node: DensityFunction, point: DensityPosition) => number,
): number => Math.max(density.min, Math.min(density.max, evaluate(density.input, position)))

const evaluateRangeChoice = (
  density: DensityRangeChoice,
  position: DensityPosition,
  evaluate: (node: DensityFunction, point: DensityPosition) => number,
): number => {
  const input = evaluate(density.input, position)
  if (input >= density.minInclusive && input < density.maxExclusive) {
    return evaluate(density.inRange, position)
  }
  return evaluate(density.outOfRange, position)
}

const requirePosition = (
  position: Readonly<{ x: number; y: number; z: number }>,
): DensityFunctionResult<DensityPosition> => {
  if (position === null || typeof position !== 'object') {
    return Result.fail(new TypeError('position must be an object'))
  }
  return Result.gen(function* requirePositionResult() {
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

type FindTopSurfaceSearchOptions = Readonly<{
  readonly density: DensityFindTopSurface
  readonly evaluate: DensityEvaluator
  readonly position: DensityPosition
  readonly state: EvaluationState
  readonly startY: number
}>

const searchForDensitySurface = (options: FindTopSurfaceSearchOptions): number => {
  const { density, evaluate, position, state, startY } = options
  let y = startY
  while (y >= density.lowerBound) {
    const isSurface = captureResult(
      state,
      Result.map(
        requirePosition({ x: position.x, y, z: position.z }),
        (point) => evaluate(density.density, point) > DENSITY_SURFACE_THRESHOLD,
      ),
      false,
    )
    if (typeof state.failure !== 'undefined') {
      return density.lowerBound
    }
    if (isSurface) {
      return y
    }
    y -= density.cellHeight
  }
  return density.lowerBound
}

const evaluateFindTopSurface = (
  density: DensityFindTopSurface,
  position: DensityPosition,
  evaluate: DensityEvaluator,
  state: EvaluationState,
): number => {
  const upperBound = evaluate(density.upperBound, position)
  const startY = Math.floor(upperBound / density.cellHeight) * density.cellHeight
  if (!Number.isFinite(startY) || startY <= density.lowerBound) {
    return density.lowerBound
  }
  return searchForDensitySurface({ density, evaluate, position, startY, state })
}

const evaluateSplineNode = (
  density: DensitySpline,
  position: DensityPosition,
  evaluate: (node: DensityFunction, point: DensityPosition) => number,
  state: EvaluationState,
): number => {
  const splineInput = Result.mapError(
    SplineInput.result(evaluate(density.input, position)),
    (error) => new RangeError(error.message),
  )
  return captureResult(
    state,
    Result.flatMap(splineInput, (input) => evaluateSpline(density.spline, input)),
    SplineValue(DENSITY_ZERO),
  )
}

const positionKey = (position: DensityPosition): string =>
  [position.x, position.y, position.z].join(',')

const flatPositionKey = (position: DensityPosition): string =>
  [position.x, position.z].join(',')

const cellPositionKey = (
  position: DensityPosition,
  context: DensityEvaluationContext,
): string =>
  [
    Math.floor(position.x / context.cellWidth),
    Math.floor(position.y / context.cellHeight),
    Math.floor(position.z / context.cellWidth),
    positionKey(position),
  ].join('|')

type CachedDensityValueOptions = Readonly<{
  readonly cache: DensityCache
  readonly compute: () => number
  readonly density: DensityFunction
  readonly key: string
  readonly state: EvaluationState
}>

const cachedDensityValue = (options: CachedDensityValueOptions): number => {
  const { cache, compute, density, key, state } = options
  let values = cache.get(density)
  if (typeof values === 'undefined') {
    values = new Map()
    cache.set(density, values)
  }
  if (values.has(key)) {
    return captureResult(
      state,
      requireDefined(values.get(key), DefinedValueName('cached density value')),
      DENSITY_ZERO,
    )
  }
  const value = compute()
  values.set(key, value)
  return value
}

const evaluateCachedOnce = (
  density: DensityCacheOnce,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  requireEvaluationContext(state, density.kind)
  if (state.cacheOnce.has(density)) {
    return captureResult(
      state,
      requireDefined(
        state.cacheOnce.get(density),
        DefinedValueName('cached density value'),
      ),
      DENSITY_ZERO,
    )
  }
  const value = evaluate(density.input, position)
  state.cacheOnce.set(density, value)
  return value
}

const evaluateFlatCache = (
  density: DensityFlatCache,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  requireEvaluationContext(state, density.kind)
  return cachedDensityValue({
    cache: state.flatCache,
    compute: () => evaluate(density.input, position),
    density,
    key: flatPositionKey(position),
    state,
  })
}

const evaluateCache2D = (
  density: DensityCache2D,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  requireEvaluationContext(state, density.kind)
  return cachedDensityValue({
    cache: state.cache2D,
    compute: () => evaluate(density.input, position),
    density,
    key: flatPositionKey(position),
    state,
  })
}

const evaluateCacheAllInCell = (
  density: DensityCacheAllInCell,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  const context = requireEvaluationContext(state, density.kind)
  return cachedDensityValue({
    cache: state.cacheAllInCell,
    compute: () => evaluate(density.input, position),
    density,
    key: cellPositionKey(position, context),
    state,
  })
}

const interpolate = (from: number, to: number, delta: number): number =>
  from + (to - from) * delta

type InterpolationState = Readonly<{
  readonly originX: number
  readonly originY: number
  readonly originZ: number
  readonly xDelta: number
  readonly yDelta: number
  readonly zDelta: number
}>

const createInterpolationState = (
  position: DensityPosition,
  context: DensityEvaluationContext,
): InterpolationState => {
  const originX =
    Math.floor(position.x / context.cellWidth) * context.cellWidth
  const originY =
    Math.floor(position.y / context.cellHeight) * context.cellHeight
  const originZ =
    Math.floor(position.z / context.cellWidth) * context.cellWidth
  const xDelta = (position.x - originX) / context.cellWidth
  const yDelta = (position.y - originY) / context.cellHeight
  const zDelta = (position.z - originZ) / context.cellWidth
  return {
    originX,
    originY,
    originZ,
    xDelta,
    yDelta,
    zDelta,
  }
}

type InterpolatedSampleOptions = Readonly<{
  readonly context: DensityEvaluationContext
  readonly density: DensityInterpolated
  readonly evaluate: DensityEvaluator
  readonly interpolation: InterpolationState
  readonly state: EvaluationState
}>

const createInterpolatedSample = (
  options: InterpolatedSampleOptions,
): ((xOffset: number, yOffset: number, zOffset: number) => number) =>
  (xOffset, yOffset, zOffset) =>
    cachedDensityValue({
      cache: options.state.interpolated,
      compute: () =>
        captureResult(
          options.state,
          Result.flatMap(
            requirePosition({
              x:
                options.interpolation.originX +
                xOffset * options.context.cellWidth,
              y:
                options.interpolation.originY +
                yOffset * options.context.cellHeight,
              z:
                options.interpolation.originZ +
                zOffset * options.context.cellWidth,
            }),
            (point) => Result.succeed(options.evaluate(options.density.input, point)),
          ),
          DENSITY_ZERO,
        ),
      density: options.density,
      key: [
        options.interpolation.originX,
        options.interpolation.originY,
        options.interpolation.originZ,
        xOffset,
        yOffset,
        zOffset,
      ].join('|'),
      state: options.state,
    })

const evaluateInterpolated = (
  density: DensityInterpolated,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  const context = requireEvaluationContext(state, density.kind)
  const interpolation = createInterpolationState(position, context)
  const sample = createInterpolatedSample({
    context,
    density,
    evaluate,
    interpolation,
    state,
  })
  const lowerXLowerY = interpolate(
    interpolate(
      sample(
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
      ),
      sample(
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
      ),
      interpolation.xDelta,
    ),
    interpolate(
      sample(
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
      ),
      sample(
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
      ),
      interpolation.xDelta,
    ),
    interpolation.yDelta,
  )
  const upperXLowerY = interpolate(
    interpolate(
      sample(
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
      ),
      sample(
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
      ),
      interpolation.xDelta,
    ),
    interpolate(
      sample(
        DENSITY_INTERPOLATION_LOWER_BOUNDARY,
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
      ),
      sample(
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
        DENSITY_INTERPOLATION_UPPER_BOUNDARY,
      ),
      interpolation.xDelta,
    ),
    interpolation.yDelta,
  )
  return interpolate(lowerXLowerY, upperXLowerY, interpolation.zDelta)
}

const evaluateBlendDensity = (
  density: DensityBlendDensity,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  const context = requireEvaluationContext(state, density.kind)
  if (typeof context.blendDensity === 'undefined') {
    state.failure ??= new RangeError('blend-density requires context.blendDensity')
    return DENSITY_ZERO
  }
  return captureResult(
    state,
    context.blendDensity(requireDensityValue(state, evaluate(density.input, position)), position),
    DensityValue(DENSITY_ZERO),
  )
}

const evaluateBlendAlpha = (
  density: DensityBlendAlpha,
  position: DensityPosition,
  state: EvaluationState,
): number => {
  const context = requireEvaluationContext(state, density.kind)
  if (typeof context.blendAlpha === 'undefined') {
    state.failure ??= new RangeError('blend-alpha requires context.blendAlpha')
    return DENSITY_ZERO
  }
  return captureResult(state, context.blendAlpha(position), DensityValue(DENSITY_ZERO))
}

const evaluateBlendOffset = (
  density: DensityBlendOffset,
  position: DensityPosition,
  state: EvaluationState,
): number => {
  const context = requireEvaluationContext(state, density.kind)
  if (typeof context.blendOffset === 'undefined') {
    state.failure ??= new RangeError('blend-offset requires context.blendOffset')
    return DENSITY_ZERO
  }
  return captureResult(state, context.blendOffset(position), DensityValue(DENSITY_ZERO))
}

const isDensityContextComposite = (
  density: DensityComposite,
): density is DensityContextComposite =>
  density.kind === 'interpolated' ||
  density.kind === 'flat-cache' ||
  density.kind === 'cache-2d' ||
  density.kind === 'cache-once' ||
  density.kind === 'cache-all-in-cell' ||
  density.kind === 'blend-density' ||
  density.kind === 'blend-alpha' ||
  density.kind === 'blend-offset'

const isDensityCacheComposite = (
  density: DensityContextComposite,
): density is DensityCacheComposite =>
  density.kind === 'interpolated' ||
  density.kind === 'flat-cache' ||
  density.kind === 'cache-2d' ||
  density.kind === 'cache-once' ||
  density.kind === 'cache-all-in-cell'

const evaluateCacheComposite = (
  density: DensityCacheComposite,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  if (density.kind === 'interpolated') {
    return evaluateInterpolated(density, position, state, evaluate)
  }
  if (density.kind === 'flat-cache') {
    return evaluateFlatCache(density, position, state, evaluate)
  }
  if (density.kind === 'cache-2d') {
    return evaluateCache2D(density, position, state, evaluate)
  }
  if (density.kind === 'cache-once') {
    return evaluateCachedOnce(density, position, state, evaluate)
  }
  return evaluateCacheAllInCell(density, position, state, evaluate)
}

const evaluateBlendComposite = (
  density: DensityBlendComposite,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  if (density.kind === 'blend-density') {
    return evaluateBlendDensity(density, position, state, evaluate)
  }
  if (density.kind === 'blend-alpha') {
    return evaluateBlendAlpha(density, position, state)
  }
  return evaluateBlendOffset(density, position, state)
}

const evaluateContextComposite = (
  density: DensityContextComposite,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  if (isDensityCacheComposite(density)) {
    return evaluateCacheComposite(density, position, state, evaluate)
  }
  return evaluateBlendComposite(density, position, state, evaluate)
}

const isDensityOperationComposite = (
  density: DensityComposite,
): density is DensityOperationComposite =>
  density.kind === 'shifted-noise' ||
  density.kind === 'linear-operation' ||
  density.kind === 'weird-scaled-sampler' ||
  density.kind === 'binary' ||
  density.kind === 'unary'

const evaluateOperationComposite = (
  density: DensityOperationComposite,
  position: DensityPosition,
  evaluate: DensityEvaluator,
): number => {
  if (density.kind === 'shifted-noise') {
    return evaluateShiftedNoise(density, position, evaluate)
  }
  if (density.kind === 'linear-operation') {
    return evaluateLinearOperation(density, position, evaluate)
  }
  if (density.kind === 'weird-scaled-sampler') {
    return evaluateWeirdScaledSampler(density, position, evaluate)
  }
  if (density.kind === 'binary') {
    return evaluateBinary(density, position, evaluate)
  }
  return evaluateUnaryNode(density, position, evaluate)
}

const evaluateBranchComposite = (
  density: DensityBranchComposite,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  if (density.kind === 'clamp') {
    return evaluateClamp(density, position, evaluate)
  }
  if (density.kind === 'range-choice') {
    return evaluateRangeChoice(density, position, evaluate)
  }
  if (density.kind === 'find-top-surface') {
    return evaluateFindTopSurface(density, position, evaluate, state)
  }
  return evaluateSplineNode(density, position, evaluate, state)
}

const evaluateComposite = (
  density: DensityComposite,
  position: DensityPosition,
  state: EvaluationState,
  evaluate: DensityEvaluator,
): number => {
  if (isDensityContextComposite(density)) {
    return evaluateContextComposite(density, position, state, evaluate)
  }
  if (isDensityOperationComposite(density)) {
    return evaluateOperationComposite(density, position, evaluate)
  }
  return evaluateBranchComposite(density, position, state, evaluate)
}

const isDensityLeaf = (density: DensityFunction): density is DensityLeaf =>
  density.kind === 'constant' ||
  density.kind === 'coordinate' ||
  density.kind === 'end-islands' ||
  density.kind === 'noise' ||
  density.kind === 'old-blended-noise' ||
  density.kind === 'beardifier' ||
  density.kind === 'shift' ||
  density.kind === 'shift-a' ||
  density.kind === 'shift-b' ||
  density.kind === 'y-clamped-gradient'

const evaluateNode = (
  density: DensityFunction,
  position: DensityPosition,
  state: EvaluationState,
): number => {
  if (isDensityLeaf(density)) {
    return evaluateLeaf(density, position, state)
  }
  const evaluate: DensityEvaluator = (node, point) =>
    evaluateNode(node, point, state)
  return evaluateComposite(density, position, state, evaluate)
}

const evaluateWithState = (
  densityValue: DensityFunction,
  position: DensityPosition,
  state: EvaluationState,
): DensityFunctionResult<DensityValueType> => {
  delete state.failure
  return Result.gen(function* evaluateDensityFunctionWithStateResult() {
    const density = yield* requireDensityFunction(DensityFunctionFieldName('density'), densityValue)
    const normalizedPosition = yield* requirePosition(position)
    const value = evaluateNode(density, normalizedPosition, state)
    const { failure } = state
    if (typeof failure !== 'undefined') {
      clearEvaluationState(state)
      return yield* Result.fail(failure)
    }
    const finiteValue = yield* requireFiniteNumber(
      value,
      () => 'density evaluation result must be finite',
    )
    return DensityValue(finiteValue)
  })
}

const isDensityEvaluationSession = (
  value: DensityEvaluationContext | DensityEvaluationSession,
): value is DensityEvaluationSession =>
  value !== null &&
  typeof value === 'object' &&
  'evaluate' in value &&
  typeof value.evaluate === 'function'

export const createDensityEvaluationSession = (
  context: DensityEvaluationContext,
): DensityFunctionResult<DensityEvaluationSession> =>
  Result.map(requireDensityEvaluationContext(context), (normalizedContext) => {
    const state = createEvaluationState(normalizedContext)
    const evaluate = (
      density: DensityFunction,
      position: DensityPosition,
    ): DensityFunctionResult<DensityValueType> =>
      evaluateWithState(density, position, state)
    const clear = (): void => {
      delete state.failure
      clearEvaluationState(state)
    }
    return Object.freeze({ clear, context: normalizedContext, evaluate })
  })

export const evaluateDensityFunction = (
  density: DensityFunction,
  position: DensityPosition,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionResult<DensityValueType> => {
  if (typeof contextOrSession === 'undefined') {
    return evaluateWithState(density, position, createEvaluationState())
  }
  if (isDensityEvaluationSession(contextOrSession)) {
    return contextOrSession.evaluate(density, position)
  }
  return Result.flatMap(
    createDensityEvaluationSession(contextOrSession),
    (session) => session.evaluate(density, position),
  )
}
