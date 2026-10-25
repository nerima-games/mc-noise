import {
  BlockAxis,
  type BlockPosition,
  type Position,
  PositionAxis,
  blockPosition,
  position,
} from '@nerima-games/mc-kernel/domain/coordinates'
import { Brand, Option, Result } from 'effect'
import { type ClimateRTree, createClimateRTree } from './climate-rtree.js'
import { DefinedValueName, requireDefined } from './defined.js'
import {
  type DensityEvaluationContext,
  type DensityEvaluationSession,
  type DensityFunction,
  DensityFunctionFieldName,
  type DensityPosition,
  type DensityValue,
} from './density-function-types.js'
import {
  createDensityEvaluationSession,
  evaluateDensityFunction,
} from './density-function-evaluator.js'
import {
  isDensityFunction,
  requireDensityFunction,
} from './density-function-validation.js'
import {
  requireFiniteNumber,
  requireSafeInteger,
} from './number-validation.js'
import { densityZero } from './density-function.js'

const CLIMATE_ZERO_DISTANCE = 0
const CLIMATE_MINIMUM_SEARCH_STEP = 1
const CLIMATE_DEFAULT_RADIUS_VALUE = 16
const CLIMATE_DEFAULT_VERTICAL_RADIUS_VALUE = 8

export type ClimateValue = number & Brand.Brand<'ClimateValue'>
export const ClimateValue: Brand.Constructor<ClimateValue> = Brand.make<ClimateValue>(
  (value) => Number.isFinite(value) || 'climate value must be finite',
)

export type ClimateFieldName = string & Brand.Brand<'ClimateFieldName'>
export const ClimateFieldName: Brand.Constructor<ClimateFieldName> =
  Brand.nominal<ClimateFieldName>()

export type QuantizedClimateValue = number & Brand.Brand<'QuantizedClimateValue'>
export const QuantizedClimateValue: Brand.Constructor<QuantizedClimateValue> = Brand.make<QuantizedClimateValue>(
  (value) => Number.isSafeInteger(value) || 'quantized climate value must be a safe integer',
)

export type ClimateDistance = number & Brand.Brand<'ClimateDistance'>
export const ClimateDistance: Brand.Constructor<ClimateDistance> = Brand.make<ClimateDistance>(
  (value) => Number.isFinite(value) && value >= CLIMATE_ZERO_DISTANCE || 'climate distance must be finite and non-negative',
)

export type ClimateFitness = number & Brand.Brand<'ClimateFitness'>
export const ClimateFitness: Brand.Constructor<ClimateFitness> = Brand.make<ClimateFitness>(
  (value) => Number.isFinite(value) && value >= CLIMATE_ZERO_DISTANCE || 'climate fitness must be finite and non-negative',
)

export type ClimateSearchRadius = number & Brand.Brand<'ClimateSearchRadius'>
export const ClimateSearchRadius: Brand.Constructor<ClimateSearchRadius> = Brand.make<ClimateSearchRadius>(
  (value) => Number.isSafeInteger(value) && value >= CLIMATE_ZERO_DISTANCE || 'climate search radius must be a non-negative safe integer',
)

export type ClimateSearchStep = number & Brand.Brand<'ClimateSearchStep'>
export const ClimateSearchStep: Brand.Constructor<ClimateSearchStep> = Brand.make<ClimateSearchStep>(
  (value) => Number.isSafeInteger(value) && value > CLIMATE_ZERO_DISTANCE || 'climate search step must be a positive safe integer',
)

export type ClimateListIndex = number & Brand.Brand<'ClimateListIndex'>
export const ClimateListIndex: Brand.Constructor<ClimateListIndex> = Brand.make<ClimateListIndex>(
  (value) => Number.isSafeInteger(value) && value >= CLIMATE_ZERO_DISTANCE || 'climate list index must be a non-negative safe integer',
)
export const CLIMATE_PARAMETER_COUNT = 6
export const CLIMATE_HYPERCUBE_DIMENSION: number = CLIMATE_PARAMETER_COUNT
export const CLIMATE_QUANTIZATION_FACTOR = 10_000

const CLIMATE_LIST_ENTRY_LENGTH = 2
const CLIMATE_FIRST_ENTRY_INDEX = 0
const CLIMATE_SECOND_ENTRY_INDEX = 1
const CLIMATE_INDEX_INCREMENT = 1
const CLIMATE_DEFAULT_ORIGIN_COMPONENT = 0
const CLIMATE_DEFAULT_RADIUS = ClimateSearchRadius(CLIMATE_DEFAULT_RADIUS_VALUE)
const CLIMATE_DEFAULT_VERTICAL_RADIUS = ClimateSearchRadius(CLIMATE_DEFAULT_VERTICAL_RADIUS_VALUE)
const CLIMATE_DEFAULT_STEP = ClimateSearchStep(CLIMATE_MINIMUM_SEARCH_STEP)
const CLIMATE_EMPTY_TARGET_COUNT = 0

export const CLIMATE_CHANNELS = [
  'temperature',
  'humidity',
  'continentalness',
  'erosion',
  'depth',
  'weirdness',
] as const

export type ClimateChannel = typeof CLIMATE_CHANNELS[number]

export type ClimateParameter = Readonly<{
  readonly min: QuantizedClimateValue
  readonly max: QuantizedClimateValue
}>

export type ClimateParameterSpace = Readonly<{
  readonly temperature: ClimateParameter
  readonly humidity: ClimateParameter
  readonly continentalness: ClimateParameter
  readonly erosion: ClimateParameter
  readonly depth: ClimateParameter
  readonly weirdness: ClimateParameter
}>

