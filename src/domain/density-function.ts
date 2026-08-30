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
import type {
  DensityBinaryOperation,
  DensityBlendAlpha,
  DensityBlendDensity,
  DensityBlendOffset,
  DensityBounds,
  DensityCache2D,
  DensityCacheAllInCell,
  DensityCacheOnce,
  DensityCoordinateAxis,
  DensityCoordinateOptions,
  DensityFindTopSurface,
  DensityFlatCache,
  DensityFunction,
  DensityFunctionValue,
  DensityInterpolated,
  DensityLinearOperationType,
  DensityMappedOperation,
  DensityNoiseInRangeOptions,
  DensityNoiseOptions,
  DensityNoiseSource,
  DensityOldBlendedNoiseOptions,
  DensityOldBlendedNoiseSource,
  DensityRarityValueMapper,
  DensityShiftedNoise2DOptions,
  DensityShiftedNoise2DShifts,
  DensityShiftedNoiseShifts,
  DensityUnaryOperation,
} from './density-function-types.js'
import {
  END_ISLANDS_MAX_VALUE,
  END_ISLANDS_MIN_VALUE,
  createEndIslandsSampler,
} from './end-islands.js'
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
import {
  densityRangeChoice,
  densitySpline,
  densityYClampedGradient,
} from './density-function-spatial.js'
import {
  requireFiniteNumber,
  requirePositiveInteger,
  requireSafeInteger,
} from './number-validation.js'
import type { NoiseFn3D } from './perlin.js'
import { createSpline } from './spline.js'

type NoiseParameters = Readonly<{
  readonly xzScale: number
  readonly yScale: number
}>

const requireAxis = (axis: DensityCoordinateAxis): DensityCoordinateAxis => {
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') {
    throw new RangeError(`axis must be x, y, or z, received ${String(axis)}`)
  }
  return axis
}

const requireBinaryOperation = (operation: DensityBinaryOperation): DensityBinaryOperation => {
  if (operation !== 'add' && operation !== 'mul' && operation !== 'min' && operation !== 'max') {
    throw new RangeError(`unsupported binary operation, received ${String(operation)}`)
  }
  return operation
}

const requireUnaryOperation = (operation: DensityUnaryOperation): DensityUnaryOperation => {
  if (
    operation !== 'abs' &&
    operation !== 'square' &&
    operation !== 'cube' &&
    operation !== 'half-negative' &&
    operation !== 'quarter-negative' &&
    operation !== 'squeeze' &&
    operation !== 'invert'
  ) {
    throw new RangeError(`unsupported unary operation, received ${String(operation)}`)
  }
  return operation
}

const requireLinearOperation = (
  operation: DensityLinearOperationType,
): DensityLinearOperationType => {
  if (operation !== 'add' && operation !== 'mul') {
    throw new RangeError(`unsupported linear operation, received ${String(operation)}`)
  }
  return operation
}

const requireRarityValueMapper = (
  mapper: DensityRarityValueMapper,
): DensityRarityValueMapper => {
  if (mapper !== 'type-1' && mapper !== 'type-2') {
    throw new RangeError(`unsupported rarity value mapper, received ${String(mapper)}`)
  }
  return mapper
}

const readNoiseParameters = (options: DensityNoiseOptions): NoiseParameters => ({
  xzScale: requireFiniteNumber('xzScale', options.xzScale ?? DENSITY_DEFAULT_SCALE),
  yScale: requireFiniteNumber('yScale', options.yScale ?? DENSITY_DEFAULT_SCALE),
})

const normalizeNoiseSource = (source: DensityNoiseSource): DensityNoiseSource => {
  if (typeof source.sample !== 'function') {
    throw new TypeError('noise source sample must be a function')
  }
  const bounds = createDensityBounds(source.minValue, source.maxValue)
  return Object.freeze({
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    sample: source.sample,
  })
}

