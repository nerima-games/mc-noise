import {
  type BlockPosition,
  type Position,
  blockPosition,
} from '@nerima-games/mc-kernel'
import { type ClimateRTree, createClimateRTree } from './climate-rtree.js'
import type {
  DensityEvaluationContext,
  DensityEvaluationSession,
  DensityFunction,
  DensityPosition,
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

export const CLIMATE_PARAMETER_COUNT = 6
export const CLIMATE_HYPERCUBE_DIMENSION = CLIMATE_PARAMETER_COUNT
export const CLIMATE_QUANTIZATION_FACTOR = 10_000

const CLIMATE_LIST_ENTRY_LENGTH = 2
const CLIMATE_FIRST_ENTRY_INDEX = 0
const CLIMATE_SECOND_ENTRY_INDEX = 1
const CLIMATE_INDEX_INCREMENT = 1
const CLIMATE_ZERO_DISTANCE = 0
const CLIMATE_NO_INDEX = -1
const CLIMATE_NON_NEGATIVE_BOUNDARY = 0
const CLIMATE_ZERO_STEP = 0
const CLIMATE_DEFAULT_ORIGIN_COMPONENT = 0
const CLIMATE_DEFAULT_RADIUS = 16
const CLIMATE_DEFAULT_VERTICAL_RADIUS = 8
const CLIMATE_DEFAULT_STEP = 1
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
  readonly min: number
  readonly max: number
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
  readonly offset: number
}>

export type ClimateTargetPoint = Readonly<{
  readonly temperature: number
  readonly humidity: number
  readonly continentalness: number
  readonly erosion: number
  readonly depth: number
  readonly weirdness: number
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
  readonly origin?: Position
  readonly radius?: number
  readonly verticalRadius?: number
  readonly step?: number
  readonly context?: DensityEvaluationContext | DensityEvaluationSession
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
  offset: number,
]

type ClimateParameterValues = ClimateSixValues<unknown>
type ClimateParameterInputValues = ClimateSixValues<number | ClimateParameter>
type ClimateTargetValues = ClimateSixValues<number>

const isObject = (value: unknown): value is object =>
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

const readNumber = (name: string, value: unknown): number => {
  if (typeof value !== 'number') {
    throw new TypeError(`${name} must be a number`)
  }
  return value
}

const readQuantized = (name: string, value: unknown): number =>
  requireSafeInteger(name, readNumber(name, value))

const readFinite = (name: string, value: number): number =>
  requireFiniteNumber(name, value)

const isQuantized = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value)

export const quantizeCoord = (value: number): number =>
  requireSafeInteger(
    'coordinate',
    Math.trunc(readFinite('coordinate', value) * CLIMATE_QUANTIZATION_FACTOR),
  )

export const unquantizeCoord = (value: number): number =>
  readQuantized('quantized coordinate', value) / CLIMATE_QUANTIZATION_FACTOR

const createParameterFromQuantized = (
  min: number,
  max: number,
): ClimateParameter => {
  const normalizedMin = readQuantized('parameter min', min)
  const normalizedMax = readQuantized('parameter max', max)
  if (normalizedMin > normalizedMax) {
    throw new RangeError('parameter min must be less than or equal to max')
  }
  return Object.freeze({ max: normalizedMax, min: normalizedMin })
}

export const createClimateParameterFromQuantized = createParameterFromQuantized

export const climateParameter = (point: number): ClimateParameter => {
  const quantized = quantizeCoord(point)
  return createParameterFromQuantized(quantized, quantized)
}

export const climateParameterRange = (
  min: number,
  max: number,
): ClimateParameter =>
  createParameterFromQuantized(quantizeCoord(min), quantizeCoord(max))

export const isClimateParameter = (
  value: unknown,
): value is ClimateParameter => {
  if (!isObject(value)) {
    return false
  }
  const candidate = value as { readonly min?: unknown; readonly max?: unknown }
  if (typeof candidate.min !== 'number' || typeof candidate.max !== 'number') {
    return false
  }
  if (!Number.isSafeInteger(candidate.min) || !Number.isSafeInteger(candidate.max)) {
    return false
  }
  return candidate.min <= candidate.max
}