export type ClimateParameterPoint = ClimateParameterSpace & Readonly<{
  readonly offset: QuantizedClimateValue
}>

export type ClimateTargetPoint = Readonly<{
  readonly temperature: QuantizedClimateValue
  readonly humidity: QuantizedClimateValue
  readonly continentalness: QuantizedClimateValue
  readonly erosion: QuantizedClimateValue
  readonly depth: QuantizedClimateValue
  readonly weirdness: QuantizedClimateValue
}>

export type ClimateParameterListEntry<Value> = readonly [
  ClimateParameterPoint,
  Value,
]

export type ClimateParameterList<Value> = Readonly<{
  readonly entries: readonly ClimateParameterListEntry<Value>[]
  readonly tree: ClimateRTree<Value>
}>

export type ClimateSampler = Readonly<{
  readonly temperature: DensityFunction
  readonly humidity: DensityFunction
  readonly continentalness: DensityFunction
  readonly erosion: DensityFunction
  readonly depth: DensityFunction
  readonly weirdness: DensityFunction
  readonly spawnTarget: readonly ClimateParameterPoint[]
}>

export type ClimateSamplerOptions = Readonly<{
  readonly temperature: DensityFunction
  readonly humidity: DensityFunction
  readonly continentalness: DensityFunction
  readonly erosion: DensityFunction
  readonly depth: DensityFunction
  readonly weirdness: DensityFunction
  readonly spawnTarget?: readonly ClimateParameterPoint[]
}>

export type ClimateSpawnSearchOptions = Readonly<{
  readonly context?: DensityEvaluationContext | DensityEvaluationSession
  readonly origin?: BlockPosition
  readonly radius?: ClimateSearchRadius
  readonly verticalRadius?: ClimateSearchRadius
  readonly step?: ClimateSearchStep
}>

type ClimateSixValues<Value> = readonly [
  temperature: Value,
  humidity: Value,
  continentalness: Value,
  erosion: Value,
  depth: Value,
  weirdness: Value,
]

type ClimateParameterArguments<Value> = readonly [
  ...ClimateSixValues<Value>,
  offset: ClimateValue,
]

type ClimateParameterValues = ClimateSixValues<unknown>
type ClimateParameterInputValues = ClimateSixValues<ClimateValue | ClimateParameter>
type ClimateTargetValues = ClimateSixValues<QuantizedClimateValue>
type ClimateValueTargetValues = ClimateSixValues<ClimateValue>

type ClimateUnknownObject = Readonly<{
  readonly min?: unknown
  readonly max?: unknown
  readonly temperature?: unknown
  readonly humidity?: unknown
  readonly continentalness?: unknown
  readonly erosion?: unknown
  readonly depth?: unknown
  readonly weirdness?: unknown
  readonly offset?: unknown
  readonly entries?: unknown
  readonly spawnTarget?: unknown
  readonly evaluate?: unknown
  readonly x?: unknown
  readonly y?: unknown
  readonly z?: unknown
}>

const isObject = (value: unknown): value is ClimateUnknownObject =>
  value !== null && typeof value === 'object'

const defaultIfUndefined = <Value>(
  value: Value | undefined,
  fallback: Value,
): Value => {
  if (typeof value === 'undefined') {
    return fallback
  }
  return value
}

const readNumber = (name: string, value: unknown): Result.Result<number, TypeError> => {
  if (typeof value === 'number') {
    return Result.succeed(value)
  }
  return Result.fail(new TypeError(`${name} must be a number`))
}

const readQuantized = (
  name: string,
  value: unknown,
): Result.Result<QuantizedClimateValue, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const number = yield* readNumber(name, value)
    const integer = yield* requireSafeInteger(
      number,
      () => `${name} must be a safe integer`,
    )
    return QuantizedClimateValue(integer)
  })

const readFinite = (
  name: string,
  value: number,
): Result.Result<ClimateValue, RangeError> =>
  Result.gen(function* resultGenerator() {
    const finite = yield* requireFiniteNumber(
      value,
      () => `${name} must be finite`,
    )
    return ClimateValue(finite)
  })

const isQuantized = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value)

export const quantizeCoord = (
  value: ClimateValue,
): Result.Result<QuantizedClimateValue, RangeError> =>
  Result.gen(function* resultGenerator() {
    const finite = yield* readFinite('coordinate', value)
    const integer = yield* requireSafeInteger(
      Math.trunc(finite * CLIMATE_QUANTIZATION_FACTOR),
      () => 'coordinate must be a safe integer',
    )
    return QuantizedClimateValue(integer)
  })

export const unquantizeCoord = (
  value: QuantizedClimateValue,
): Result.Result<ClimateValue, TypeError | RangeError> =>
  Result.map(
    readQuantized('coordinate', value),
    (quantized) => ClimateValue(quantized / CLIMATE_QUANTIZATION_FACTOR),
  )

const createParameterFromQuantized = (
  min: unknown,
  max: unknown,
): Result.Result<ClimateParameter, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const normalizedMin = yield* readQuantized('parameter min', min)
    const normalizedMax = yield* readQuantized('parameter max', max)
    if (normalizedMin > normalizedMax) {
      return yield* Result.fail(
        new RangeError('parameter min must be less than or equal to max'),
      )
    }
    return Object.freeze({ max: normalizedMax, min: normalizedMin })
  })

export const createClimateParameterFromQuantized: typeof createParameterFromQuantized = createParameterFromQuantized

export const climateParameter = (
  pointValue: ClimateValue,
): Result.Result<ClimateParameter, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const quantized = yield* quantizeCoord(pointValue)
    return yield* createParameterFromQuantized(quantized, quantized)
  })

