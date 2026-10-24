import {
  ClimateFieldName,
  ClimateFitness,
  type ClimateFitness as ClimateFitnessValue,
  ClimateListIndex,
  type ClimateListIndex as ClimateListIndexValue,
  type ClimateParameterListEntry,
  type ClimateParameterPoint,
  type ClimateTargetPoint,
  isClimateTargetPoint,
  requireClimateParameterPoint,
} from './climate.js'
import { DefinedValueName, requireDefined } from './defined.js'
import { Option, Result } from 'effect'

const CLIMATE_DIMENSIONS = [
  'temperature',
  'humidity',
  'continentalness',
  'erosion',
  'depth',
  'weirdness',
] as const
const EMPTY_ENTRY_COUNT = 0
const FIRST_ENTRY_INDEX = 0
const INDEX_INCREMENT = 1
const MIDPOINT_DIVISOR = 2
const SECOND_ENTRY_INDEX = 1
const SINGLE_ENTRY_COUNT = 1
const CLIMATE_LIST_ENTRY_LENGTH = 2
const TARGET_OFFSET = 0
const ZERO_DISTANCE = 0

type ClimateDimension = typeof CLIMATE_DIMENSIONS[number]

type IndexedEntry<Value> = Readonly<{
  readonly index: ClimateListIndexValue
  readonly point: ClimateParameterPoint
  readonly value: Value
}>

type Bounds = Readonly<{
  readonly lower: readonly number[]
  readonly upper: readonly number[]
  readonly offsetLower: number
  readonly offsetUpper: number
}>

type MutableBounds = {
  lower: number[]
  offsetLower: number
  offsetUpper: number
  upper: number[]
}

type Leaf<Value> = Readonly<{
  readonly kind: 'leaf'
  readonly bounds: Bounds
  readonly entry: IndexedEntry<Value>
}>

type Branch<Value> = Readonly<{
  readonly kind: 'branch'
  readonly bounds: Bounds
  readonly left: Node<Value>
  readonly right: Node<Value>
}>

type Node<Value> = Leaf<Value> | Branch<Value>

type SearchMatch<Value> = Readonly<{
  readonly entry: IndexedEntry<Value>
  readonly fitness: ClimateFitnessValue
}>

type SearchState<Value> = {
  best: SearchMatch<Value> | null
}

export type ClimateRTreeFitness = (
  point: ClimateParameterPoint,
  target: ClimateTargetPoint,
) => Result.Result<ClimateFitnessValue, TypeError | RangeError>

export type ClimateRTree<Value> = Readonly<{
  readonly search: (
    target: ClimateTargetPoint,
  ) => Result.Result<Option.Option<Value>, TypeError | RangeError>
  readonly searchIndex: (
    target: ClimateTargetPoint,
  ) => Result.Result<Option.Option<ClimateListIndexValue>, TypeError | RangeError>
}>

const pointCoordinate = (
  point: ClimateParameterPoint,
  dimension: ClimateDimension,
): Readonly<{ readonly lower: number; readonly upper: number }> => ({
  lower: point[dimension].min,
  upper: point[dimension].max,
})

const createMutableBounds = <Value>(
  entry: IndexedEntry<Value>,
): MutableBounds => {
  const { point } = entry
  return {
    lower: CLIMATE_DIMENSIONS.map(
      (dimension) => pointCoordinate(point, dimension).lower,
    ),
    offsetLower: point.offset,
    offsetUpper: point.offset,
    upper: CLIMATE_DIMENSIONS.map(
      (dimension) => pointCoordinate(point, dimension).upper,
    ),
  }
}

const mergeBounds = <Value>(
  bounds: MutableBounds,
  entry: IndexedEntry<Value>,
): Result.Result<void, RangeError> =>
  Result.gen(function* resultGenerator() {
    for (
      let index = FIRST_ENTRY_INDEX;
      index < CLIMATE_DIMENSIONS.length;
      index += INDEX_INCREMENT
    ) {
      const dimension = yield* requireDefined(CLIMATE_DIMENSIONS[index], DefinedValueName('climate dimension'))
      const coordinate = pointCoordinate(entry.point, dimension)
      const lower = yield* requireDefined(bounds.lower[index], DefinedValueName('lower bound'))
      const upper = yield* requireDefined(bounds.upper[index], DefinedValueName('upper bound'))
      bounds.lower[index] = Math.min(lower, coordinate.lower)
      bounds.upper[index] = Math.max(upper, coordinate.upper)
    }
    bounds.offsetLower = Math.min(bounds.offsetLower, entry.point.offset)
    bounds.offsetUpper = Math.max(bounds.offsetUpper, entry.point.offset)
  })