export const requireClimateParameter = (
  name: string,
  value: unknown,
): ClimateParameter => {
  if (!isClimateParameter(value)) {
    throw new TypeError(`${name} must be a ClimateParameter`)
  }
  return createParameterFromQuantized(value.min, value.max)
}

export function climateParameterSpan(
  min: number,
  max: number,
): ClimateParameter
export function climateParameterSpan(
  min: ClimateParameter,
  max: ClimateParameter,
): ClimateParameter
export function climateParameterSpan(
  min: number | ClimateParameter,
  max: number | ClimateParameter,
): ClimateParameter {
  if (typeof min === 'number' && typeof max === 'number') {
    return climateParameterRange(min, max)
  }
  if (typeof min === 'object' && typeof max === 'object') {
    return createParameterFromQuantized(
      requireClimateParameter('span min', min).min,
      requireClimateParameter('span max', max).max,
    )
  }
  throw new TypeError('span bounds must both be numbers or ClimateParameters')
}

export const point = climateParameter
export const span = climateParameterSpan

const normalizeParameter = (
  name: string,
  value: unknown,
): ClimateParameter => {
  if (typeof value === 'number') {
    return climateParameter(value)
  }
  return requireClimateParameter(name, value)
}

const createParameterSpace = (
  ...values: ClimateParameterValues
): ClimateParameterSpace => {
  const [temperature, humidity, continentalness, erosion, depth, weirdness] =
    values
  return Object.freeze({
    continentalness: normalizeParameter(
      'continentalness',
      continentalness,
    ),
    depth: normalizeParameter('depth', depth),
    erosion: normalizeParameter('erosion', erosion),
    humidity: normalizeParameter('humidity', humidity),
    temperature: normalizeParameter('temperature', temperature),
    weirdness: normalizeParameter('weirdness', weirdness),
  })
}

const readParameterSpace = (
  name: string,
  value: unknown,
): ClimateParameterSpace => {
  if (!isObject(value)) {
    throw new TypeError(`${name} must be an object`)
  }
  const candidate = value as Partial<Record<ClimateChannel, unknown>>
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
): ClimateParameterSpace => createParameterSpace(...values)

export const createClimateParameterPointFromQuantized = (
  parameters: ClimateParameterSpace,
  offset: number,
): ClimateParameterPoint =>
  Object.freeze({
    ...readParameterSpace('parameters', parameters),
    offset: readQuantized('offset', offset),
  })

export const isClimateParameterPoint = (
  value: unknown,
): value is ClimateParameterPoint => {
  if (!isObject(value)) {
    return false
  }
  const candidate = value as Partial<ClimateParameterPoint>
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
  name: string,
  value: unknown,
): ClimateParameterPoint => {
  if (!isClimateParameterPoint(value)) {
    throw new TypeError(`${name} must be a ClimateParameterPoint`)
  }
  return createClimateParameterPointFromQuantized(
    value,
    value.offset,
  )
}

export function climateParameters(
  ...values: ClimateParameterArguments<number>
): ClimateParameterPoint
export function climateParameters(
  ...values: ClimateParameterArguments<ClimateParameter>
): ClimateParameterPoint
export function climateParameters(
  ...values: ClimateParameterArguments<number | ClimateParameter>
): ClimateParameterPoint {
  const [
    temperature,
    humidity,
    continentalness,
    erosion,
    depth,
    weirdness,
    offset,
  ] = values
  const parameters = createParameterSpace(
    temperature,
    humidity,
    continentalness,
    erosion,
    depth,
    weirdness,
  )
  return createClimateParameterPointFromQuantized(parameters, quantizeCoord(offset))
}

export const parameters = climateParameters
export const parameterPoint = climateParameters

export const createClimateTargetPointFromQuantized = (
  ...values: ClimateTargetValues
): ClimateTargetPoint => {
  const [temperature, humidity, continentalness, erosion, depth, weirdness] =
    values
  return Object.freeze({
    continentalness: readQuantized('continentalness', continentalness),
    depth: readQuantized('depth', depth),
    erosion: readQuantized('erosion', erosion),
    humidity: readQuantized('humidity', humidity),
    temperature: readQuantized('temperature', temperature),
    weirdness: readQuantized('weirdness', weirdness),
  })
}