export const climateParameterRange = (
  min: ClimateValue,
  max: ClimateValue,
): Result.Result<ClimateParameter, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const quantizedMin = yield* quantizeCoord(min)
    const quantizedMax = yield* quantizeCoord(max)
    return yield* createParameterFromQuantized(quantizedMin, quantizedMax)
  })

export const isClimateParameter = (
  value: unknown,
): value is ClimateParameter => {
  if (!isObject(value)) {
    return false
  }
  const candidate = value
  if (typeof candidate.min !== 'number' || typeof candidate.max !== 'number') {
    return false
  }
  if (!Number.isSafeInteger(candidate.min) || !Number.isSafeInteger(candidate.max)) {
    return false
  }
  return candidate.min <= candidate.max
}

export const requireClimateParameter = (
  name: ClimateFieldName,
  value: unknown,
): Result.Result<ClimateParameter, TypeError | RangeError> => {
  if (!isClimateParameter(value)) {
    return Result.fail(new TypeError(`${name} must be a ClimateParameter`))
  }
  return createParameterFromQuantized(value.min, value.max)
}

export function climateParameterSpan(
  min: ClimateValue,
  max: ClimateValue,
): Result.Result<ClimateParameter, TypeError | RangeError>
export function climateParameterSpan(
  min: ClimateParameter,
  max: ClimateParameter,
): Result.Result<ClimateParameter, TypeError | RangeError>
export function climateParameterSpan(
  min: ClimateValue | ClimateParameter,
  max: ClimateValue | ClimateParameter,
): Result.Result<ClimateParameter, TypeError | RangeError> {
  if (typeof min === 'number' && typeof max === 'number') {
    return climateParameterRange(min, max)
  }
  if (typeof min === 'object' && typeof max === 'object') {
    return Result.gen(function* resultGenerator() {
      const normalizedMin = yield* requireClimateParameter(ClimateFieldName('span min'), min)
      const normalizedMax = yield* requireClimateParameter(ClimateFieldName('span max'), max)
      return yield* createParameterFromQuantized(
        normalizedMin.min,
        normalizedMax.max,
      )
    })
  }
  return Result.fail(
    new TypeError('span bounds must both be numbers or ClimateParameters'),
  )
}

export const point: typeof climateParameter = climateParameter
export const span: typeof climateParameterSpan = climateParameterSpan

const normalizeParameter = (
  name: string,
  value: unknown,
): Result.Result<ClimateParameter, TypeError | RangeError> => {
  if (typeof value === 'number') {
    return Result.flatMap(
      readFinite(name, value),
      climateParameter,
    )
  }
  return requireClimateParameter(ClimateFieldName(name), value)
}

const createParameterSpace = (
  ...values: ClimateParameterValues
): Result.Result<ClimateParameterSpace, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const [
      temperatureValue,
      humidityValue,
      continentalnessValue,
      erosionValue,
      depthValue,
      weirdnessValue,
    ] = values
    const temperature = yield* normalizeParameter('temperature', temperatureValue)
    const humidity = yield* normalizeParameter('humidity', humidityValue)
    const continentalness = yield* normalizeParameter(
      'continentalness',
      continentalnessValue,
    )
    const erosion = yield* normalizeParameter('erosion', erosionValue)
    const depth = yield* normalizeParameter('depth', depthValue)
    const weirdness = yield* normalizeParameter('weirdness', weirdnessValue)
    return Object.freeze({
      continentalness,
      depth,
      erosion,
      humidity,
      temperature,
      weirdness,
    })
  })

const readParameterSpace = (
  name: string,
  value: unknown,
): Result.Result<ClimateParameterSpace, TypeError | RangeError> => {
  if (!isObject(value)) {
    return Result.fail(new TypeError(`${name} must be an object`))
  }
  const candidate = value
  return createParameterSpace(
    candidate.temperature,
    candidate.humidity,
    candidate.continentalness,
    candidate.erosion,
    candidate.depth,
    candidate.weirdness,
  )
}

export const createClimateParameterSpace = (
  ...values: ClimateParameterInputValues
): Result.Result<ClimateParameterSpace, TypeError | RangeError> =>
  createParameterSpace(...values)

export const createClimateParameterPointFromQuantized = (
  parameters: ClimateParameterSpace,
  offset: QuantizedClimateValue,
): Result.Result<ClimateParameterPoint, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const normalizedParameters = yield* readParameterSpace('parameters', parameters)
    const normalizedOffset = yield* readQuantized('offset', offset)
    return Object.freeze({
      ...normalizedParameters,
      offset: normalizedOffset,
    })
  })

export const isClimateParameterPoint = (
  value: unknown,
): value is ClimateParameterPoint => {
  if (!isObject(value)) {
    return false
  }
  const candidate = value
  return (
    isClimateParameter(candidate.temperature) &&
    isClimateParameter(candidate.humidity) &&
    isClimateParameter(candidate.continentalness) &&
    isClimateParameter(candidate.erosion) &&
    isClimateParameter(candidate.depth) &&
    isClimateParameter(candidate.weirdness) &&
    isQuantized(candidate.offset)
  )
}

export const requireClimateParameterPoint = (
  name: ClimateFieldName,
  value: unknown,
): Result.Result<ClimateParameterPoint, TypeError | RangeError> => {
  if (!isClimateParameterPoint(value)) {
    return Result.fail(new TypeError(`${name} must be a ClimateParameterPoint`))
  }
  return Result.flatMap(
    createParameterSpace(
      value.temperature,
      value.humidity,
      value.continentalness,
      value.erosion,
      value.depth,
      value.weirdness,
    ),
    (parameters) =>
      Result.map(
        readQuantized('offset', value.offset),
        (offset) => Object.freeze({ ...parameters, offset }),
      ),
  )
}

