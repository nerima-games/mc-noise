import type {
  ClimateParameterListEntry,
  ClimateParameterPoint,
  ClimateTargetPoint,
} from './climate.js'

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
const TARGET_OFFSET = 0
const ZERO_DISTANCE = 0

type ClimateDimension = typeof CLIMATE_DIMENSIONS[number]

type IndexedEntry<Value> = Readonly<{
  readonly index: number
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
  readonly fitness: number
}>

type SearchState<Value> = {
  best: SearchMatch<Value> | null
}

type ClimateRTreeFitness = (
  point: ClimateParameterPoint,
  target: ClimateTargetPoint,
) => number

export type ClimateRTree<Value> = Readonly<{
  readonly search: (target: ClimateTargetPoint) => Value | undefined
  readonly searchIndex: (target: ClimateTargetPoint) => number | undefined
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
): void => {
  for (
    let index = FIRST_ENTRY_INDEX;
    index < CLIMATE_DIMENSIONS.length;
    index += INDEX_INCREMENT
  ) {
    const dimension = CLIMATE_DIMENSIONS[index]!
    const coordinate = pointCoordinate(entry.point, dimension)
    bounds.lower[index] = Math.min(bounds.lower[index]!, coordinate.lower)
    bounds.upper[index] = Math.max(bounds.upper[index]!, coordinate.upper)
  }
  bounds.offsetLower = Math.min(bounds.offsetLower, entry.point.offset)
  bounds.offsetUpper = Math.max(bounds.offsetUpper, entry.point.offset)
}

const freezeBounds = (bounds: MutableBounds): Bounds =>
  Object.freeze({
    lower: Object.freeze(bounds.lower),
    offsetLower: bounds.offsetLower,
    offsetUpper: bounds.offsetUpper,
    upper: Object.freeze(bounds.upper),
  })

const createBounds = <Value>(
  entries: readonly IndexedEntry<Value>[],
): Bounds => {
  const bounds = createMutableBounds(entries[FIRST_ENTRY_INDEX]!)
  for (const entry of entries.slice(SECOND_ENTRY_INDEX)) {
    mergeBounds(bounds, entry)
  }
  return freezeBounds(bounds)
}

const midpoint = (
  entry: IndexedEntry<unknown>,
  axis: number,
): number => {
  const dimension = CLIMATE_DIMENSIONS[axis]!
  const coordinate = pointCoordinate(entry.point, dimension)
  return (coordinate.lower + coordinate.upper) / MIDPOINT_DIVISOR
}

const splitAxis = (bounds: Bounds): number => {
  let axis = FIRST_ENTRY_INDEX
  let largestSpan =
    bounds.upper[FIRST_ENTRY_INDEX]! - bounds.lower[FIRST_ENTRY_INDEX]!
  for (
    let index = SECOND_ENTRY_INDEX;
    index < CLIMATE_DIMENSIONS.length;
    index += INDEX_INCREMENT
  ) {
    const span = bounds.upper[index]! - bounds.lower[index]!
    if (span > largestSpan) {
      axis = index
      largestSpan = span
    }
  }
  return axis
}

const buildTree = <Value>(
  entries: readonly IndexedEntry<Value>[],
): Node<Value> => {
  const bounds = createBounds(entries)
  if (entries.length === SINGLE_ENTRY_COUNT) {
    return Object.freeze({
      bounds,
      entry: entries[FIRST_ENTRY_INDEX]!,
      kind: 'leaf' as const,
    })
  }
  const axis = splitAxis(bounds)
  const ordered = [...entries].sort((left, right) => {
    const midpointDifference = midpoint(left, axis) - midpoint(right, axis)
    if (midpointDifference !== ZERO_DISTANCE) {
      return midpointDifference
    }
    return left.index - right.index
  })
  const splitIndex = Math.floor(ordered.length / MIDPOINT_DIVISOR)
  return Object.freeze({
    bounds,
    kind: 'branch' as const,
    left: buildTree(ordered.slice(FIRST_ENTRY_INDEX, splitIndex)),
    right: buildTree(ordered.slice(splitIndex)),
  })
}

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
): number => {
  let result = distanceToInterval(
    bounds.lower[FIRST_ENTRY_INDEX]!,
    bounds.upper[FIRST_ENTRY_INDEX]!,
    target.temperature,
  )
  for (
    let index = SECOND_ENTRY_INDEX;
    index < CLIMATE_DIMENSIONS.length;
    index += INDEX_INCREMENT
  ) {
    const dimension = CLIMATE_DIMENSIONS[index]!
    result += distanceToInterval(
      bounds.lower[index]!,
      bounds.upper[index]!,
      target[dimension],
    )
  }
  return result + distanceToInterval(
    bounds.offsetLower,
    bounds.offsetUpper,
    TARGET_OFFSET,
  )
}

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