const freezeBounds = (bounds: MutableBounds): Bounds =>
  Object.freeze({
    lower: Object.freeze(bounds.lower),
    offsetLower: bounds.offsetLower,
    offsetUpper: bounds.offsetUpper,
    upper: Object.freeze(bounds.upper),
  })

const createBounds = <Value>(
  entries: readonly IndexedEntry<Value>[],
): Result.Result<Bounds, RangeError> =>
  Result.gen(function* resultGenerator() {
    const first = yield* requireDefined(entries[FIRST_ENTRY_INDEX], DefinedValueName('climate entry'))
    const bounds = createMutableBounds(first)
    for (const entry of entries.slice(SECOND_ENTRY_INDEX)) {
      yield* mergeBounds(bounds, entry)
    }
    return freezeBounds(bounds)
  })

const midpoint = (
  entry: IndexedEntry<unknown>,
  axis: number,
): Result.Result<number, RangeError> =>
  Result.gen(function* resultGenerator() {
    const dimension = yield* requireDefined(CLIMATE_DIMENSIONS[axis], DefinedValueName('climate dimension'))
    const coordinate = pointCoordinate(entry.point, dimension)
    return (coordinate.lower + coordinate.upper) / MIDPOINT_DIVISOR
  })

const axisSpan = (
  bounds: Bounds,
  axis: number,
): Result.Result<number, RangeError> =>
  Result.gen(function* resultGenerator() {
    const upper = yield* requireDefined(bounds.upper[axis], DefinedValueName('upper bound'))
    const lower = yield* requireDefined(bounds.lower[axis], DefinedValueName('lower bound'))
    return upper - lower
  })

const splitAxis = (bounds: Bounds): Result.Result<number, RangeError> =>
  Result.gen(function* resultGenerator() {
    let axis = FIRST_ENTRY_INDEX
    let largestSpan = yield* axisSpan(bounds, axis)
    for (
      let index = SECOND_ENTRY_INDEX;
      index < CLIMATE_DIMENSIONS.length;
      index += INDEX_INCREMENT
    ) {
      const span = yield* axisSpan(bounds, index)
      if (span > largestSpan) {
        axis = index
        largestSpan = span
      }
    }
    return axis
  })

const partitionEntries = <Value>(
  entries: readonly IndexedEntry<Value>[],
  axis: number,
): Result.Result<Readonly<{ left: readonly IndexedEntry<Value>[]; right: readonly IndexedEntry<Value>[] }>, RangeError> =>
  Result.gen(function* resultGenerator() {
    const keyedEntries: Array<Readonly<{ entry: IndexedEntry<Value>; midpoint: number }>> = []
    for (const entry of entries) {
      keyedEntries.push({
        entry,
        midpoint: yield* midpoint(entry, axis),
      })
    }
    keyedEntries.sort((left, right) => {
      const midpointDifference = left.midpoint - right.midpoint
      if (midpointDifference !== ZERO_DISTANCE) {
        return midpointDifference
      }
      return left.entry.index - right.entry.index
    })
    const ordered = keyedEntries.map(({ entry }) => entry)
    const splitIndex = Math.floor(ordered.length / MIDPOINT_DIVISOR)
    return Object.freeze({
      left: ordered.slice(FIRST_ENTRY_INDEX, splitIndex),
      right: ordered.slice(splitIndex),
    })
  })

const buildTree = <Value>(
  entries: readonly IndexedEntry<Value>[],
): Result.Result<Node<Value>, RangeError> =>
  Result.gen(function* resultGenerator() {
    const bounds = yield* createBounds(entries)
    if (entries.length === SINGLE_ENTRY_COUNT) {
      return Object.freeze({
        bounds,
        entry: yield* requireDefined(entries[FIRST_ENTRY_INDEX], DefinedValueName('climate entry')),
        kind: 'leaf' as const,
      })
    }
    const axis = yield* splitAxis(bounds)
    const partition = yield* partitionEntries(entries, axis)
    const left = yield* buildTree(partition.left)
    const right = yield* buildTree(partition.right)
    return Object.freeze({
      bounds,
      kind: 'branch' as const,
      left,
      right,
    })
  })