export function climateParameters(
  ...values: ClimateParameterArguments<ClimateValue>
): Result.Result<ClimateParameterPoint, TypeError | RangeError>
export function climateParameters(
  ...values: ClimateParameterArguments<ClimateParameter>
): Result.Result<ClimateParameterPoint, TypeError | RangeError>
export function climateParameters(
  ...values: ClimateParameterArguments<ClimateValue | ClimateParameter>
): Result.Result<ClimateParameterPoint, TypeError | RangeError> {
  const [
    temperature,
    humidity,
    continentalness,
    erosion,
    depth,
    weirdness,
    offset,
  ] = values
  return Result.gen(function* resultGenerator() {
    const parameters = yield* createParameterSpace(
      temperature,
      humidity,
      continentalness,
      erosion,
      depth,
      weirdness,
    )
    const quantizedOffset = yield* quantizeCoord(offset)
    return yield* createClimateParameterPointFromQuantized(
      parameters,
      quantizedOffset,
    )
  })
}

export const parameters: typeof climateParameters = climateParameters
export const parameterPoint: typeof climateParameters = climateParameters

export const createClimateTargetPointFromQuantized = (
  ...values: ClimateTargetValues
): Result.Result<ClimateTargetPoint, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const [temperatureValue, humidityValue, continentalnessValue, erosionValue, depthValue, weirdnessValue] = values
    const temperature = yield* readQuantized('temperature', temperatureValue)
    const humidity = yield* readQuantized('humidity', humidityValue)
    const continentalness = yield* readQuantized('continentalness', continentalnessValue)
    const erosion = yield* readQuantized('erosion', erosionValue)
    const depth = yield* readQuantized('depth', depthValue)
    const weirdness = yield* readQuantized('weirdness', weirdnessValue)
    return Object.freeze({
      continentalness,
      depth,
      erosion,
      humidity,
      temperature,
      weirdness,
    })
  })

export const climateTarget = (
  ...values: ClimateValueTargetValues
): Result.Result<ClimateTargetPoint, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const [temperature, humidity, continentalness, erosion, depth, weirdness] = values
    const quantizedTemperature = yield* quantizeCoord(temperature)
    const quantizedHumidity = yield* quantizeCoord(humidity)
    const quantizedContinentalness = yield* quantizeCoord(continentalness)
    const quantizedErosion = yield* quantizeCoord(erosion)
    const quantizedDepth = yield* quantizeCoord(depth)
    const quantizedWeirdness = yield* quantizeCoord(weirdness)
    return yield* createClimateTargetPointFromQuantized(
      quantizedTemperature,
      quantizedHumidity,
      quantizedContinentalness,
      quantizedErosion,
      quantizedDepth,
      quantizedWeirdness,
    )
  })

export const target: typeof climateTarget = climateTarget

const readTargetPoint = (
  name: string,
  value: unknown,
): Result.Result<ClimateTargetPoint, TypeError | RangeError> => {
  if (!isObject(value)) {
    return Result.fail(new TypeError(`${name} must be an object`))
  }
  const candidate = value
  return Result.gen(function* resultGenerator() {
    const temperature = yield* readQuantized(`${name}.temperature`, candidate.temperature)
    const humidity = yield* readQuantized(`${name}.humidity`, candidate.humidity)
    const continentalness = yield* readQuantized(
      `${name}.continentalness`,
      candidate.continentalness,
    )
    const erosion = yield* readQuantized(`${name}.erosion`, candidate.erosion)
    const depth = yield* readQuantized(`${name}.depth`, candidate.depth)
    const weirdness = yield* readQuantized(`${name}.weirdness`, candidate.weirdness)
    return Object.freeze({
      continentalness,
      depth,
      erosion,
      humidity,
      temperature,
      weirdness,
    })
  })
}

export const isClimateTargetPoint = (
  value: unknown,
): value is ClimateTargetPoint => {
  if (!isObject(value)) {
    return false
  }
  const candidate = value
  return (
    isQuantized(candidate.temperature) &&
    isQuantized(candidate.humidity) &&
    isQuantized(candidate.continentalness) &&
    isQuantized(candidate.erosion) &&
    isQuantized(candidate.depth) &&
    isQuantized(candidate.weirdness)
  )
}

const distance = (parameter: ClimateParameter, targetValue: number): number => {
  if (targetValue < parameter.min) {
    return parameter.min - targetValue
  }
  if (targetValue > parameter.max) {
    return targetValue - parameter.max
  }
  return CLIMATE_ZERO_DISTANCE
}

const squaredDistance = (parameter: ClimateParameter, targetValue: number): number => {
  const value = distance(parameter, targetValue)
  return value * value
}

export const climateParameterDistance = (
  parameter: ClimateParameter,
  targetValue: QuantizedClimateValue,
): Result.Result<ClimateDistance, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const normalizedParameter = yield* requireClimateParameter(
      ClimateFieldName('parameter'),
      parameter,
    )
    const normalizedTarget = yield* readQuantized('target', targetValue)
    return ClimateDistance(distance(normalizedParameter, normalizedTarget))
  })

export const climateParameterSpace = (
  pointValue: ClimateParameterPoint,
): Result.Result<ClimateParameterSpace, TypeError | RangeError> =>
  Result.map(
    requireClimateParameterPoint(ClimateFieldName('point'), pointValue),
    ({ continentalness, depth, erosion, humidity, temperature, weirdness }) =>
      Object.freeze({
        continentalness,
        depth,
        erosion,
        humidity,
        temperature,
        weirdness,
      }),
  )

