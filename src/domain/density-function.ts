import { BlockAxis, PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import {
  DENSITY_DEFAULT_OFFSET,
  DENSITY_DEFAULT_SCALE,
  DENSITY_HALF,
  DENSITY_INFINITY,
  DENSITY_NEGATIVE_INFINITY,
  DENSITY_NEGATIVE_ONE,
  DENSITY_ONE,
  DENSITY_SHIFT_OUTPUT_SCALE,
  DENSITY_THREE,
  DENSITY_TWO,
  DENSITY_ZERO,
} from './density-function-constants.js'
import {
  type DensityBinaryOperation,
  type DensityBlendAlpha,
  type DensityBlendDensity,
  type DensityBlendOffset,
  DensityBound,
  type DensityBounds,
  type DensityCache2D,
  type DensityCacheAllInCell,
  type DensityCacheOnce,
  DensityCellSize,
  type DensityCellSize as DensityCellSizeValue,
  type DensityCoordinateAxis,
  type DensityCoordinateOptions,
  type DensityFindTopSurface,
  type DensityFlatCache,
  type DensityFunction,
  type DensityFunctionResult,
  type DensityFunctionValue,
  type DensityInterpolated,
  type DensityLinearOperationType,
  type DensityMappedOperation,
  type DensityNoiseInRangeOptions,
  type DensityNoiseOptions,
  type DensityNoiseSource,
  type DensityOldBlendedNoiseOptions,
  type DensityOldBlendedNoiseSource,
  type DensityRarityValueMapper,
  DensityScale,
  type DensityScale as DensityScaleValue,
  type DensityShiftedNoise2DOptions,
  type DensityShiftedNoise2DShifts,
  type DensityShiftedNoiseShifts,
  type DensityUnaryOperation,
  DensityValue,
  type DensityValue as DensityValueType,
} from './density-function-types.js'
import {
  END_ISLANDS_MAX_VALUE,
  END_ISLANDS_MIN_VALUE,
  createEndIslandsSampler,
} from './end-islands.js'
import { type Spline, createSpline } from './spline.js'
import {
  boundsForBinary,
  boundsForCoordinate,
  boundsForFindTopSurface,
  boundsForLinearOperation,
  boundsForNoise,
  boundsForScaledNoise,
  boundsForUnary,
  boundsForWeirdScaledSampler,
  createDensityBounds,
  densityBounds,
} from './density-function-bounds.js'
import { densityRangeChoice, densitySpline, densityYClampedGradient } from './density-function-spatial.js'
import { requireFiniteNumber, requirePositiveInteger, requireSafeInteger } from './number-validation.js'
import type { NoiseFn3D } from './perlin.js'
import { Result } from 'effect'

type NoiseParameters = Readonly<{
  readonly xzScale: DensityScaleValue
  readonly yScale: DensityScaleValue
}>

const DEFAULT_DENSITY_SCALE = DensityScale(DENSITY_DEFAULT_SCALE)
const DEFAULT_POSITION_OFFSET = PositionAxis(DENSITY_DEFAULT_OFFSET)
const ZERO_DENSITY_VALUE = DensityValue(DENSITY_ZERO)
const SHIFT_OUTPUT_SCALE = DensityScale(DENSITY_SHIFT_OUTPUT_SCALE)
const UNBOUNDED_DENSITY_BOUNDS: DensityBounds = Object.freeze({
  maxValue: DensityBound(DENSITY_INFINITY),
  minValue: DensityBound(DENSITY_NEGATIVE_INFINITY),
})

const requireAxis = (
  axis: DensityCoordinateAxis,
): Result.Result<DensityCoordinateAxis, RangeError> => {
  if (axis === 'x' || axis === 'y' || axis === 'z') {
    return Result.succeed(axis)
  }
  return Result.fail(new RangeError(`axis must be x, y, or z, received ${String(axis)}`))
}

const requireBinaryOperation = (
  operation: DensityBinaryOperation,
): Result.Result<DensityBinaryOperation, RangeError> => {
  if (operation === 'add' || operation === 'mul' || operation === 'min' || operation === 'max') {
    return Result.succeed(operation)
  }
  return Result.fail(new RangeError(`unsupported binary operation, received ${String(operation)}`))
}

const requireUnaryOperation = (
  operation: DensityUnaryOperation,
): Result.Result<DensityUnaryOperation, RangeError> => {
  if (
    operation === 'abs' ||
    operation === 'square' ||
    operation === 'cube' ||
    operation === 'half-negative' ||
    operation === 'quarter-negative' ||
    operation === 'squeeze' ||
    operation === 'invert'
  ) {
    return Result.succeed(operation)
  }
  return Result.fail(new RangeError(`unsupported unary operation, received ${String(operation)}`))
}

const requireLinearOperation = (
  operation: DensityLinearOperationType,
): Result.Result<DensityLinearOperationType, RangeError> => {
  if (operation === 'add' || operation === 'mul') {
    return Result.succeed(operation)
  }
  return Result.fail(new RangeError(`unsupported linear operation, received ${String(operation)}`))
}

const requireRarityValueMapper = (
  mapper: DensityRarityValueMapper,
): Result.Result<DensityRarityValueMapper, RangeError> => {
  if (mapper === 'type-1' || mapper === 'type-2') {
    return Result.succeed(mapper)
  }
  return Result.fail(
    new RangeError(`unsupported rarity value mapper, received ${String(mapper)}`),
  )
}

const requireDensityScale = (
  name: string,
  value: DensityScaleValue,
): Result.Result<DensityScaleValue, RangeError> =>
  Result.map(requireFiniteNumber(value, () => `${name} must be finite`), DensityScale)

const requireDensityValue = (
  name: string,
  value: DensityValueType,
): Result.Result<DensityValueType, RangeError> =>
  Result.map(requireFiniteNumber(value, () => `${name} must be finite`), DensityValue)

const requirePositionAxis = (
  name: string,
  value: PositionAxis,
): Result.Result<PositionAxis, RangeError> =>
  Result.map(requireFiniteNumber(value, () => `${name} must be finite`), PositionAxis)

const requireBlockAxis = (
  name: string,
  value: BlockAxis,
): Result.Result<BlockAxis, RangeError> =>
  Result.map(requireSafeInteger(value, () => `${name} must be a safe integer`), BlockAxis)

const readNoiseParameters = (
  options: DensityNoiseOptions,
): DensityFunctionResult<NoiseParameters> => {
  if (options === null || typeof options !== 'object') {
    return Result.fail(new TypeError('noise options must be an object'))
  }
  return Result.gen(function* readNoiseParametersResult() {
    const xzScale = yield* requireDensityScale(
      'xzScale',
      options.xzScale ?? DEFAULT_DENSITY_SCALE,
    )
    const yScale = yield* requireDensityScale(
      'yScale',
      options.yScale ?? DEFAULT_DENSITY_SCALE,
    )
    return { xzScale, yScale }
  })
}

const normalizeNoiseSource = (
  source: DensityNoiseSource,
): DensityFunctionResult<DensityNoiseSource> => {
  if (source === null || typeof source !== 'object') {
    return Result.fail(new TypeError('noise source must be an object'))
  }
  if (typeof source.sample !== 'function') {
    return Result.fail(new TypeError('noise source sample must be a function'))
  }
  return Result.map(createDensityBounds(source.minValue, source.maxValue), (bounds) =>
    Object.freeze({
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      sample: source.sample,
    }),
  )
}

const normalizeOldBlendedNoiseSource = (
  source: DensityOldBlendedNoiseSource,
): DensityFunctionResult<DensityOldBlendedNoiseSource> => {
  if (source === null || typeof source !== 'object') {
    return Result.fail(new TypeError('old blended noise source must be an object'))
  }
  if (typeof source.mainNoise !== 'function') {
    return Result.fail(new TypeError('old blended noise mainNoise must be a function'))
  }
  if (typeof source.minLimitNoise !== 'function') {
    return Result.fail(new TypeError('old blended noise minLimitNoise must be a function'))
  }
  if (typeof source.maxLimitNoise !== 'function') {
    return Result.fail(new TypeError('old blended noise maxLimitNoise must be a function'))
  }
  return Result.map(createDensityBounds(source.minValue, source.maxValue), (bounds) =>
    Object.freeze({
      mainNoise: source.mainNoise,
      maxLimitNoise: source.maxLimitNoise,
      maxValue: bounds.maxValue,
      minLimitNoise: source.minLimitNoise,
      minValue: bounds.minValue,
    }),
  )
}

const freezeDensity = <DensityNode extends DensityFunction>(density: DensityNode): DensityNode =>
  Object.freeze(density)

export const createDensityNoiseSource = (
  sample: NoiseFn3D,
  bounds: DensityBounds,
): DensityFunctionResult<DensityNoiseSource> => {
  if (typeof sample !== 'function') {
    return Result.fail(new TypeError('noise source sample must be a function'))
  }
  if (bounds === null || typeof bounds !== 'object') {
    return Result.fail(new TypeError('noise source bounds must be an object'))
  }
  return Result.map(createDensityBounds(bounds.minValue, bounds.maxValue), (normalizedBounds) =>
    Object.freeze({
      maxValue: normalizedBounds.maxValue,
      minValue: normalizedBounds.minValue,
      sample,
    }),
  )
}

export const createDensityOldBlendedNoiseSource = (
  source: Pick<
    DensityOldBlendedNoiseSource,
    'mainNoise' | 'minLimitNoise' | 'maxLimitNoise'
  >,
  bounds: DensityBounds,
): DensityFunctionResult<DensityOldBlendedNoiseSource> => {
  if (source === null || typeof source !== 'object') {
    return Result.fail(new TypeError('old blended noise source must be an object'))
  }
  if (bounds === null || typeof bounds !== 'object') {
    return Result.fail(new TypeError('old blended noise bounds must be an object'))
  }
  return Result.flatMap(
    createDensityBounds(bounds.minValue, bounds.maxValue),
    (normalizedBounds) =>
      normalizeOldBlendedNoiseSource({
        mainNoise: source.mainNoise,
        maxLimitNoise: source.maxLimitNoise,
        maxValue: normalizedBounds.maxValue,
        minLimitNoise: source.minLimitNoise,
        minValue: normalizedBounds.minValue,
      }),
  )
}

const makeDensityConstant = (value: DensityValueType): DensityFunction =>
  freezeDensity({
    kind: 'constant',
    maxValue: DensityBound(value),
    minValue: DensityBound(value),
    value,
  })

export const densityConstant = (
  value: DensityValueType,
): DensityFunctionResult<DensityFunction> =>
  Result.map(requireDensityValue('value', value), makeDensityConstant)

export const densityZero: DensityFunction = makeDensityConstant(ZERO_DENSITY_VALUE)

type DensitySplineDefinition = Spline

export type DensitySplineInput = Readonly<{
  readonly coordinate: DensityFunction
  readonly spline: DensitySplineDefinition
}>

export const createDensitySpline = (
  coordinate: DensityFunction,
  spline: DensitySplineDefinition,
): DensityFunctionResult<DensitySplineInput> =>
  Result.map(createSpline(spline), (normalizedSpline) =>
    Object.freeze({
      coordinate,
      spline: normalizedSpline,
    }),
  )

const normalizeDensityValue = (
  name: 'min' | 'max',
  value: DensityFunctionValue,
): DensityFunctionResult<DensityFunction> => {
  if (typeof value === 'number') {
    return Result.map(requireDensityValue(name, value), makeDensityConstant)
  }
  return Result.succeed(value)
}

export const densityCoordinate = (
  axis: DensityCoordinateAxis,
  options: DensityCoordinateOptions = {},
): DensityFunctionResult<DensityFunction> => {
  if (options === null || typeof options !== 'object') {
    return Result.fail(new TypeError('coordinate options must be an object'))
  }
  return Result.gen(function* densityCoordinateResult() {
    const coordinateAxis = yield* requireAxis(axis)
    const scale = yield* requireDensityScale(
      'scale',
      options.scale ?? DEFAULT_DENSITY_SCALE,
    )
    const offset = yield* requirePositionAxis(
      'offset',
      options.offset ?? DEFAULT_POSITION_OFFSET,
    )
    const bounds = boundsForCoordinate(scale, offset)
    return freezeDensity({
      axis: coordinateAxis,
      kind: 'coordinate',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      offset,
      scale,
    })
  })
}

export const densityNoise = (
  source: DensityNoiseSource,
  options: DensityNoiseOptions = {},
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* densityNoiseResult() {
    const normalizedSource = yield* normalizeNoiseSource(source)
    const parameters = yield* readNoiseParameters(options)
    const bounds = boundsForNoise(normalizedSource)
    return freezeDensity({
      kind: 'noise',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      source: normalizedSource,
      xzScale: parameters.xzScale,
      yScale: parameters.yScale,
    })
  })

export const densityOldBlendedNoise = (
  source: DensityOldBlendedNoiseSource,
  options: DensityOldBlendedNoiseOptions,
): DensityFunctionResult<DensityFunction> => {
  if (options === null || typeof options !== 'object') {
    return Result.fail(new TypeError('old blended noise options must be an object'))
  }
  return Result.gen(function* densityOldBlendedNoiseResult() {
    const normalizedSource = yield* normalizeOldBlendedNoiseSource(source)
    const smearScaleMultiplier = yield* requireDensityScale(
      'smearScaleMultiplier',
      options.smearScaleMultiplier,
    )
    const xzFactor = yield* requireDensityScale('xzFactor', options.xzFactor)
    const xzScale = yield* requireDensityScale('xzScale', options.xzScale)
    const yFactor = yield* requireDensityScale('yFactor', options.yFactor)
    const yScale = yield* requireDensityScale('yScale', options.yScale)
    return freezeDensity({
      kind: 'old-blended-noise',
      maxValue: normalizedSource.maxValue,
      minValue: normalizedSource.minValue,
      smearScaleMultiplier,
      source: normalizedSource,
      xzFactor,
      xzScale,
      yFactor,
      yScale,
    })
  })
}

export const densityBeardifier = (): DensityFunction =>
  freezeDensity({
    kind: 'beardifier',
    maxValue: DensityBound(DENSITY_INFINITY),
    minValue: DensityBound(DENSITY_NEGATIVE_INFINITY),
  })

export const densityShift = (
  source: DensityNoiseSource,
): DensityFunctionResult<DensityFunction> =>
  Result.map(normalizeNoiseSource(source), (normalizedSource) => {
    const bounds = boundsForScaledNoise(normalizedSource, SHIFT_OUTPUT_SCALE)
    return freezeDensity({
      kind: 'shift',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      source: normalizedSource,
    })
  })

export const densityShiftA = (
  source: DensityNoiseSource,
): DensityFunctionResult<DensityFunction> =>
  Result.map(normalizeNoiseSource(source), (normalizedSource) => {
    const bounds = boundsForScaledNoise(normalizedSource, SHIFT_OUTPUT_SCALE)
    return freezeDensity({
      kind: 'shift-a',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      source: normalizedSource,
    })
  })

export const densityShiftB = (
  source: DensityNoiseSource,
): DensityFunctionResult<DensityFunction> =>
  Result.map(normalizeNoiseSource(source), (normalizedSource) => {
    const bounds = boundsForScaledNoise(normalizedSource, SHIFT_OUTPUT_SCALE)
    return freezeDensity({
      kind: 'shift-b',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      source: normalizedSource,
    })
  })

export const densityShiftedNoise = (
  source: DensityNoiseSource,
  shifts: DensityShiftedNoiseShifts,
  options: DensityNoiseOptions = {},
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* densityShiftedNoiseResult() {
    const normalizedSource = yield* normalizeNoiseSource(source)
    const parameters = yield* readNoiseParameters(options)
    const bounds = boundsForNoise(normalizedSource)
    return freezeDensity({
      kind: 'shifted-noise',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      shiftX: shifts.x,
      shiftY: shifts.y,
      shiftZ: shifts.z,
      source: normalizedSource,
      xzScale: parameters.xzScale,
      yScale: parameters.yScale,
    })
  })

export const densityLinearOperation = (
  operation: DensityLinearOperationType,
  input: DensityFunction,
  argument: DensityValueType,
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* densityLinearOperationResult() {
    const linearOperation = yield* requireLinearOperation(operation)
    const finiteArgument = yield* requireDensityValue('argument', argument)
    const bounds = boundsForLinearOperation(linearOperation, input, finiteArgument)
    return freezeDensity({
      argument: finiteArgument,
      input,
      kind: 'linear-operation',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      operation: linearOperation,
    })
  })

const maxRarityFor = (mapper: DensityRarityValueMapper): DensityScaleValue => {
  if (mapper === 'type-1') {
    return DensityScale(DENSITY_THREE)
  }
  return DensityScale(DENSITY_TWO)
}

export const densityWeirdScaledSampler = (
  input: DensityFunction,
  source: DensityNoiseSource,
  rarityValueMapper: DensityRarityValueMapper,
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* densityWeirdScaledSamplerResult() {
    const mapper = yield* requireRarityValueMapper(rarityValueMapper)
    const normalizedSource = yield* normalizeNoiseSource(source)
    const bounds = boundsForWeirdScaledSampler(normalizedSource, maxRarityFor(mapper))
    return freezeDensity({
      input,
      kind: 'weird-scaled-sampler',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      rarityValueMapper: mapper,
      source: normalizedSource,
    })
  })

export const densityEndIslands = (
  seed: bigint,
): DensityFunctionResult<DensityFunction> =>
  Result.map(createEndIslandsSampler(seed), (sampler) =>
    freezeDensity({
      kind: 'end-islands',
      maxValue: DensityBound(END_ISLANDS_MAX_VALUE),
      minValue: DensityBound(END_ISLANDS_MIN_VALUE),
      sampler,
      seed,
    }),
  )

export const densityBinary = (
  operation: DensityBinaryOperation,
  left: DensityFunction,
  right: DensityFunction,
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* densityBinaryResult() {
    const binaryOperation = yield* requireBinaryOperation(operation)
    const bounds = boundsForBinary(binaryOperation, left, right)
    return freezeDensity({
      kind: 'binary',
      left,
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      operation: binaryOperation,
      right,
    })
  })

export const densityAdd = (
  left: DensityFunction,
  right: DensityFunction,
): DensityFunctionResult<DensityFunction> =>
  densityBinary('add', left, right)

export const densityMul = (
  left: DensityFunction,
  right: DensityFunction,
): DensityFunctionResult<DensityFunction> =>
  densityBinary('mul', left, right)

export const densityMin = (
  left: DensityFunction,
  right: DensityFunction,
): DensityFunctionResult<DensityFunction> =>
  densityBinary('min', left, right)

export const densityMax = (
  left: DensityFunction,
  right: DensityFunction,
): DensityFunctionResult<DensityFunction> =>
  densityBinary('max', left, right)

export const densityUnary = (
  operation: DensityUnaryOperation,
  input: DensityFunction,
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* densityUnaryResult() {
    const unaryOperation = yield* requireUnaryOperation(operation)
    const bounds = boundsForUnary(unaryOperation, input)
    return freezeDensity({
      input,
      kind: 'unary',
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      operation: unaryOperation,
    })
  })

export const densityAbs = (input: DensityFunction): DensityFunctionResult<DensityFunction> =>
  densityUnary('abs', input)

export const densitySquare = (input: DensityFunction): DensityFunctionResult<DensityFunction> =>
  densityUnary('square', input)

export const densityCube = (input: DensityFunction): DensityFunctionResult<DensityFunction> =>
  densityUnary('cube', input)

export const densityHalfNegative = (input: DensityFunction): DensityFunctionResult<DensityFunction> =>
  densityUnary('half-negative', input)

export const densityQuarterNegative = (input: DensityFunction): DensityFunctionResult<DensityFunction> =>
  densityUnary('quarter-negative', input)

export const densitySqueeze = (input: DensityFunction): DensityFunctionResult<DensityFunction> =>
  densityUnary('squeeze', input)

export const densityInvert = (input: DensityFunction): DensityFunctionResult<DensityFunction> =>
  densityUnary('invert', input)

export const densityMap = (
  input: DensityFunction,
  operation: DensityMappedOperation,
): DensityFunctionResult<DensityFunction> => densityUnary(operation, input)

export const densityMapRange = (
  input: DensityFunction,
  min: DensityValueType,
  max: DensityValueType,
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* densityMapRangeResult() {
    const finiteMin = yield* requireDensityValue('min', min)
    const finiteMax = yield* requireDensityValue('max', max)
    const midpointNumber = yield* requireFiniteNumber(
      (finiteMin + finiteMax) * DENSITY_HALF,
      () => 'map range midpoint must be finite',
    )
    const scaleNumber = yield* requireFiniteNumber(
      (finiteMax - finiteMin) * DENSITY_HALF,
      () => 'map range scale must be finite',
    )
    const midpoint = DensityValue(midpointNumber)
    const scale = DensityValue(scaleNumber)
    const scaled = yield* densityLinearOperation('mul', input, scale)
    return yield* densityAdd(makeDensityConstant(midpoint), scaled)
  })

export type DensityMappedNoiseArguments =
  | readonly [fromY: BlockAxis, toY: BlockAxis]
  | readonly [yScale: DensityScaleValue, fromY: BlockAxis, toY: BlockAxis]
  | readonly [xzScale: DensityScaleValue, yScale: DensityScaleValue, fromY: BlockAxis, toY: BlockAxis]

type DensityMappedNoiseParameters = Readonly<{
  readonly fromY: BlockAxis
  readonly toY: BlockAxis
  readonly xzScale: DensityScaleValue
  readonly yScale: DensityScaleValue
}>

const readDensityMappedNoiseParameters = (
  parameters: DensityMappedNoiseArguments,
): DensityMappedNoiseParameters => {
  if (parameters.length === DENSITY_TWO) {
    const [fromY, toY] = parameters
    return {
      fromY,
      toY,
      xzScale: DEFAULT_DENSITY_SCALE,
      yScale: DEFAULT_DENSITY_SCALE,
    }
  }
  if (parameters.length === DENSITY_THREE) {
    const [yScale, fromY, toY] = parameters
    return {
      fromY,
      toY,
      xzScale: DEFAULT_DENSITY_SCALE,
      yScale,
    }
  }
  const [xzScale, yScale, fromY, toY] = parameters
  return {
    fromY,
    toY,
    xzScale,
    yScale,
  }
}

export const densityMappedNoise = (
  source: DensityNoiseSource,
  ...parameters: DensityMappedNoiseArguments
): DensityFunctionResult<DensityFunction> => {
  const mapped = readDensityMappedNoiseParameters(parameters)
  return Result.flatMap(
    densityNoise(source, {
      xzScale: mapped.xzScale,
      yScale: mapped.yScale,
    }),
    (noiseDensity) =>
      densityMapRange(
        noiseDensity,
        DensityValue(mapped.fromY),
        DensityValue(mapped.toY),
      ),
  )
}

export const densityNoiseInRange = (
  source: DensityNoiseSource,
  options: DensityNoiseInRangeOptions,
): DensityFunctionResult<DensityFunction> =>
  Result.flatMap(
    densityNoise(source, {
      xzScale: options.xzScale ?? DEFAULT_DENSITY_SCALE,
      yScale: options.yScale ?? DEFAULT_DENSITY_SCALE,
    }),
    (noiseDensity) => densityMapRange(noiseDensity, options.min, options.max),
  )

export const densityShiftedNoise2D = (
  source: DensityNoiseSource,
  shifts: DensityShiftedNoise2DShifts,
  options: DensityShiftedNoise2DOptions = {},
): DensityFunctionResult<DensityFunction> =>
  densityShiftedNoise(
    source,
    {
      x: shifts.x,
      y: densityZero,
      z: shifts.z,
    },
    {
      xzScale: options.xzScale ?? DEFAULT_DENSITY_SCALE,
      yScale: DensityScale(DENSITY_ZERO),
    },
  )

const densityContextBounds = (input: DensityFunction): DensityBounds =>
  densityBounds(input)

const densityUnboundedBounds = (): DensityBounds =>
  UNBOUNDED_DENSITY_BOUNDS

export const densityFindTopSurface = (
  density: DensityFunction,
  upperBound: DensityFunction,
  lowerBound: BlockAxis,
  cellHeight: DensityCellSizeValue,
): DensityFunctionResult<DensityFindTopSurface> =>
  Result.gen(function* densityFindTopSurfaceResult() {
    const normalizedLowerBound = yield* requireBlockAxis('lowerBound', lowerBound)
    const normalizedCellHeight = yield* Result.map(
      requirePositiveInteger(cellHeight, () => 'cellHeight must be a positive integer'),
      DensityCellSize,
    )
    const bounds = boundsForFindTopSurface(densityBounds(upperBound), normalizedLowerBound)
    return freezeDensity({
      cellHeight: normalizedCellHeight,
      density,
      kind: 'find-top-surface',
      lowerBound: normalizedLowerBound,
      maxValue: bounds.maxValue,
      minValue: bounds.minValue,
      upperBound,
    })
  })

export const densityInterpolated = (input: DensityFunction): DensityInterpolated => {
  const bounds = densityContextBounds(input)
  return freezeDensity({
    input,
    kind: 'interpolated',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
  })
}

export const densityFlatCache = (input: DensityFunction): DensityFlatCache => {
  const bounds = densityContextBounds(input)
  return freezeDensity({
    input,
    kind: 'flat-cache',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
  })
}

export const densityCache2D = (input: DensityFunction): DensityCache2D => {
  const bounds = densityContextBounds(input)
  return freezeDensity({
    input,
    kind: 'cache-2d',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
  })
}

export const densityCacheOnce = (input: DensityFunction): DensityCacheOnce => {
  const bounds = densityContextBounds(input)
  return freezeDensity({
    input,
    kind: 'cache-once',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
  })
}

export const densityCacheAllInCell = (
  input: DensityFunction,
): DensityCacheAllInCell => {
  const bounds = densityContextBounds(input)
  return freezeDensity({
    input,
    kind: 'cache-all-in-cell',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
  })
}

export const densityBlendDensity = (input: DensityFunction): DensityBlendDensity => {
  const bounds = densityUnboundedBounds()
  return freezeDensity({
    input,
    kind: 'blend-density',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
  })
}

export const densityBlendAlpha = (): DensityBlendAlpha => {
  const bounds = Object.freeze({
    maxValue: DensityBound(DENSITY_ONE),
    minValue: DensityBound(DENSITY_ZERO),
  })
  return freezeDensity({
    kind: 'blend-alpha',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
  })
}

export const densityBlendOffset = (): DensityBlendOffset => {
  const bounds = densityUnboundedBounds()
  return freezeDensity({
    kind: 'blend-offset',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
  })
}

export const interpolated: typeof densityInterpolated = densityInterpolated
export const flatCache: typeof densityFlatCache = densityFlatCache
export const cache2d: typeof densityCache2D = densityCache2D
export const cacheOnce: typeof densityCacheOnce = densityCacheOnce
export const cacheAllInCell: typeof densityCacheAllInCell = densityCacheAllInCell
export const blendDensity: typeof densityBlendDensity = densityBlendDensity
export const blendAlpha: typeof densityBlendAlpha = densityBlendAlpha
export const blendOffset: typeof densityBlendOffset = densityBlendOffset

export const densityLerp = (
  delta: DensityFunction,
  min: DensityFunctionValue,
  max: DensityFunctionValue,
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* densityLerpResult() {
    const minDensity = yield* normalizeDensityValue('min', min)
    const maxDensity = yield* normalizeDensityValue('max', max)
    const negativeMin = yield* densityLinearOperation(
      'mul',
      minDensity,
      DensityValue(DENSITY_NEGATIVE_ONE),
    )
    const difference = yield* densityAdd(maxDensity, negativeMin)
    const scaledDelta = yield* densityMul(delta, difference)
    return yield* densityAdd(minDensity, scaledDelta)
  })


export const zero = (): DensityFunction => densityZero
export const constant: typeof densityConstant = densityConstant
export const shift: typeof densityShift = densityShift
export const shiftA: typeof densityShiftA = densityShiftA
export const shiftB: typeof densityShiftB = densityShiftB
export const add: typeof densityAdd = densityAdd
export const mul: typeof densityMul = densityMul
export const min: typeof densityMin = densityMin
export const max: typeof densityMax = densityMax
export const weirdScaledSampler: typeof densityWeirdScaledSampler = densityWeirdScaledSampler
export const endIslands: typeof densityEndIslands = densityEndIslands
export const oldBlendedNoise: typeof densityOldBlendedNoise = densityOldBlendedNoise
export const beardifier: typeof densityBeardifier = densityBeardifier
export const lerp: typeof densityLerp = densityLerp

export const DensityMappedType: Readonly<{
  ABS: 'ABS'
  CUBE: 'CUBE'
  HALF_NEGATIVE: 'HALF_NEGATIVE'
  QUARTER_NEGATIVE: 'QUARTER_NEGATIVE'
  SQUARE: 'SQUARE'
  SQUEEZE: 'SQUEEZE'
}> = Object.freeze({
  ABS: 'ABS',
  CUBE: 'CUBE',
  HALF_NEGATIVE: 'HALF_NEGATIVE',
  QUARTER_NEGATIVE: 'QUARTER_NEGATIVE',
  SQUARE: 'SQUARE',
  SQUEEZE: 'SQUEEZE',
} as const)

export type DensityMappedType =
  (typeof DensityMappedType)[keyof typeof DensityMappedType]

const densityMappedOperationByName: Readonly<
  Record<DensityMappedType, DensityMappedOperation>
> = Object.freeze({
  ABS: 'abs',
  CUBE: 'cube',
  HALF_NEGATIVE: 'half-negative',
  QUARTER_NEGATIVE: 'quarter-negative',
  SQUARE: 'square',
  SQUEEZE: 'squeeze',
})

const normalizeDensityMappedOperation = (
  operation: DensityMappedType,
): Result.Result<DensityMappedOperation, RangeError> => {
  const normalized = densityMappedOperationByName[operation]
  if (typeof normalized === 'undefined') {
    return Result.fail(
      new RangeError(`unsupported mapped operation, received ${String(operation)}`),
    )
  }
  return Result.succeed(normalized)
}

export const map = (
  input: DensityFunction,
  operation: DensityMappedType,
): DensityFunctionResult<DensityFunction> =>
  Result.flatMap(normalizeDensityMappedOperation(operation), (normalized) =>
    densityMap(input, normalized),
  )

export const mappedNoise: typeof densityMappedNoise = densityMappedNoise

export const spline = (definition: DensitySplineInput): DensityFunctionResult<DensityFunction> =>
  densitySpline(definition.coordinate, definition.spline)

export const findTopSurface: typeof densityFindTopSurface = densityFindTopSurface

export const yClampedGradient: typeof densityYClampedGradient = densityYClampedGradient

export function noise(source: DensityNoiseSource): DensityFunctionResult<DensityFunction>
export function noise(source: DensityNoiseSource, yScale: DensityScaleValue): DensityFunctionResult<DensityFunction>
export function noise(
  source: DensityNoiseSource,
  xzScale: DensityScaleValue,
  yScale: DensityScaleValue,
): DensityFunctionResult<DensityFunction>
export function noise(
  source: DensityNoiseSource,
  second?: DensityScaleValue,
  third?: DensityScaleValue,
): DensityFunctionResult<DensityFunction> {
  if (typeof second === 'undefined') {
    return densityNoise(source)
  }
  if (typeof third === 'undefined') {
    return densityNoise(source, { yScale: second })
  }
  return densityNoise(source, { xzScale: second, yScale: third })
}

export const rangeChoice = (
  input: DensityFunction,
  minInclusive: DensityValueType,
  maxExclusive: DensityValueType,
  ...[inRange, outOfRange]: [DensityFunction, DensityFunction]
): DensityFunctionResult<DensityFunction> =>
  densityRangeChoice(
    input,
    { maxExclusive, minInclusive },
    inRange,
    outOfRange,
  )

export const shiftedNoise2d = (
  shiftX: DensityFunction,
  shiftZ: DensityFunction,
  xzScale: DensityScaleValue,
  noiseData: DensityNoiseSource,
): DensityFunctionResult<DensityFunction> =>
  densityShiftedNoise2D(noiseData, { x: shiftX, z: shiftZ }, { xzScale })

export {
  densityClamp,
  densityRangeChoice,
  densitySpline,
  densityYClampedGradient,
} from './density-function-spatial.js'

export {
  createDensityEvaluationSession,
  evaluateDensityFunction,
} from './density-function-evaluator.js'
export { createDensityEvaluationContext } from './density-function-context.js'
export { densityBounds }