const normalizeOldBlendedNoiseSource = (
  source: DensityOldBlendedNoiseSource,
): DensityOldBlendedNoiseSource => {
  if (source === null || typeof source !== 'object') {
    throw new TypeError('old blended noise source must be an object')
  }
  if (typeof source.mainNoise !== 'function') {
    throw new TypeError('old blended noise mainNoise must be a function')
  }
  if (typeof source.minLimitNoise !== 'function') {
    throw new TypeError('old blended noise minLimitNoise must be a function')
  }
  if (typeof source.maxLimitNoise !== 'function') {
    throw new TypeError('old blended noise maxLimitNoise must be a function')
  }
  const bounds = createDensityBounds(source.minValue, source.maxValue)
  return Object.freeze({
    mainNoise: source.mainNoise,
    maxLimitNoise: source.maxLimitNoise,
    maxValue: bounds.maxValue,
    minLimitNoise: source.minLimitNoise,
    minValue: bounds.minValue,
  })
}

const freezeDensity = <DensityNode extends DensityFunction>(density: DensityNode): DensityNode =>
  Object.freeze(density)

export const createDensityNoiseSource = (
  sample: NoiseFn3D,
  bounds: DensityBounds,
): DensityNoiseSource => {
  if (typeof sample !== 'function') {
    throw new TypeError('noise source sample must be a function')
  }
  const normalizedBounds = createDensityBounds(bounds.minValue, bounds.maxValue)
  return Object.freeze({
    maxValue: normalizedBounds.maxValue,
    minValue: normalizedBounds.minValue,
    sample,
  })
}

export const createDensityOldBlendedNoiseSource = (
  source: Pick<
    DensityOldBlendedNoiseSource,
    'mainNoise' | 'minLimitNoise' | 'maxLimitNoise'
  >,
  bounds: DensityBounds,
): DensityOldBlendedNoiseSource => {
  if (source === null || typeof source !== 'object') {
    throw new TypeError('old blended noise source must be an object')
  }
  const normalizedBounds = createDensityBounds(bounds.minValue, bounds.maxValue)
  return normalizeOldBlendedNoiseSource({
    mainNoise: source.mainNoise,
    maxLimitNoise: source.maxLimitNoise,
    maxValue: normalizedBounds.maxValue,
    minLimitNoise: source.minLimitNoise,
    minValue: normalizedBounds.minValue,
  })
}

export const densityConstant = (value: number): DensityFunction => {
  const finiteValue = requireFiniteNumber('value', value)
  return freezeDensity({
    kind: 'constant',
    maxValue: finiteValue,
    minValue: finiteValue,
    value: finiteValue,
  })
}

export const densityZero = densityConstant(DENSITY_ZERO)

type DensitySplineDefinition = ReturnType<typeof createSpline>

export type DensitySplineInput = Readonly<{
  readonly coordinate: DensityFunction
  readonly spline: DensitySplineDefinition
}>

export const createDensitySpline = (
  coordinate: DensityFunction,
  spline: DensitySplineDefinition,
): DensitySplineInput =>
  Object.freeze({
    coordinate,
    spline: createSpline(spline),
  })

const normalizeDensityValue = (
  name: 'min' | 'max',
  value: DensityFunctionValue,
): DensityFunction => {
  if (typeof value === 'number') {
    return densityConstant(requireFiniteNumber(name, value))
  }
  return value
}

export const densityCoordinate = (
  axis: DensityCoordinateAxis,
  options: DensityCoordinateOptions = {},
): DensityFunction => {
  const coordinateAxis = requireAxis(axis)
  const scale = requireFiniteNumber('scale', options.scale ?? DENSITY_DEFAULT_SCALE)
  const offset = requireFiniteNumber('offset', options.offset ?? DENSITY_DEFAULT_OFFSET)
  const bounds = boundsForCoordinate(scale, offset)
  return freezeDensity({
    axis: coordinateAxis,
    kind: 'coordinate',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    offset,
    scale,
  })
}

export const densityNoise = (
  source: DensityNoiseSource,
  options: DensityNoiseOptions = {},
): DensityFunction => {
  const normalizedSource = normalizeNoiseSource(source)
  const parameters = readNoiseParameters(options)
  const bounds = boundsForNoise(normalizedSource)
  return freezeDensity({
    kind: 'noise',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    source: normalizedSource,
    xzScale: parameters.xzScale,
    yScale: parameters.yScale,
  })
}