const calculateClimateParameterPointFitness = (
  parameterValue: ClimateParameterPoint,
  targetValue: ClimateTargetPoint,
): ClimateFitness => {
  const fitness =
    squaredDistance(parameterValue.temperature, targetValue.temperature) +
    squaredDistance(parameterValue.humidity, targetValue.humidity) +
    squaredDistance(parameterValue.continentalness, targetValue.continentalness) +
    squaredDistance(parameterValue.erosion, targetValue.erosion) +
    squaredDistance(parameterValue.depth, targetValue.depth) +
    squaredDistance(parameterValue.weirdness, targetValue.weirdness) +
    parameterValue.offset * parameterValue.offset
  // Validated climate coordinates are safe integers, so this sum is finite and non-negative.
  return ClimateFitness(fitness)
}

export const climateParameterPointFitness = (
  pointValue: ClimateParameterPoint,
  targetValue: ClimateTargetPoint,
): Result.Result<ClimateFitness, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const normalizedPoint = yield* requireClimateParameterPoint(
      ClimateFieldName('point'),
      pointValue,
    )
    const normalizedTarget = yield* readTargetPoint('target', targetValue)
    return calculateClimateParameterPointFitness(normalizedPoint, normalizedTarget)
  })

const normalizeListEntry = <Value>(
  entry: unknown,
  entryIndex: number,
): Result.Result<ClimateParameterListEntry<Value>, TypeError | RangeError> => {
  if (!Array.isArray(entry) || entry.length !== CLIMATE_LIST_ENTRY_LENGTH) {
    return Result.fail(
      new TypeError(`entries[${entryIndex}] must be a [point, value] tuple`),
    )
  }
  return Result.map(
    requireClimateParameterPoint(
      ClimateFieldName(`entries[${entryIndex}][${CLIMATE_FIRST_ENTRY_INDEX}]`),
      entry[CLIMATE_FIRST_ENTRY_INDEX],
    ),
    (pointValue) =>
      Object.freeze([
        pointValue,
        entry[CLIMATE_SECOND_ENTRY_INDEX],
      ] as const),
  )
}

export const createClimateParameterList = <Value>(
  entries: readonly ClimateParameterListEntry<Value>[],
): Result.Result<ClimateParameterList<Value>, TypeError | RangeError> => {
  if (!Array.isArray(entries)) {
    return Result.fail(new TypeError('entries must be an array'))
  }
  return Result.gen(function* resultGenerator() {
    const normalizedEntries: ClimateParameterListEntry<Value>[] = []
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += CLIMATE_INDEX_INCREMENT) {
      normalizedEntries.push(
        yield* normalizeListEntry<Value>(entries[entryIndex], entryIndex),
      )
    }
    const frozenEntries = Object.freeze(normalizedEntries)
    const tree = yield* createClimateRTree(
      frozenEntries,
      climateParameterPointFitness,
    )
    return Object.freeze({
      entries: frozenEntries,
      tree,
    })
  })
}

export const requireClimateParameterList = <Value>(
  value: unknown,
): Result.Result<ClimateParameterList<Value>, TypeError | RangeError> => {
  if (!isObject(value)) {
    return Result.fail(new TypeError('parameter list must be an object'))
  }
  const { entries } = value
  if (!Array.isArray(entries)) {
    return Result.fail(new TypeError('parameter list.entries must be an array'))
  }
  return createClimateParameterList(entries)
}

export const findClimateValueIndex = <Value>(
  listValue: ClimateParameterList<Value>,
  targetValue: ClimateTargetPoint,
): Result.Result<Option.Option<ClimateListIndex>, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const list = yield* requireClimateParameterList<Value>(listValue)
    const targetPoint = yield* readTargetPoint('target', targetValue)
    const index = yield* list.tree.searchIndex(targetPoint)
    return Option.map(index, ClimateListIndex)
  })

export const findClimateValue = <Value>(
  listValue: ClimateParameterList<Value>,
  targetValue: ClimateTargetPoint,
): Result.Result<Option.Option<Value>, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const list = yield* requireClimateParameterList<Value>(listValue)
    const targetPoint = yield* readTargetPoint('target', targetValue)
    return yield* list.tree.search(targetPoint)
  })

const findClimateValueIndexBruteForce = <Value>(
  list: ClimateParameterList<Value>,
  targetPoint: ClimateTargetPoint,
): Result.Result<Option.Option<ClimateListIndex>, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    let bestIndex: ClimateListIndex | null = null
    let bestFitness = Number.POSITIVE_INFINITY
    for (
      let entryIndex = CLIMATE_FIRST_ENTRY_INDEX;
      entryIndex < list.entries.length;
      entryIndex += CLIMATE_INDEX_INCREMENT
    ) {
      const entry = yield* requireDefined(
        list.entries[entryIndex],
        DefinedValueName('climate entry'),
      )
      const fitness = calculateClimateParameterPointFitness(
        entry[CLIMATE_FIRST_ENTRY_INDEX],
        targetPoint,
      )
      if (bestIndex === null || fitness < bestFitness) {
        bestFitness = fitness
        bestIndex = ClimateListIndex(entryIndex)
      }
    }
    return Option.fromNullishOr(bestIndex)
  })