export const climateTarget = (
  ...values: ClimateTargetValues
): ClimateTargetPoint => {
  const [temperature, humidity, continentalness, erosion, depth, weirdness] =
    values
  return createClimateTargetPointFromQuantized(
    quantizeCoord(temperature),
    quantizeCoord(humidity),
    quantizeCoord(continentalness),
    quantizeCoord(erosion),
    quantizeCoord(depth),
    quantizeCoord(weirdness),
  )
}

export const target = climateTarget

const readTargetPoint = (
  name: string,
  value: unknown,
): ClimateTargetPoint => {
  if (!isObject(value)) {
    throw new TypeError(`${name} must be an object`)
  }
  const candidate = value as Partial<ClimateTargetPoint>
  return createClimateTargetPointFromQuantized(
    readQuantized(`${name}.temperature`, candidate.temperature),
    readQuantized(`${name}.humidity`, candidate.humidity),
    readQuantized(`${name}.continentalness`, candidate.continentalness),
    readQuantized(`${name}.erosion`, candidate.erosion),
    readQuantized(`${name}.depth`, candidate.depth),
    readQuantized(`${name}.weirdness`, candidate.weirdness),
  )
}

export const isClimateTargetPoint = (
  value: unknown,
): value is ClimateTargetPoint => {
  if (!isObject(value)) {
    return false
  }
  const candidate = value as Partial<ClimateTargetPoint>
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

export const climateParameterDistance = (
  parameter: ClimateParameter,
  targetValue: number,
): number =>
  distance(
    requireClimateParameter('parameter', parameter),
    readQuantized('target', targetValue),
  )

export const climateParameterSpace = (
  pointValue: ClimateParameterPoint,
): ClimateParameterSpace => {
  const normalizedPoint = requireClimateParameterPoint('point', pointValue)
  return Object.freeze({
    continentalness: normalizedPoint.continentalness,
    depth: normalizedPoint.depth,
    erosion: normalizedPoint.erosion,
    humidity: normalizedPoint.humidity,
    temperature: normalizedPoint.temperature,
    weirdness: normalizedPoint.weirdness,
  })
}

const calculateClimateParameterPointFitness = (
  parameterValue: ClimateParameterPoint,
  targetValue: ClimateTargetPoint,
): number =>
  distance(parameterValue.temperature, targetValue.temperature) +
  distance(parameterValue.humidity, targetValue.humidity) +
  distance(parameterValue.continentalness, targetValue.continentalness) +
  distance(parameterValue.erosion, targetValue.erosion) +
  distance(parameterValue.depth, targetValue.depth) +
  distance(parameterValue.weirdness, targetValue.weirdness) +
  Math.abs(parameterValue.offset)

export const climateParameterPointFitness = (
  pointValue: ClimateParameterPoint,
  targetValue: ClimateTargetPoint,
): number => {
  const normalizedPoint = requireClimateParameterPoint('point', pointValue)
  const normalizedTarget = readTargetPoint('target', targetValue)
  return calculateClimateParameterPointFitness(
    normalizedPoint,
    normalizedTarget,
  )
}

const normalizeListEntry = <Value>(
  entry: ClimateParameterListEntry<Value>,
  entryIndex: number,
): ClimateParameterListEntry<Value> => {
  if (!Array.isArray(entry) || entry.length !== CLIMATE_LIST_ENTRY_LENGTH) {
    throw new TypeError(
      `entries[${entryIndex}] must be a [point, value] tuple`,
    )
  }
  return Object.freeze([
    requireClimateParameterPoint(
      `entries[${entryIndex}][${CLIMATE_FIRST_ENTRY_INDEX}]`,
      entry[CLIMATE_FIRST_ENTRY_INDEX],
    ),
    entry[CLIMATE_SECOND_ENTRY_INDEX],
  ]) as ClimateParameterListEntry<Value>
}

export const createClimateParameterList = <Value>(
  entries: readonly ClimateParameterListEntry<Value>[],
): ClimateParameterList<Value> => {
  if (!Array.isArray(entries)) {
    throw new TypeError('entries must be an array')
  }
  const normalizedEntries = Object.freeze(
    entries.map((entry, entryIndex) =>
      normalizeListEntry<Value>(entry, entryIndex),
    ),
  )
  return Object.freeze({
    entries: normalizedEntries,
    tree: createClimateRTree(
      normalizedEntries,
      calculateClimateParameterPointFitness,
    ),
  })
}

export const requireClimateParameterList = <Value>(
  value: unknown,
): ClimateParameterList<Value> => {
  if (!isObject(value)) {
    throw new TypeError('parameter list must be an object')
  }
  const { entries } = value as { readonly entries?: unknown }
  if (!Array.isArray(entries)) {
    throw new TypeError('parameter list.entries must be an array')
  }
  return createClimateParameterList(
    entries as readonly ClimateParameterListEntry<Value>[],
  )
}

export const findClimateValueIndex = <Value>(
  listValue: ClimateParameterList<Value>,
  targetValue: ClimateTargetPoint,
): number | undefined => {
  const list = requireClimateParameterList<Value>(listValue)
  const targetPoint = readTargetPoint('target', targetValue)
  return list.tree.searchIndex(targetPoint)
}

export const findClimateValue = <Value>(
  listValue: ClimateParameterList<Value>,
  targetValue: ClimateTargetPoint,
): Value | undefined => {
  const list = requireClimateParameterList<Value>(listValue)
  return list.tree.search(readTargetPoint('target', targetValue))
}

const findClimateValueIndexBruteForce = <Value>(
  list: ClimateParameterList<Value>,
  targetPoint: ClimateTargetPoint,
): number | undefined => {
  let bestIndex = CLIMATE_NO_INDEX
  let bestFitness = Number.POSITIVE_INFINITY
  for (
    let entryIndex = CLIMATE_FIRST_ENTRY_INDEX;
    entryIndex < list.entries.length;
    entryIndex += CLIMATE_INDEX_INCREMENT
  ) {
    const fitness = calculateClimateParameterPointFitness(
      list.entries[entryIndex]![CLIMATE_FIRST_ENTRY_INDEX],
      targetPoint,
    )
    if (bestIndex === CLIMATE_NO_INDEX || fitness < bestFitness) {
      bestFitness = fitness
      bestIndex = entryIndex
    }
  }
  if (bestIndex === CLIMATE_NO_INDEX) {
    return
  }
  return bestIndex
}

export const findClimateValueBruteForce = <Value>(
  listValue: ClimateParameterList<Value>,
  targetValue: ClimateTargetPoint,
): Value | undefined => {
  const list = requireClimateParameterList<Value>(listValue)
  const index = findClimateValueIndexBruteForce(
    list,
    readTargetPoint('target', targetValue),
  )
  if (typeof index === 'undefined') {
    return
  }
  return list.entries[index]![CLIMATE_SECOND_ENTRY_INDEX]
}

const readSamplerFields = (value: unknown): ClimateSampler => {
  if (!isObject(value)) {
    throw new TypeError('sampler must be an object')
  }
  const candidate = value as Partial<ClimateSampler> & {
    readonly spawnTarget?: unknown
  }
  const spawnTarget = defaultIfUndefined(candidate.spawnTarget, [])
  if (!Array.isArray(spawnTarget)) {
    throw new TypeError('sampler.spawnTarget must be an array')
  }
  return Object.freeze({
    continentalness: requireDensityFunction(
      'sampler.continentalness',
      candidate.continentalness,
    ),
    depth: requireDensityFunction('sampler.depth', candidate.depth),
    erosion: requireDensityFunction('sampler.erosion', candidate.erosion),
    humidity: requireDensityFunction('sampler.humidity', candidate.humidity),
    spawnTarget: Object.freeze(
      spawnTarget.map((pointValue, entryIndex) =>
        requireClimateParameterPoint(
          `sampler.spawnTarget[${entryIndex}]`,
          pointValue,
        ),
      ),
    ),
    temperature: requireDensityFunction('sampler.temperature', candidate.temperature),
    weirdness: requireDensityFunction('sampler.weirdness', candidate.weirdness),
  })
}

export const createClimateSampler = (
  options: ClimateSamplerOptions,
): ClimateSampler => readSamplerFields(options)

export const empty = (): ClimateSampler =>
  createClimateSampler({
    continentalness: densityZero,
    depth: densityZero,
    erosion: densityZero,
    humidity: densityZero,
    temperature: densityZero,
    weirdness: densityZero,
  })

export const requireClimateSampler = (value: unknown): ClimateSampler =>
  readSamplerFields(value)

export const isClimateSampler = (value: unknown): value is ClimateSampler => {
  if (!isObject(value)) {
    return false
  }
  const candidate = value as Partial<ClimateSampler>
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
  typeof (value as { readonly evaluate?: unknown }).evaluate === 'function'

const resolveEvaluator = (
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): (density: DensityFunction, position: DensityPosition) => number => {
  if (typeof contextOrSession === 'undefined') {
    return evaluateDensityFunction
  }
  if (isDensityEvaluationSession(contextOrSession)) {
    return contextOrSession.evaluate
  }
  return createDensityEvaluationSession(contextOrSession).evaluate
}

const sampleWithEvaluator = (
  sampler: ClimateSampler,
  position: DensityPosition,
  evaluate: (density: DensityFunction, position: DensityPosition) => number,
): ClimateTargetPoint =>
  climateTarget(
    evaluate(sampler.temperature, position),
    evaluate(sampler.humidity, position),
    evaluate(sampler.continentalness, position),
    evaluate(sampler.erosion, position),
    evaluate(sampler.depth, position),
    evaluate(sampler.weirdness, position),
  )

export const sampleClimate = (
  samplerValue: ClimateSampler,
  position: DensityPosition,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): ClimateTargetPoint => {
  const sampler = requireClimateSampler(samplerValue)
  return sampleWithEvaluator(sampler, position, resolveEvaluator(contextOrSession))
}

export const sampleClimateAt = (
  samplerValue: ClimateSampler,
  ...coordinates: readonly [
    x: number,
    y: number,
    z: number,
    contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
  ]
): ClimateTargetPoint => {
  const [x, y, z, contextOrSession] = coordinates
  return sampleClimate(
    samplerValue,
    blockPosition(
      requireSafeInteger('x', x),
      requireSafeInteger('y', y),
      requireSafeInteger('z', z),
    ),
    contextOrSession,
  )
}

const readSafeInteger = (name: string, value: unknown): number =>
  requireSafeInteger(name, readNumber(name, value))

const readNonNegativeInteger = (name: string, value: unknown): number => {
  const normalized = readSafeInteger(name, value)
  if (normalized < CLIMATE_NON_NEGATIVE_BOUNDARY) {
    throw new RangeError(`${name} must be non-negative`)
  }
  return normalized
}

type NormalizedClimateSpawnSearch = Readonly<{
  readonly origin: Position
  readonly radius: number
  readonly verticalRadius: number
  readonly step: number
  readonly context?: DensityEvaluationContext | DensityEvaluationSession
}>

type ClimateSpawnCandidate = Readonly<{
  readonly fitness: number
  readonly position: BlockPosition
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
  ) => number
  readonly sampler: ClimateSampler
  readonly search: NormalizedClimateSpawnSearch
  readonly targets: readonly ClimateParameterPoint[]
}>

const createDefaultOrigin = (): Position =>
  Object.freeze({
    x: CLIMATE_DEFAULT_ORIGIN_COMPONENT,
    y: CLIMATE_DEFAULT_ORIGIN_COMPONENT,
    z: CLIMATE_DEFAULT_ORIGIN_COMPONENT,
  })

const createSearchContext = (
  context?: DensityEvaluationContext | DensityEvaluationSession,
): Pick<NormalizedClimateSpawnSearch, 'context'> => {
  if (typeof context === 'undefined') {
    return Object.freeze({})
  }
  return Object.freeze({ context })
}

const readOrigin = (value: unknown): Position => {
  if (!isObject(value)) {
    throw new TypeError('origin must be an object')
  }
  const candidate = value as Partial<Position>
  return Object.freeze({
    x: readSafeInteger('origin.x', candidate.x),
    y: readSafeInteger('origin.y', candidate.y),
    z: readSafeInteger('origin.z', candidate.z),
  })
}

const readSearchOptions = (
  value: ClimateSpawnSearchOptions,
): NormalizedClimateSpawnSearch => {
  if (value === null || typeof value !== 'object') {
    throw new TypeError('search options must be an object')
  }
  const options = value as ClimateSpawnSearchOptions
  const origin = defaultIfUndefined(options.origin, createDefaultOrigin())
  const radius = readNonNegativeInteger(
    'radius',
    defaultIfUndefined(options.radius, CLIMATE_DEFAULT_RADIUS),
  )
  const verticalRadius = readNonNegativeInteger(
    'verticalRadius',
    defaultIfUndefined(options.verticalRadius, CLIMATE_DEFAULT_VERTICAL_RADIUS),
  )
  const step = readNonNegativeInteger(
    'step',
    defaultIfUndefined(options.step, CLIMATE_DEFAULT_STEP),
  )
  if (step === CLIMATE_ZERO_STEP) {
    throw new RangeError('step must be positive')
  }
  return Object.freeze({
    ...createSearchContext(options.context),
    origin: readOrigin(origin),
    radius,
    step,
    verticalRadius,
  })
}

const normalizeClimateTargets = (
  sampler: ClimateSampler,
  targets?: readonly ClimateParameterPoint[],
): readonly ClimateParameterPoint[] => {
  if (typeof targets === 'undefined') {
    return sampler.spawnTarget
  }
  return targets.map((targetValue, index) =>
    requireClimateParameterPoint(`targets[${index}]`, targetValue),
  )
}

const calculateBestTargetFitness = (
  targets: readonly ClimateParameterPoint[],
  sampled: ClimateTargetPoint,
): number => {
  let bestFitness = Number.POSITIVE_INFINITY
  for (const targetValue of targets) {
    bestFitness = Math.min(
      bestFitness,
      climateParameterPointFitness(targetValue, sampled),
    )
  }
  return bestFitness
}

const createClimateSpawnCandidate = (
  options: ClimateSpawnCandidateOptions,
  offset: ClimateSpawnOffset,
): ClimateSpawnCandidate => {
  const position = blockPosition(
    options.search.origin.x + offset.x,
    options.search.origin.y + offset.y,
    options.search.origin.z + offset.z,
  )
  const sampled = sampleWithEvaluator(
    options.sampler,
    position,
    options.evaluate,
  )
  return Object.freeze({
    fitness: calculateBestTargetFitness(options.targets, sampled),
    position,
  })
}

const findBestClimateSpawnPosition = (
  candidateOptions: ClimateSpawnCandidateOptions,
): BlockPosition | undefined => {
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
        const candidate = createClimateSpawnCandidate(candidateOptions, {
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
  return (bestCandidate as ClimateSpawnCandidate).position
}

export const findClimateSpawnPosition = (
  samplerValue: ClimateSampler,
  targets?: readonly ClimateParameterPoint[],
  options: ClimateSpawnSearchOptions = {},
): BlockPosition | undefined => {
  const sampler = requireClimateSampler(samplerValue)
  const search = readSearchOptions(options)
  const targetValues = normalizeClimateTargets(sampler, targets)
  if (targetValues.length === CLIMATE_EMPTY_TARGET_COUNT) {
    return
  }
  return findBestClimateSpawnPosition(
    Object.freeze({
      evaluate: resolveEvaluator(search.context),
      sampler,
      search,
      targets: targetValues,
    }),
  )
}

export const findSpawnPosition = (
  targets: readonly ClimateParameterPoint[],
  samplerValue: ClimateSampler,
  options?: ClimateSpawnSearchOptions,
): BlockPosition | undefined => findClimateSpawnPosition(samplerValue, targets, options)

export type ClimateSamplerRuntime = ClimateSampler & Readonly<{
  readonly sample: (
    x: number,
    y: number,
    z: number,
    contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
  ) => ClimateTargetPoint
  readonly findSpawnPosition: (
    options?: ClimateSpawnSearchOptions,
  ) => BlockPosition | undefined
}>

export const createClimateSamplerRuntime = (
  samplerValue: ClimateSampler,
): ClimateSamplerRuntime => {
  const sampler = requireClimateSampler(samplerValue)
  return Object.freeze({
    ...sampler,
    findSpawnPosition: (
      options?: ClimateSpawnSearchOptions,
    ): BlockPosition | undefined =>
      findClimateSpawnPosition(sampler, sampler.spawnTarget, options),
    sample: (
      x: number,
      y: number,
      z: number,
      contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
    ): ClimateTargetPoint =>
      sampleClimateAt(sampler, x, y, z, contextOrSession),
  })
}