const visitLeaf = <Value>(
  node: Leaf<Value>,
  target: ClimateTargetPoint,
  fitness: ClimateRTreeFitness,
  state: SearchState<Value>,
): void => {
  const candidate: SearchMatch<Value> = {
    entry: node.entry,
    fitness: fitness(node.entry.point, target),
  }
  if (isBetterMatch(candidate, state.best)) {
    state.best = candidate
  }
}

const visitChildren = <Value>(
  node: Branch<Value>,
  target: ClimateTargetPoint,
  visit: (child: Node<Value>) => void,
): void => {
  const leftDistance = lowerBound(node.left.bounds, target)
  const rightDistance = lowerBound(node.right.bounds, target)
  if (leftDistance <= rightDistance) {
    visit(node.left)
    visit(node.right)
    return
  }
  visit(node.right)
  visit(node.left)
}

const visitNode = <Value>(
  node: Node<Value>,
  target: ClimateTargetPoint,
  fitness: ClimateRTreeFitness,
  state: SearchState<Value>,
): void => {
  if (
    state.best !== null &&
    lowerBound(node.bounds, target) > state.best.fitness
  ) {
    return
  }
  if (node.kind === 'leaf') {
    visitLeaf(node, target, fitness, state)
    return
  }
  visitChildren(node, target, (child) =>
    visitNode(child, target, fitness, state),
  )
}

const createSearch = <Value>(
  root: Node<Value> | null,
  fitness: ClimateRTreeFitness,
): ((target: ClimateTargetPoint) => SearchMatch<Value> | null) => (
  target,
) => {
  if (root === null) {
    return null
  }
  const state: SearchState<Value> = { best: null }
  visitNode(root, target, fitness, state)
  return state.best
}

const matchIndex = <Value>(
  match: SearchMatch<Value> | null,
): number | undefined => {
  if (match === null) {
    return
  }
  return match.entry.index
}

const matchValue = <Value>(
  match: SearchMatch<Value> | null,
): Value | undefined => {
  if (match === null) {
    return
  }
  return match.entry.value
}

const createRoot = <Value>(
  entries: readonly IndexedEntry<Value>[],
): Node<Value> | null => {
  if (entries.length === EMPTY_ENTRY_COUNT) {
    return null
  }
  return buildTree(entries)
}

const validateRTreeInputs = <Value>(
  entries: readonly ClimateParameterListEntry<Value>[],
  fitness: ClimateRTreeFitness,
): void => {
  if (!Array.isArray(entries)) {
    throw new TypeError('RTree entries must be an array')
  }
  if (typeof fitness !== 'function') {
    throw new TypeError('RTree fitness must be a function')
  }
}

const createIndexedEntries = <Value>(
  entries: readonly ClimateParameterListEntry<Value>[],
): readonly IndexedEntry<Value>[] =>
  Object.freeze(
    entries.map((entry, index) =>
      Object.freeze({
        index,
        point: entry[FIRST_ENTRY_INDEX],
        value: entry[SECOND_ENTRY_INDEX],
      }),
    ),
  )

export const createClimateRTree = <Value>(
  entries: readonly ClimateParameterListEntry<Value>[],
  fitness: ClimateRTreeFitness,
): ClimateRTree<Value> => {
  validateRTreeInputs(entries, fitness)
  const root = createRoot(createIndexedEntries(entries))
  const search = createSearch(root, fitness)
  return Object.freeze({
    search: (target: ClimateTargetPoint): Value | undefined =>
      matchValue(search(target)),
    searchIndex: (target: ClimateTargetPoint): number | undefined =>
      matchIndex(search(target)),
  })
}