export const findClimateValueBruteForce = <Value>(
  listValue: ClimateParameterList<Value>,
  targetValue: ClimateTargetPoint,
): Result.Result<Option.Option<Value>, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const list = yield* requireClimateParameterList<Value>(listValue)
    const targetPoint = yield* readTargetPoint('target', targetValue)
    const indexOption = yield* findClimateValueIndexBruteForce(list, targetPoint)
    if (Option.isNone(indexOption)) {
      return Option.none()
    }
    const entry = yield* requireDefined(
      list.entries[indexOption.value],
      DefinedValueName('climate entry'),
    )
    return Option.some(entry[CLIMATE_SECOND_ENTRY_INDEX])
  })

const readSamplerFields = (
  value: unknown,
): Result.Result<ClimateSampler, TypeError | RangeError> => {
  if (!isObject(value)) {
    return Result.fail(new TypeError('sampler must be an object'))
  }
  const candidate = value
  const spawnTarget = defaultIfUndefined(candidate.spawnTarget, [])
  if (!Array.isArray(spawnTarget)) {
    return Result.fail(new TypeError('sampler.spawnTarget must be an array'))
  }
  return Result.gen(function* resultGenerator() {
    const normalizedSpawnTarget: ClimateParameterPoint[] = []
    for (let entryIndex = 0; entryIndex < spawnTarget.length; entryIndex += CLIMATE_INDEX_INCREMENT) {
      const pointValue = yield* requireDefined(
        spawnTarget[entryIndex],
        DefinedValueName(`sampler.spawnTarget[${entryIndex}]`),
      )
      normalizedSpawnTarget.push(
        yield* requireClimateParameterPoint(
          ClimateFieldName(`sampler.spawnTarget[${entryIndex}]`),
          pointValue,
        ),
      )
    }
    return Object.freeze({
      continentalness: yield* requireDensityFunction(
        DensityFunctionFieldName('sampler.continentalness'),
        candidate.continentalness,
      ),
      depth: yield* requireDensityFunction(
        DensityFunctionFieldName('sampler.depth'),
        candidate.depth,
      ),
      erosion: yield* requireDensityFunction(
        DensityFunctionFieldName('sampler.erosion'),
        candidate.erosion,
      ),
      humidity: yield* requireDensityFunction(
        DensityFunctionFieldName('sampler.humidity'),
        candidate.humidity,
      ),
      spawnTarget: Object.freeze(normalizedSpawnTarget),
      temperature: yield* requireDensityFunction(
        DensityFunctionFieldName('sampler.temperature'),
        candidate.temperature,
      ),
      weirdness: yield* requireDensityFunction(
        DensityFunctionFieldName('sampler.weirdness'),
        candidate.weirdness,
      ),
    })
  })
}

export const createClimateSampler = (
  options: ClimateSamplerOptions,
): Result.Result<ClimateSampler, TypeError | RangeError> =>
  readSamplerFields(options)

export const empty = (): Result.Result<ClimateSampler, TypeError | RangeError> =>
  createClimateSampler({
    continentalness: densityZero,
    depth: densityZero,
    erosion: densityZero,
    humidity: densityZero,
    temperature: densityZero,
    weirdness: densityZero,
  })

export const requireClimateSampler = (
  value: unknown,
): Result.Result<ClimateSampler, TypeError | RangeError> =>
  readSamplerFields(value)

export const isClimateSampler = (value: unknown): value is ClimateSampler => {
  if (!isObject(value)) {
    return false
  }
  const candidate = value
  return (
    isDensityFunction(candidate.temperature) &&
    isDensityFunction(candidate.humidity) &&
    isDensityFunction(candidate.continentalness) &&
    isDensityFunction(candidate.erosion) &&
    isDensityFunction(candidate.depth) &&
    isDensityFunction(candidate.weirdness) &&
    Array.isArray(candidate.spawnTarget) &&
    candidate.spawnTarget.every(isClimateParameterPoint)
  )
}

const isDensityEvaluationSession = (
  value: DensityEvaluationContext | DensityEvaluationSession,
): value is DensityEvaluationSession =>
  isObject(value) &&
  'evaluate' in value &&
  typeof value.evaluate === 'function'

const resolveEvaluator = (
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): Result.Result<
    (density: DensityFunction, samplePosition: DensityPosition) => Result.Result<DensityValue, TypeError | RangeError>,
  TypeError | RangeError
> => {
  if (typeof contextOrSession === 'undefined') {
    return Result.succeed((density, samplePosition) =>
      evaluateDensityFunction(density, samplePosition),
    )
  }
  if (isDensityEvaluationSession(contextOrSession)) {
    return Result.succeed(contextOrSession.evaluate)
  }
  return Result.map(
    createDensityEvaluationSession(contextOrSession),
    (session) => session.evaluate,
  )
}

const sampleWithEvaluator = (
  sampler: ClimateSampler,
  positionValue: DensityPosition,
  evaluate: (density: DensityFunction, position: DensityPosition) => Result.Result<DensityValue, TypeError | RangeError>,
): Result.Result<ClimateTargetPoint, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const toClimateValue = (
      value: DensityValue,
    ): Result.Result<ClimateValue, RangeError> =>
      Result.mapError(
        ClimateValue.result(value),
        (error) => new RangeError(error.message),
      )
    const temperature = yield* evaluate(sampler.temperature, positionValue)
    const climateTemperature = yield* toClimateValue(temperature)
    const humidity = yield* evaluate(sampler.humidity, positionValue)
    const climateHumidity = yield* toClimateValue(humidity)
    const continentalness = yield* evaluate(sampler.continentalness, positionValue)
    const climateContinentalness = yield* toClimateValue(continentalness)
    const erosion = yield* evaluate(sampler.erosion, positionValue)
    const climateErosion = yield* toClimateValue(erosion)
    const depth = yield* evaluate(sampler.depth, positionValue)
    const climateDepth = yield* toClimateValue(depth)
    const weirdness = yield* evaluate(sampler.weirdness, positionValue)
    const climateWeirdness = yield* toClimateValue(weirdness)
    return yield* climateTarget(
      climateTemperature,
      climateHumidity,
      climateContinentalness,
      climateErosion,
      climateDepth,
      climateWeirdness,
    )
  })