export const densityOldBlendedNoise = (
  source: DensityOldBlendedNoiseSource,
  options: DensityOldBlendedNoiseOptions,
): DensityFunction => {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('old blended noise options must be an object')
  }
  const normalizedSource = normalizeOldBlendedNoiseSource(source)
  return freezeDensity({
    kind: 'old-blended-noise',
    maxValue: normalizedSource.maxValue,
    minValue: normalizedSource.minValue,
    smearScaleMultiplier: requireFiniteNumber(
      'smearScaleMultiplier',
      options.smearScaleMultiplier,
    ),
    source: normalizedSource,
    xzFactor: requireFiniteNumber('xzFactor', options.xzFactor),
    xzScale: requireFiniteNumber('xzScale', options.xzScale),
    yFactor: requireFiniteNumber('yFactor', options.yFactor),
    yScale: requireFiniteNumber('yScale', options.yScale),
  })
}

export const densityBeardifier = (): DensityFunction =>
  freezeDensity({
    kind: 'beardifier',
    maxValue: DENSITY_INFINITY,
    minValue: DENSITY_NEGATIVE_INFINITY,
  })

export const densityShift = (source: DensityNoiseSource): DensityFunction => {
  const normalizedSource = normalizeNoiseSource(source)
  const bounds = boundsForScaledNoise(normalizedSource, DENSITY_SHIFT_OUTPUT_SCALE)
  return freezeDensity({
    kind: 'shift',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    source: normalizedSource,
  })
}

export const densityShiftA = (source: DensityNoiseSource): DensityFunction => {
  const normalizedSource = normalizeNoiseSource(source)
  const bounds = boundsForScaledNoise(normalizedSource, DENSITY_SHIFT_OUTPUT_SCALE)
  return freezeDensity({
    kind: 'shift-a',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    source: normalizedSource,
  })
}

export const densityShiftB = (source: DensityNoiseSource): DensityFunction => {
  const normalizedSource = normalizeNoiseSource(source)
  const bounds = boundsForScaledNoise(normalizedSource, DENSITY_SHIFT_OUTPUT_SCALE)
  return freezeDensity({
    kind: 'shift-b',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    source: normalizedSource,
  })
}

export const densityShiftedNoise = (
  source: DensityNoiseSource,
  shifts: DensityShiftedNoiseShifts,
  options: DensityNoiseOptions = {},
): DensityFunction => {
  const normalizedSource = normalizeNoiseSource(source)
  const parameters = readNoiseParameters(options)
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
}

export const densityLinearOperation = (
  operation: DensityLinearOperationType,
  input: DensityFunction,
  argument: number,
): DensityFunction => {
  const linearOperation = requireLinearOperation(operation)
  const finiteArgument = requireFiniteNumber('argument', argument)
  const bounds = boundsForLinearOperation(linearOperation, input, finiteArgument)
  return freezeDensity({
    argument: finiteArgument,
    input,
    kind: 'linear-operation',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    operation: linearOperation,
  })
}

const maxRarityFor = (mapper: DensityRarityValueMapper): number => {
  if (mapper === 'type-1') {
    return DENSITY_THREE
  }
  return DENSITY_TWO
}

export const densityWeirdScaledSampler = (
  input: DensityFunction,
  source: DensityNoiseSource,
  rarityValueMapper: DensityRarityValueMapper,
): DensityFunction => {
  const mapper = requireRarityValueMapper(rarityValueMapper)
  const normalizedSource = normalizeNoiseSource(source)
  const bounds = boundsForWeirdScaledSampler(normalizedSource, maxRarityFor(mapper))
  return freezeDensity({
    input,
    kind: 'weird-scaled-sampler',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    rarityValueMapper: mapper,
    source: normalizedSource,
  })
}

export const densityEndIslands = (seed: bigint): DensityFunction => {
  const sampler = createEndIslandsSampler(seed)
  return freezeDensity({
    kind: 'end-islands',
    maxValue: END_ISLANDS_MAX_VALUE,
    minValue: END_ISLANDS_MIN_VALUE,
    sampler,
    seed,
  })
}

export const densityBinary = (
  operation: DensityBinaryOperation,
  left: DensityFunction,
  right: DensityFunction,
): DensityFunction => {
  const binaryOperation = requireBinaryOperation(operation)
  const bounds = boundsForBinary(binaryOperation, left, right)
  return freezeDensity({
    kind: 'binary',
    left,
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    operation: binaryOperation,
    right,
  })
}