const distanceToInterval = (
  lower: number,
  upper: number,
  value: number,
): number => {
  if (value < lower) {
    return lower - value
  }
  if (value > upper) {
    return value - upper
  }
  return ZERO_DISTANCE
}

const lowerBound = (
  bounds: Bounds,
  target: ClimateTargetPoint,
): Result.Result<number, RangeError> =>
  Result.gen(function* resultGenerator() {
    const firstLower = yield* requireDefined(bounds.lower[FIRST_ENTRY_INDEX], DefinedValueName('lower bound'))
    const firstUpper = yield* requireDefined(bounds.upper[FIRST_ENTRY_INDEX], DefinedValueName('upper bound'))
    let result = distanceToInterval(firstLower, firstUpper, target.temperature)
    for (
      let index = SECOND_ENTRY_INDEX;
      index < CLIMATE_DIMENSIONS.length;
      index += INDEX_INCREMENT
    ) {
      const dimension = yield* requireDefined(CLIMATE_DIMENSIONS[index], DefinedValueName('climate dimension'))
      const lower = yield* requireDefined(bounds.lower[index], DefinedValueName('lower bound'))
      const upper = yield* requireDefined(bounds.upper[index], DefinedValueName('upper bound'))
      result += distanceToInterval(lower, upper, target[dimension])
    }
    return result + distanceToInterval(
      bounds.offsetLower,
      bounds.offsetUpper,
      TARGET_OFFSET,
    )
  })

const isBetterMatch = <Value>(
  candidate: SearchMatch<Value>,
  current: SearchMatch<Value> | null,
): boolean => {
  if (current === null) {
    return true
  }
  if (candidate.fitness < current.fitness) {
    return true
  }
  return candidate.fitness === current.fitness &&
    candidate.entry.index < current.entry.index
}

const readFitness = (
  value: unknown,
): Result.Result<ClimateFitnessValue, TypeError | RangeError> => {
  if (!Result.isResult(value)) {
    return Result.fail(new TypeError('RTree fitness must return a Result'))
  }
  if (Result.isFailure(value)) {
    if (value.failure instanceof TypeError || value.failure instanceof RangeError) {
      return Result.fail(value.failure)
    }
    return Result.fail(new TypeError('RTree fitness returned an invalid error'))
  }
  if (typeof value.success !== 'number') {
    return Result.fail(new TypeError('RTree fitness must return a number'))
  }
  return Result.mapError(
    ClimateFitness.result(value.success),
    (error) => new RangeError(error.message),
  )
}

const readTarget = (
  value: unknown,
): Result.Result<ClimateTargetPoint, TypeError> => {
  if (!isClimateTargetPoint(value)) {
    return Result.fail(new TypeError('RTree target must be a ClimateTargetPoint'))
  }
  return Result.succeed(value)
}

const visitLeaf = <Value>(
  node: Leaf<Value>,
  target: ClimateTargetPoint,
  fitness: ClimateRTreeFitness,
  state: SearchState<Value>,
): Result.Result<void, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const value = yield* readFitness(fitness(node.entry.point, target))
    const candidate: SearchMatch<Value> = {
      entry: node.entry,
      fitness: value,
    }
    if (isBetterMatch(candidate, state.best)) {
      state.best = candidate
    }
  })

const visitChildren = <Value>(
  node: Branch<Value>,
  target: ClimateTargetPoint,
  visit: (child: Node<Value>) => Result.Result<void, TypeError | RangeError>,
): Result.Result<void, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const leftDistance = yield* lowerBound(node.left.bounds, target)
    const rightDistance = yield* lowerBound(node.right.bounds, target)
    if (leftDistance <= rightDistance) {
      yield* visit(node.left)
      yield* visit(node.right)
      return
    }
    yield* visit(node.right)
    yield* visit(node.left)
  })