export const sampleClimate = (
  samplerValue: ClimateSampler,
  positionValue: Position,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): Result.Result<ClimateTargetPoint, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const sampler = yield* requireClimateSampler(samplerValue)
    const evaluate = yield* resolveEvaluator(contextOrSession)
    return yield* sampleWithEvaluator(sampler, positionValue, evaluate)
  })

export const sampleClimateAt = (
  samplerValue: ClimateSampler,
  positionValue: Position,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): Result.Result<ClimateTargetPoint, TypeError | RangeError> =>
  sampleClimate(samplerValue, positionValue, contextOrSession)

const readSafeInteger = (
  name: string,
  value: unknown,
): Result.Result<number, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const numericValue = yield* readNumber(name, value)
    return yield* requireSafeInteger(
      numericValue,
      () => `${name} must be a safe integer`,
    )
  })

const readNonNegativeInteger = (
  name: string,
  value: unknown,
): Result.Result<ClimateSearchRadius, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const numericValue = yield* readNumber(name, value)
    const radius = Result.mapError(
      ClimateSearchRadius.result(numericValue),
      (error) => new RangeError(error.message),
    )
    return yield* radius
  })

type NormalizedClimateSpawnSearch = Readonly<{
  readonly origin: BlockPosition
  readonly radius: ClimateSearchRadius
  readonly verticalRadius: ClimateSearchRadius
  readonly step: ClimateSearchStep
  readonly context?: DensityEvaluationContext | DensityEvaluationSession
}>

export type ClimateSpawnCandidate = Readonly<{
  readonly position: BlockPosition
  readonly fitness: ClimateFitness
}>

type ClimateSpawnOffset = Readonly<{
  readonly x: number
  readonly y: number
  readonly z: number
}>

type ClimateSpawnCandidateOptions = Readonly<{
  readonly evaluate: (
    density: DensityFunction,
    position: DensityPosition,
  ) => Result.Result<DensityValue, TypeError | RangeError>
  readonly sampler: ClimateSampler
  readonly search: NormalizedClimateSpawnSearch
  readonly targets: readonly ClimateParameterPoint[]
}>

const createDefaultOrigin = (): BlockPosition =>
  blockPosition(
    BlockAxis(CLIMATE_DEFAULT_ORIGIN_COMPONENT),
    BlockAxis(CLIMATE_DEFAULT_ORIGIN_COMPONENT),
    BlockAxis(CLIMATE_DEFAULT_ORIGIN_COMPONENT),
  )

const createSearchContext = (
  context?: DensityEvaluationContext | DensityEvaluationSession,
): Pick<NormalizedClimateSpawnSearch, 'context'> => {
  if (typeof context === 'undefined') {
    return Object.freeze({})
  }
  return Object.freeze({ context })
}

const readOrigin = (
  value: unknown,
): Result.Result<BlockPosition, TypeError | RangeError> => {
  if (!isObject(value)) {
    return Result.fail(new TypeError('origin must be an object'))
  }
  const candidate = value
  return Result.gen(function* resultGenerator() {
    const x = yield* readSafeInteger('origin.x', candidate.x)
    const y = yield* readSafeInteger('origin.y', candidate.y)
    const z = yield* readSafeInteger('origin.z', candidate.z)
    return blockPosition(BlockAxis(x), BlockAxis(y), BlockAxis(z))
  })
}

const readSearchOptions = (
  value: ClimateSpawnSearchOptions,
): Result.Result<NormalizedClimateSpawnSearch, TypeError | RangeError> => {
  if (!isObject(value)) {
    return Result.fail(new TypeError('search options must be an object'))
  }
  const options = value
  return Result.gen(function* resultGenerator() {
    const origin = yield* readOrigin(
      defaultIfUndefined(options.origin, createDefaultOrigin()),
    )
    const radius = yield* readNonNegativeInteger(
      'radius',
      defaultIfUndefined(options.radius, CLIMATE_DEFAULT_RADIUS),
    )
    const verticalRadius = yield* readNonNegativeInteger(
      'verticalRadius',
      defaultIfUndefined(options.verticalRadius, CLIMATE_DEFAULT_VERTICAL_RADIUS),
    )
    const stepNumber = yield* readSafeInteger(
      'step',
      defaultIfUndefined(options.step, CLIMATE_DEFAULT_STEP),
    )
    const step = Result.mapError(
      ClimateSearchStep.result(stepNumber),
      (error) => new RangeError(error.message),
    )
    return Object.freeze({
      ...createSearchContext(options.context),
      origin,
      radius,
      step: yield* step,
      verticalRadius,
    })
  })
}

const normalizeClimateTargets = (
  sampler: ClimateSampler,
  targets?: readonly ClimateParameterPoint[],
): Result.Result<readonly ClimateParameterPoint[], TypeError | RangeError> => {
  if (typeof targets === 'undefined') {
    return Result.succeed(sampler.spawnTarget)
  }
  return Result.gen(function* resultGenerator() {
    if (!Array.isArray(targets)) {
      return yield* Result.fail(new TypeError('targets must be an array'))
    }
    const normalizedTargets: ClimateParameterPoint[] = []
    for (let index = 0; index < targets.length; index += CLIMATE_INDEX_INCREMENT) {
      const targetValue = yield* requireDefined(
        targets[index],
        DefinedValueName(`targets[${index}]`),
      )
      normalizedTargets.push(
        yield* requireClimateParameterPoint(
          ClimateFieldName(`targets[${index}]`),
          targetValue,
        ),
      )
    }
    return Object.freeze(normalizedTargets)
  })
}