export const densityAdd = (left: DensityFunction, right: DensityFunction): DensityFunction =>
  densityBinary('add', left, right)

export const densityMul = (left: DensityFunction, right: DensityFunction): DensityFunction =>
  densityBinary('mul', left, right)

export const densityMin = (left: DensityFunction, right: DensityFunction): DensityFunction =>
  densityBinary('min', left, right)

export const densityMax = (left: DensityFunction, right: DensityFunction): DensityFunction =>
  densityBinary('max', left, right)

export const densityUnary = (
  operation: DensityUnaryOperation,
  input: DensityFunction,
): DensityFunction => {
  const unaryOperation = requireUnaryOperation(operation)
  const bounds = boundsForUnary(unaryOperation, input)
  return freezeDensity({
    input,
    kind: 'unary',
    maxValue: bounds.maxValue,
    minValue: bounds.minValue,
    operation: unaryOperation,
  })
}

export const densityAbs = (input: DensityFunction): DensityFunction => densityUnary('abs', input)

export const densitySquare = (input: DensityFunction): DensityFunction => densityUnary('square', input)

export const densityCube = (input: DensityFunction): DensityFunction => densityUnary('cube', input)

export const densityHalfNegative = (input: DensityFunction): DensityFunction =>
  densityUnary('half-negative', input)

export const densityQuarterNegative = (input: DensityFunction): DensityFunction =>
  densityUnary('quarter-negative', input)

export const densitySqueeze = (input: DensityFunction): DensityFunction =>
  densityUnary('squeeze', input)

export const densityInvert = (input: DensityFunction): DensityFunction =>
  densityUnary('invert', input)

export const densityMap = (
  input: DensityFunction,
  operation: DensityMappedOperation,
): DensityFunction => densityUnary(operation, input)

export const densityMapRange = (
  input: DensityFunction,
  min: number,
  max: number,
): DensityFunction => {
  const finiteMin = requireFiniteNumber('min', min)
  const finiteMax = requireFiniteNumber('max', max)
  const midpoint = requireFiniteNumber(
    'map range midpoint',
    (finiteMin + finiteMax) * DENSITY_HALF,
  )
  const scale = requireFiniteNumber(
    'map range scale',
    (finiteMax - finiteMin) * DENSITY_HALF,
  )
  return densityAdd(
    densityConstant(midpoint),
    densityLinearOperation('mul', input, scale),
  )
}

export type DensityMappedNoiseArguments =
  | readonly [fromY: number, toY: number]
  | readonly [yScale: number, fromY: number, toY: number]
  | readonly [xzScale: number, yScale: number, fromY: number, toY: number]

type DensityMappedNoiseParameters = Readonly<{
  readonly fromY: number
  readonly toY: number
  readonly xzScale: number
  readonly yScale: number
}>