const visitNode = <Value>(
  node: Node<Value>,
  target: ClimateTargetPoint,
  fitness: ClimateRTreeFitness,
  state: SearchState<Value>,
): Result.Result<void, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const nodeDistance = yield* lowerBound(node.bounds, target)
    if (state.best !== null && nodeDistance > state.best.fitness) {
      return
    }
    if (node.kind === 'leaf') {
      yield* visitLeaf(node, target, fitness, state)
      return
    }
    yield* visitChildren(node, target, (child) =>
      visitNode(child, target, fitness, state),
    )
  })

const createSearch = <Value>(
  root: Node<Value> | null,
  fitness: ClimateRTreeFitness,
): ((
  target: ClimateTargetPoint,
) => Result.Result<Option.Option<SearchMatch<Value>>, TypeError | RangeError>) => (
  target,
) =>
  Result.gen(function* resultGenerator() {
    const normalizedTarget = yield* readTarget(target)
    if (root === null) {
      return Option.none()
    }
    const state: SearchState<Value> = { best: null }
    yield* visitNode(root, normalizedTarget, fitness, state)
    // A non-null tree contains a leaf, so every successful visit sets a match.
    return Option.fromNullishOr(state.best)
  })

const matchIndex = <Value>(
  match: Option.Option<SearchMatch<Value>>,
): Option.Option<ClimateListIndexValue> =>
  Option.map(match, ({ entry }) => entry.index)

const matchValue = <Value>(
  match: Option.Option<SearchMatch<Value>>,
): Option.Option<Value> =>
  Option.map(match, ({ entry }) => entry.value)

const createRoot = <Value>(
  entries: readonly IndexedEntry<Value>[],
): Result.Result<Node<Value> | null, RangeError> => {
  if (entries.length === EMPTY_ENTRY_COUNT) {
    return Result.succeed(null)
  }
  return buildTree(entries)
}

const validateRTreeInputs = <Value>(
  entries: readonly ClimateParameterListEntry<Value>[],
  fitness: ClimateRTreeFitness,
): Result.Result<boolean, TypeError> => {
  if (!Array.isArray(entries)) {
    return Result.fail(new TypeError('RTree entries must be an array'))
  }
  if (typeof fitness !== 'function') {
    return Result.fail(new TypeError('RTree fitness must be a function'))
  }
  return Result.succeed(true)
}

const createIndexedEntries = <Value>(
  entries: readonly ClimateParameterListEntry<Value>[],
): Result.Result<readonly IndexedEntry<Value>[], TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    const indexedEntries: IndexedEntry<Value>[] = []
    for (let index = FIRST_ENTRY_INDEX; index < entries.length; index += INDEX_INCREMENT) {
      const entry = yield* requireDefined(entries[index], DefinedValueName('climate entry'))
      if (!Array.isArray(entry) || entry.length !== CLIMATE_LIST_ENTRY_LENGTH) {
        return yield* Result.fail(
          new TypeError(`entries[${index}] must be a [point, value] tuple`),
        )
      }
      const point = yield* requireClimateParameterPoint(
        ClimateFieldName(`entries[${index}][${FIRST_ENTRY_INDEX}]`),
        entry[FIRST_ENTRY_INDEX],
      )
      indexedEntries.push(
        Object.freeze({
          index: ClimateListIndex(index),
          point,
          value: entry[SECOND_ENTRY_INDEX],
        }),
      )
    }
    return Object.freeze(indexedEntries)
  })

export const createClimateRTree = <Value>(
  entries: readonly ClimateParameterListEntry<Value>[],
  fitness: ClimateRTreeFitness,
): Result.Result<ClimateRTree<Value>, TypeError | RangeError> =>
  Result.gen(function* resultGenerator() {
    yield* validateRTreeInputs(entries, fitness)
    const indexedEntries = yield* createIndexedEntries(entries)
    const root = yield* createRoot(indexedEntries)
    const search = createSearch(root, fitness)
    return Object.freeze({
      search: (target: ClimateTargetPoint): Result.Result<Option.Option<Value>, TypeError | RangeError> =>
        Result.map(search(target), matchValue),
      searchIndex: (target: ClimateTargetPoint): Result.Result<Option.Option<ClimateListIndexValue>, TypeError | RangeError> =>
        Result.map(search(target), matchIndex),
    })
  })