const calculateBestTargetFitness = (
  targets: readonly ClimateParameterPoint[],
  sampled: ClimateTargetPoint,
): Result.Result<ClimateFitness, TypeError | RangeError> => {
  // The public boundary returns Option.none before this helper for an empty target list.
  let bestFitness = Number.POSITIVE_INFINITY
  for (const targetValue of targets) {
    const fitness = calculateClimateParameterPointFitness(targetValue, sampled)
    bestFitness = Math.min(bestFitness, fitness)
  }
  return Result.succeed(ClimateFitness(bestFitness))
}

const toDensityPosition = (
  value: BlockPosition,
): Result.Result<Position, RangeError> =>
  Result.succeed(position(
    PositionAxis(value.x),
    PositionAxis(value.y),
    PositionAxis(value.z),
  ))

const createClimateSpawnCandidate = (
  options: ClimateSpawnCandidateOptions,
  offset: ClimateSpawnOffset,
): Result.Result<ClimateSpawnCandidate, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const x = Result.mapError(
      BlockAxis.result(options.search.origin.x + offset.x),
      (error) => new RangeError(error.message),
    )
    const y = Result.mapError(
      BlockAxis.result(options.search.origin.y + offset.y),
      (error) => new RangeError(error.message),
    )
    const z = Result.mapError(
      BlockAxis.result(options.search.origin.z + offset.z),
      (error) => new RangeError(error.message),
    )
    const positionValue = blockPosition(yield* x, yield* y, yield* z)
    const densityPosition = yield* toDensityPosition(positionValue)
    const sampled = yield* sampleWithEvaluator(
      options.sampler,
      densityPosition,
      options.evaluate,
    )
    return Object.freeze({
      fitness: yield* calculateBestTargetFitness(options.targets, sampled),
      position: positionValue,
    })
  })

const findBestClimateSpawnPosition = (
  candidateOptions: ClimateSpawnCandidateOptions,
): Result.Result<Option.Option<BlockPosition>, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    let bestCandidate: ClimateSpawnCandidate | null = null
    for (
      let x = -candidateOptions.search.radius;
      x <= candidateOptions.search.radius;
      x += candidateOptions.search.step
    ) {
      for (
        let y = -candidateOptions.search.verticalRadius;
        y <= candidateOptions.search.verticalRadius;
        y += candidateOptions.search.step
      ) {
        for (
          let z = -candidateOptions.search.radius;
          z <= candidateOptions.search.radius;
          z += candidateOptions.search.step
        ) {
          const candidate = yield* createClimateSpawnCandidate(candidateOptions, {
            x,
            y,
            z,
          })
          if (
            bestCandidate === null ||
            candidate.fitness < bestCandidate.fitness
          ) {
            bestCandidate = candidate
          }
        }
      }
    }
    // Validated non-negative radii and positive step make every inclusive loop non-empty.
    return Option.map(
      Option.fromNullishOr(bestCandidate),
      (candidate) => candidate.position,
    )
  })

export const findClimateSpawnPosition = (
  samplerValue: ClimateSampler,
  targets?: readonly ClimateParameterPoint[],
  options: ClimateSpawnSearchOptions = {},
): Result.Result<Option.Option<BlockPosition>, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const sampler = yield* requireClimateSampler(samplerValue)
    const search = yield* readSearchOptions(options)
    const targetValues = yield* normalizeClimateTargets(sampler, targets)
    if (targetValues.length === CLIMATE_EMPTY_TARGET_COUNT) {
      return Option.none()
    }
    const evaluate = yield* resolveEvaluator(search.context)
    return yield* findBestClimateSpawnPosition(
      Object.freeze({
        evaluate,
        sampler,
        search,
        targets: targetValues,
      }),
    )
  })

export const findSpawnPosition = (
  targets: readonly ClimateParameterPoint[],
  samplerValue: ClimateSampler,
  options?: ClimateSpawnSearchOptions,
): Result.Result<Option.Option<BlockPosition>, TypeError | RangeError> =>
  findClimateSpawnPosition(samplerValue, targets, options)

export type ClimateSamplerRuntime = ClimateSampler & Readonly<{
  readonly sample: (
    position: Position,
    contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
  ) => Result.Result<ClimateTargetPoint, TypeError | RangeError>
  readonly findSpawnPosition: (
    options?: ClimateSpawnSearchOptions,
  ) => Result.Result<Option.Option<BlockPosition>, TypeError | RangeError>
}>

export const createClimateSamplerRuntime = (
  samplerValue: ClimateSampler,
): Result.Result<ClimateSamplerRuntime, TypeError | RangeError> =>
  Result.map(requireClimateSampler(samplerValue), (sampler) =>
    Object.freeze({
      ...sampler,
      findSpawnPosition: (
        options?: ClimateSpawnSearchOptions,
      ): Result.Result<Option.Option<BlockPosition>, TypeError | RangeError> =>
        findClimateSpawnPosition(sampler, sampler.spawnTarget, options),
      sample: (
        positionValue: Position,
        contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
      ): Result.Result<ClimateTargetPoint, TypeError | RangeError> =>
        sampleClimateAt(sampler, positionValue, contextOrSession),
    }),
  )