const readDensityMappedNoiseParameters = (
  parameters: DensityMappedNoiseArguments,
): DensityMappedNoiseParameters => {
  if (parameters.length === DENSITY_TWO) {
    const [fromY, toY] = parameters
    return {
      fromY,
      toY,
      xzScale: DENSITY_DEFAULT_SCALE,
      yScale: DENSITY_DEFAULT_SCALE,
    }
  }
  if (parameters.length === DENSITY_THREE) {
    const [yScale, fromY, toY] = parameters
    return {
      fromY,
      toY,
      xzScale: DENSITY_DEFAULT_SCALE,
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
): DensityFunction => {
  const mapped = readDensityMappedNoiseParameters(parameters)
  return densityMapRange(
    densityNoise(source, {
      xzScale: mapped.xzScale,
      yScale: mapped.yScale,
    }),
    mapped.fromY,
    mapped.toY,
  )
}

export const densityNoiseInRange = (
  source: DensityNoiseSource,
  options: DensityNoiseInRangeOptions,
): DensityFunction =>
  densityMapRange(
    densityNoise(source, {
      xzScale: options.xzScale ?? DENSITY_DEFAULT_SCALE,
      yScale: options.yScale ?? DENSITY_DEFAULT_SCALE,
    }),
    options.min,
    options.max,
  )

export const densityShiftedNoise2D = (
  source: DensityNoiseSource,
  shifts: DensityShiftedNoise2DShifts,
  options: DensityShiftedNoise2DOptions = {},
): DensityFunction =>
  densityShiftedNoise(
    source,
    {
      x: shifts.x,
      y: densityZero,
      z: shifts.z,
    },
    {
      xzScale: options.xzScale ?? DENSITY_DEFAULT_SCALE,
      yScale: DENSITY_ZERO,
    },
  )

const densityContextBounds = (input: DensityFunction): DensityBounds =>
  densityBounds(input)

const densityUnboundedBounds = (): DensityBounds =>
  createDensityBounds(DENSITY_NEGATIVE_INFINITY, DENSITY_INFINITY)

export const densityFindTopSurface = (
  density: DensityFunction,
  upperBound: DensityFunction,
  lowerBound: number,
  cellHeight: number,
): DensityFindTopSurface => {
  const normalizedLowerBound = requireSafeInteger('lowerBound', lowerBound)
  const normalizedCellHeight = requirePositiveInteger('cellHeight', cellHeight)
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
}

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
  const bounds = createDensityBounds(DENSITY_ZERO, DENSITY_ONE)
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

export const interpolated = densityInterpolated
export const flatCache = densityFlatCache
export const cache2d = densityCache2D
export const cacheOnce = densityCacheOnce
export const cacheAllInCell = densityCacheAllInCell
export const blendDensity = densityBlendDensity
export const blendAlpha = densityBlendAlpha
export const blendOffset = densityBlendOffset

export const densityLerp = (
  delta: DensityFunction,
  min: DensityFunctionValue,
  max: DensityFunctionValue,
): DensityFunction => {
  const minDensity = normalizeDensityValue('min', min)
  const maxDensity = normalizeDensityValue('max', max)
  const difference = densityAdd(
    maxDensity,
    densityLinearOperation('mul', minDensity, DENSITY_NEGATIVE_ONE),
  )
  return densityAdd(minDensity, densityMul(delta, difference))
}


export const zero = (): DensityFunction => densityZero
export const constant = densityConstant
export const shift = densityShift
export const shiftA = densityShiftA
export const shiftB = densityShiftB
export const add = densityAdd
export const mul = densityMul
export const min = densityMin
export const max = densityMax
export const weirdScaledSampler = densityWeirdScaledSampler
export const endIslands = densityEndIslands
export const oldBlendedNoise = densityOldBlendedNoise
export const beardifier = densityBeardifier
export const lerp = densityLerp

export const DensityMappedType = Object.freeze({
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
): DensityMappedOperation => {
  const normalized = densityMappedOperationByName[operation]
  if (typeof normalized === 'undefined') {
    throw new RangeError(`unsupported mapped operation, received ${String(operation)}`)
  }
  return normalized
}

export const map = (
  input: DensityFunction,
  operation: DensityMappedType,
): DensityFunction => densityMap(input, normalizeDensityMappedOperation(operation))

export const mappedNoise = densityMappedNoise

export const spline = (definition: DensitySplineInput): DensityFunction =>
  densitySpline(definition.coordinate, definition.spline)

export const findTopSurface = densityFindTopSurface

export const yClampedGradient = densityYClampedGradient

export function noise(source: DensityNoiseSource): DensityFunction
export function noise(source: DensityNoiseSource, yScale: number): DensityFunction
export function noise(
  source: DensityNoiseSource,
  xzScale: number,
  yScale: number,
): DensityFunction
export function noise(
  source: DensityNoiseSource,
  second?: number,
  third?: number,
): DensityFunction {
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
  minInclusive: number,
  maxExclusive: number,
  ...[inRange, outOfRange]: [DensityFunction, DensityFunction]
): DensityFunction =>
  densityRangeChoice(
    input,
    { maxExclusive, minInclusive },
    inRange,
    outOfRange,
  )

export const shiftedNoise2d = (
  shiftX: DensityFunction,
  shiftZ: DensityFunction,
  xzScale: number,
  noiseData: DensityNoiseSource,
): DensityFunction =>
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
