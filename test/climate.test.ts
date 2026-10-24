import { describe, expect, it } from 'vitest'
import { Option, Result } from 'effect'
import {
  BlockAxis,
  PositionAxis,
  blockPosition,
  position,
  type BlockPosition,
  type Position,
} from '@nerima-games/mc-kernel/domain/coordinates'
import * as api from '../src/index.js'
import type {
  ClimateParameter,
  ClimateParameterPoint,
  ClimateParameterSpace,
  ClimateSampler,
} from '../src/index.js'
import {
  createClimateRTree as createRawClimateRTree,
  type ClimateRTreeFitness,
} from '../src/domain/climate-rtree.js'

const unwrap = <Value, ErrorValue>(result: Result.Result<Value, ErrorValue>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

const optionValue = <Value>(option: Option.Option<Value>): Value | undefined => {
  if (Option.isSome(option)) {
    return option.value
  }
  return globalThis.undefined
}

const resultOptionValue = <Value, ErrorValue>(
  result: Result.Result<Option.Option<Value>, ErrorValue>,
): Value | undefined => optionValue(unwrap(result))

const worldPosition = (x: number, y: number, z: number): Position =>
  position(PositionAxis(x), PositionAxis(y), PositionAxis(z))

const blockPoint = (x: number, y: number, z: number): BlockPosition =>
  blockPosition(BlockAxis(x), BlockAxis(y), BlockAxis(z))

const climateInput = (value: number | ClimateParameter): api.ClimateValue | ClimateParameter => {
  if (typeof value === 'number') {
    return api.ClimateValue(value)
  }
  return value
}

const climateParameter = (value: number): ClimateParameter =>
  unwrap(api.climateParameter(api.ClimateValue(value)))

const climateParameterRange = (min: number, max: number): ClimateParameter =>
  unwrap(api.climateParameterRange(api.ClimateValue(min), api.ClimateValue(max)))

const climateParameterSpan = (
  min: number | ClimateParameter,
  max: number | ClimateParameter,
): ClimateParameter => {
  if (typeof min === 'number' && typeof max === 'number') {
    return unwrap(api.climateParameterSpan(api.ClimateValue(min), api.ClimateValue(max)))
  }
  if (typeof min !== 'number' && typeof max !== 'number') {
    return unwrap(api.climateParameterSpan(min, max))
  }
  return unwrap(api.climateParameterSpan(min as never, max as never))
}

const createClimateParameterFromQuantized = (min: number, max: number): ClimateParameter =>
  unwrap(
    api.createClimateParameterFromQuantized(
      api.QuantizedClimateValue(min),
      api.QuantizedClimateValue(max),
    ),
  )

const createClimateParameterSpace = (
  temperature: number | ClimateParameter,
  humidity: number | ClimateParameter,
  continentalness: number | ClimateParameter,
  erosion: number | ClimateParameter,
  depth: number | ClimateParameter,
  weirdness: number | ClimateParameter,
): ClimateParameterSpace =>
  unwrap(api.createClimateParameterSpace(
    climateInput(temperature),
    climateInput(humidity),
    climateInput(continentalness),
    climateInput(erosion),
    climateInput(depth),
    climateInput(weirdness),
  ))

const climateParameters = (
  temperature: number | ClimateParameter,
  humidity: number | ClimateParameter,
  continentalness: number | ClimateParameter,
  erosion: number | ClimateParameter,
  depth: number | ClimateParameter,
  weirdness: number | ClimateParameter,
  offset: number,
): ClimateParameterPoint => {
  if (typeof temperature === 'number') {
    return unwrap(api.climateParameters(
      api.ClimateValue(temperature),
      api.ClimateValue(humidity as number),
      api.ClimateValue(continentalness as number),
      api.ClimateValue(erosion as number),
      api.ClimateValue(depth as number),
      api.ClimateValue(weirdness as number),
      api.ClimateValue(offset),
    ))
  }
  return unwrap(api.climateParameters(
    temperature,
    humidity as ClimateParameter,
    continentalness as ClimateParameter,
    erosion as ClimateParameter,
    depth as ClimateParameter,
    weirdness as ClimateParameter,
    api.ClimateValue(offset),
  ))
}

const climateTarget = (
  temperature: number,
  humidity: number,
  continentalness: number,
  erosion: number,
  depth: number,
  weirdness: number,
): api.ClimateTargetPoint =>
  unwrap(api.climateTarget(
    api.ClimateValue(temperature),
    api.ClimateValue(humidity),
    api.ClimateValue(continentalness),
    api.ClimateValue(erosion),
    api.ClimateValue(depth),
    api.ClimateValue(weirdness),
  ))

const createClimateParameterPointFromQuantized = (
  parameters: ClimateParameterSpace,
  offset: number,
): ClimateParameterPoint =>
  unwrap(api.createClimateParameterPointFromQuantized(
    parameters,
    api.QuantizedClimateValue(offset),
  ))

const createClimateTargetPointFromQuantized = (
  temperature: number,
  humidity: number,
  continentalness: number,
  erosion: number,
  depth: number,
  weirdness: number,
): api.ClimateTargetPoint =>
  unwrap(api.createClimateTargetPointFromQuantized(
    api.QuantizedClimateValue(temperature),
    api.QuantizedClimateValue(humidity),
    api.QuantizedClimateValue(continentalness),
    api.QuantizedClimateValue(erosion),
    api.QuantizedClimateValue(depth),
    api.QuantizedClimateValue(weirdness),
  ))

const point = climateParameter
const span = climateParameterSpan
const parameters = climateParameters
const parameterPoint = climateParameters
const target = climateTarget

const quantizeCoord = (value: number): api.QuantizedClimateValue =>
  unwrap(api.quantizeCoord(api.ClimateValue(value)))

const unquantizeCoord = (value: number): api.ClimateValue =>
  unwrap(api.unquantizeCoord(api.QuantizedClimateValue(value)))

const climateParameterDistance = (
  parameter: ClimateParameter,
  targetValue: number,
): api.ClimateDistance =>
  unwrap(api.climateParameterDistance(parameter, api.QuantizedClimateValue(targetValue)))

const createClimateParameterList = <Value>(
  entries: readonly api.ClimateParameterListEntry<Value>[],
): api.ClimateParameterList<Value> => unwrap(api.createClimateParameterList(entries))

const findClimateValueIndex = <Value>(
  list: api.ClimateParameterList<Value>,
  targetValue: api.ClimateTargetPoint,
): number | undefined => resultOptionValue(api.findClimateValueIndex(list, targetValue))

const findClimateValue = <Value>(
  list: api.ClimateParameterList<Value>,
  targetValue: api.ClimateTargetPoint,
): Value | undefined => resultOptionValue(api.findClimateValue(list, targetValue))

const findClimateValueBruteForce = <Value>(
  list: api.ClimateParameterList<Value>,
  targetValue: api.ClimateTargetPoint,
): Value | undefined => resultOptionValue(api.findClimateValueBruteForce(list, targetValue))

const createClimateSampler = (options: api.ClimateSamplerOptions): ClimateSampler =>
  unwrap(api.createClimateSampler(options))

const createClimateSamplerRuntime = (sampler: ClimateSampler) => {
  const runtime = unwrap(api.createClimateSamplerRuntime(sampler))
  return Object.freeze({
    ...runtime,
    findSpawnPosition: (options?: api.ClimateSpawnSearchOptions) =>
      resultOptionValue(runtime.findSpawnPosition(options)),
    sample: (
      x: number,
      y: number,
      z: number,
      context?: api.DensityEvaluationContext | api.DensityEvaluationSession,
    ) => unwrap(runtime.sample(worldPosition(x, y, z), context)),
  })
}

const createDensityEvaluationContext = (...args: Parameters<typeof api.createDensityEvaluationContext>) =>
  unwrap(api.createDensityEvaluationContext(...args))

const createDensityEvaluationSession = (...args: Parameters<typeof api.createDensityEvaluationSession>) =>
  unwrap(api.createDensityEvaluationSession(...args))

const densityConstant = (value: number): api.DensityFunction =>
  unwrap(api.densityConstant(api.DensityValue(value)))

const empty = (): ClimateSampler => unwrap(api.empty())

const sampleClimate = (...args: Parameters<typeof api.sampleClimate>) =>
  unwrap(api.sampleClimate(...args))

const sampleClimateAt = (
  sampler: ClimateSampler,
  x: number,
  y: number,
  z: number,
  context?: api.DensityEvaluationContext | api.DensityEvaluationSession,
) => unwrap(api.sampleClimateAt(sampler, worldPosition(x, y, z), context))

const findClimateSpawnPosition = (...args: Parameters<typeof api.findClimateSpawnPosition>) =>
  resultOptionValue(api.findClimateSpawnPosition(...args))

const findSpawnPosition = (...args: Parameters<typeof api.findSpawnPosition>) =>
  resultOptionValue(api.findSpawnPosition(...args))

const requireClimateParameter = (...args: Parameters<typeof api.requireClimateParameter>) =>
  unwrap(api.requireClimateParameter(...args))

const requireClimateParameterList = <Value>(value: unknown): api.ClimateParameterList<Value> =>
  unwrap(api.requireClimateParameterList<Value>(value))

const requireClimateParameterPoint = (...args: Parameters<typeof api.requireClimateParameterPoint>) =>
  unwrap(api.requireClimateParameterPoint(...args))

const requireClimateSampler = (value: unknown): ClimateSampler =>
  unwrap(api.requireClimateSampler(value))

const {
  isClimateParameter,
  isClimateParameterPoint,
  isClimateSampler,
  isClimateTargetPoint,
} = api

const expectFailure = <Value, ErrorValue>(
  result: Result.Result<Value, ErrorValue>,
  message: string,
): void => {
  expect(Result.isFailure(result)).toBe(true)
  if (Result.isFailure(result)) {
    expect(result.failure).toHaveProperty('message', message)
  }
}

const createClimateRTree = <Value>(
  entries: readonly api.ClimateParameterListEntry<Value>[],
  fitness: ClimateRTreeFitness,
): Readonly<{
  search: (target: api.ClimateTargetPoint) => Value | undefined
  searchIndex: (target: api.ClimateTargetPoint) => number | undefined
}> => {
  const tree = unwrap(createRawClimateRTree(entries, fitness))
  return Object.freeze({
    search: (searchTarget) => resultOptionValue(tree.search(searchTarget)),
    searchIndex: (searchTarget) => resultOptionValue(tree.searchIndex(searchTarget)),
  })
}

const climateParameterSpace = (pointValue: ClimateParameterPoint): ClimateParameterSpace =>
  unwrap(api.climateParameterSpace(pointValue))

const climateParameterPointFitness = (
  pointValue: ClimateParameterPoint,
  targetValue: api.ClimateTargetPoint,
): api.ClimateFitness => unwrap(api.climateParameterPointFitness(pointValue, targetValue))

const climateParameterPointFitnessResult = (
  pointValue: ClimateParameterPoint,
  targetValue: api.ClimateTargetPoint,
) => api.climateParameterPointFitness(pointValue, targetValue)

const {
  CLIMATE_CHANNELS,
  CLIMATE_HYPERCUBE_DIMENSION,
  CLIMATE_PARAMETER_COUNT,
  CLIMATE_QUANTIZATION_FACTOR,
} = api

const zeroParameter = climateParameter(0)
const unitParameter = climateParameter(1)
const zeroPoint = climateParameters(0, 0, 0, 0, 0, 0, 0)
const zeroTarget = climateTarget(0, 0, 0, 0, 0, 0)

const makeSpace = (value = zeroParameter): ClimateParameterSpace =>
  createClimateParameterSpace(value, value, value, value, value, value)

const makeSampler = (spawnTarget: readonly ClimateParameterPoint[] = []): ClimateSampler =>
  createClimateSampler({
    temperature: densityConstant(0),
    humidity: densityConstant(0),
    continentalness: densityConstant(0),
    erosion: densityConstant(0),
    depth: densityConstant(0),
    weirdness: densityConstant(0),
    spawnTarget,
  })

describe('Climate quantization and parameter primitives', () => {
  it('exposes the official six-dimensional quantized coordinate contract', () => {
    expect(CLIMATE_PARAMETER_COUNT).toBe(6)
    expect(CLIMATE_HYPERCUBE_DIMENSION).toBe(6)
    expect(CLIMATE_QUANTIZATION_FACTOR).toBe(10_000)
    expect(CLIMATE_CHANNELS).toEqual([
      'temperature',
      'humidity',
      'continentalness',
      'erosion',
      'depth',
      'weirdness',
    ])
    expect(quantizeCoord(0.123456)).toBe(1234)
    expect(quantizeCoord(-0.123456)).toBe(-1234)
    expect(unquantizeCoord(1234)).toBe(0.1234)
    expectFailure(api.quantizeCoord(Number.NaN as never), 'coordinate must be finite')
    expectFailure(api.unquantizeCoord('bad' as never), 'coordinate must be a number')
    expectFailure(api.quantizeCoord(Number.MAX_VALUE as never), 'coordinate must be a safe integer')
    expectFailure(api.unquantizeCoord(1.5 as never), 'coordinate must be a safe integer')
  })

  it('rejects invalid values for climate scalar brands', () => {
    expectFailure(api.ClimateValue.result(Number.NaN), 'climate value must be finite')
    expectFailure(
      api.QuantizedClimateValue.result(1.5),
      'quantized climate value must be a safe integer',
    )
    expectFailure(
      api.ClimateDistance.result(-1),
      'climate distance must be finite and non-negative',
    )
    expectFailure(
      api.ClimateFitness.result(-1),
      'climate fitness must be finite and non-negative',
    )
    expectFailure(
      api.ClimateListIndex.result(-1),
      'climate list index must be a non-negative safe integer',
    )
  })

  it('creates and validates quantized parameter spans and aliases', () => {
    expect(climateParameter(0.25)).toEqual({ min: 2500, max: 2500 })
    expect(climateParameterRange(-1, 1)).toEqual({ min: -10_000, max: 10_000 })
    expect(createClimateParameterFromQuantized(-2, 3)).toEqual({ min: -2, max: 3 })
    expect(climateParameterSpan(0, 1)).toEqual({ min: 0, max: 10_000 })
    expect(climateParameterSpan(climateParameter(0), climateParameter(1))).toEqual({
      min: 0,
      max: 10_000,
    })
    expect(point(0)).toEqual(climateParameter(0))
    expect(span(0, 1)).toEqual(climateParameterSpan(0, 1))
    expect(() => createClimateParameterFromQuantized(2, 1)).toThrow(
      'parameter min must be less than or equal to max',
    )
    expect(() => climateParameterSpan(0 as never, climateParameter(1))).toThrow(
      'span bounds must both be numbers or ClimateParameters',
    )
    expect(isClimateParameter(null)).toBe(false)
    expect(isClimateParameter({})).toBe(false)
    expect(isClimateParameter({ min: 0, max: 1.5 })).toBe(false)
    expect(isClimateParameter({ min: Number.MAX_SAFE_INTEGER + 1, max: 1 })).toBe(false)
    expect(isClimateParameter({ min: 2, max: 1 })).toBe(false)
    expect(isClimateParameter({ min: 0, max: 1 })).toBe(true)
    expect(requireClimateParameter(api.ClimateFieldName('parameter'), { min: 0, max: 1 })).toEqual({
      min: 0,
      max: 1,
    })
    expect(() => requireClimateParameter(api.ClimateFieldName('parameter'), null)).toThrow(
      'parameter must be a ClimateParameter',
    )
  })

  it('creates six-dimensional parameter points and target points', () => {
    const space = makeSpace()
    const fromSpace = createClimateParameterPointFromQuantized(space, -5)
    const numeric = climateParameters(0, 1, 2, 3, 4, 5, 0.5)
    const objectParameters = climateParameters(
      zeroParameter,
      unitParameter,
      zeroParameter,
      zeroParameter,
      zeroParameter,
      zeroParameter,
      7,
    )

    expect(fromSpace.offset).toBe(-5)
    expect(numeric.temperature).toEqual({ min: 0, max: 0 })
    expect(numeric.humidity).toEqual({ min: 10_000, max: 10_000 })
    expect(numeric.offset).toBe(5000)
    expect(objectParameters.humidity).toEqual(unitParameter)
    expect(parameters(0, 0, 0, 0, 0, 0, 0)).toEqual(zeroPoint)
    expect(parameterPoint(0, 0, 0, 0, 0, 0, 0)).toEqual(zeroPoint)
    expect(createClimateParameterPointFromQuantized(space, -5)).toEqual(fromSpace)
    expect(createClimateParameterSpace(
      0 as never,
      0 as never,
      0 as never,
      0 as never,
      0 as never,
      0 as never,
    )).toEqual(makeSpace())
    expect(() => createClimateParameterPointFromQuantized(null as never, 0)).toThrow(
      'parameters must be an object',
    )

    const targetFromQuantized = createClimateTargetPointFromQuantized(1, 2, 3, 4, 5, 6)
    expect(targetFromQuantized).toEqual({
      temperature: 1,
      humidity: 2,
      continentalness: 3,
      erosion: 4,
      depth: 5,
      weirdness: 6,
    })
    expect(target(0, 0, 0, 0, 0, 0)).toEqual(zeroTarget)
    expect(targetFromQuantized).toEqual(
      createClimateTargetPointFromQuantized(1, 2, 3, 4, 5, 6),
    )
    expect(isClimateParameterPoint(fromSpace)).toBe(true)
    expect(isClimateTargetPoint(targetFromQuantized)).toBe(true)
    expect(requireClimateParameterPoint(api.ClimateFieldName('point'), fromSpace)).toEqual(fromSpace)
    expect(() => requireClimateParameterPoint(api.ClimateFieldName('point'), null)).toThrow(
      'point must be a ClimateParameterPoint',
    )
    expect(isClimateTargetPoint(null)).toBe(false)
    expect(isClimateTargetPoint({ ...targetFromQuantized, temperature: 1.5 })).toBe(false)
    expect(Result.isFailure(api.createClimateTargetPointFromQuantized(1.5 as never, 2 as never, 3 as never, 4 as never, 5 as never, 6 as never))).toBe(true)
  })

  it('short-circuits every climate point validation dimension', () => {
    const validPoint = {
      temperature: zeroParameter,
      humidity: zeroParameter,
      continentalness: zeroParameter,
      erosion: zeroParameter,
      depth: zeroParameter,
      weirdness: zeroParameter,
      offset: 0,
    }
    for (const field of [
      'temperature',
      'humidity',
      'continentalness',
      'erosion',
      'depth',
      'weirdness',
      'offset',
    ] as const) {
      expect(isClimateParameterPoint({ ...validPoint, [field]: null })).toBe(false)
    }
    const validTarget = {
      temperature: 0,
      humidity: 0,
      continentalness: 0,
      erosion: 0,
      depth: 0,
      weirdness: 0,
    }
    for (const field of [
      'temperature',
      'humidity',
      'continentalness',
      'erosion',
      'depth',
      'weirdness',
    ] as const) {
      expect(isClimateTargetPoint({ ...validTarget, [field]: null })).toBe(false)
    }
    expect(isClimateParameterPoint({ ...validPoint, offset: 1.5 })).toBe(false)
    expect(isClimateParameterPoint({ ...validPoint, offset: Number.MAX_SAFE_INTEGER + 1 })).toBe(false)
    expect(isClimateParameterPoint(0)).toBe(false)
  })
})

describe('Climate distance and parameter lists', () => {
  it('computes distances, fitness, and parameter spaces', () => {
    const ranged = climateParameterRange(0, 1)
    expect(climateParameterDistance(ranged, -1)).toBe(1)
    expect(climateParameterDistance(ranged, 20_000)).toBe(10_000)
    expect(climateParameterDistance(ranged, 5000)).toBe(0)
    const pointValue = climateParameters(0, 0, 0, 0, 0, 0, 0.25)
    const targetValue = createClimateTargetPointFromQuantized(1000, 2000, 3000, 4000, 5000, 6000)
    expect(climateParameterPointFitness(pointValue, targetValue)).toBe(97_250_000)
    expect(climateParameterSpace(pointValue)).toEqual({
      temperature: zeroParameter,
      humidity: zeroParameter,
      continentalness: zeroParameter,
      erosion: zeroParameter,
      depth: zeroParameter,
      weirdness: zeroParameter,
    })
    expect(() => climateParameterDistance(null as never, 0)).toThrow(
      'parameter must be a ClimateParameter',
    )
  })

  it('finds the nearest parameter-list value and preserves the first tie', () => {
    const near = climateParameters(0, 0, 0, 0, 0, 0, 0)
    const far = climateParameters(1, 1, 1, 1, 1, 1, 0)
    const list = createClimateParameterList([
      [far, 'far'],
      [near, 'near'],
      [near, 'tie'],
    ] as const)
    expect(Object.isFrozen(list)).toBe(true)
    expect(Object.isFrozen(list.entries)).toBe(true)
    expect(findClimateValueIndex(list, zeroTarget)).toBe(1)
    expect(findClimateValue(list, zeroTarget)).toBe('near')
    expect(findClimateValueBruteForce(list, zeroTarget)).toBe('near')
    expect(findClimateValueIndex(createClimateParameterList([]), zeroTarget)).toBeUndefined()
    expect(findClimateValue(createClimateParameterList([]), zeroTarget)).toBeUndefined()
    expect(findClimateValueBruteForce(createClimateParameterList([]), zeroTarget)).toBeUndefined()
    expect(() => findClimateValueIndex(list, null as never)).toThrow(
      'target must be an object',
    )
    expect(() => createClimateParameterList(null as never)).toThrow('entries must be an array')
    expect(() => createClimateParameterList([[near] as never])).toThrow(
      'entries[0] must be a [point, value] tuple',
    )
    expect(() => requireClimateParameterList(null)).toThrow(
      'parameter list must be an object',
    )
    expect(() => requireClimateParameterList({ entries: null })).toThrow(
      'parameter list.entries must be an array',
    )
    expect(() => requireClimateParameterList({ entries: [[null, 'bad']] })).toThrow(
      'entries[0][0] must be a ClimateParameterPoint',
    )
  })

  it('searches bounded trees without changing brute-force tie semantics', () => {
    const widePoint = parameterPoint(
      zeroParameter,
      zeroParameter,
      zeroParameter,
      zeroParameter,
      zeroParameter,
      climateParameterRange(-2, 2),
      0,
    )
    const splitTree = createClimateRTree([
      [zeroPoint, 'zero'],
      [widePoint, 'wide'],
    ] as const, climateParameterPointFitnessResult)
    expect(splitTree.search(zeroTarget)).toBe('zero')

    const unitPoint = climateParameters(1, 1, 1, 1, 1, 1, 0)
    const directionalTree = createClimateRTree([
      [zeroPoint, 'zero'],
      [unitPoint, 'unit'],
    ] as const, climateParameterPointFitnessResult)
    expect(directionalTree.searchIndex(climateTarget(1, 1, 1, 1, 1, 1))).toBe(1)

    const tieTree = createClimateRTree([
      [
        parameterPoint(
          climateParameterRange(-1, 1),
          zeroParameter,
          zeroParameter,
          zeroParameter,
          zeroParameter,
          zeroParameter,
          0,
        ),
        'first',
      ],
      [
        parameterPoint(
          zeroParameter,
          climateParameterRange(-1, 1),
          zeroParameter,
          zeroParameter,
          zeroParameter,
          zeroParameter,
          0,
        ),
        'second',
      ],
    ] as const, (candidate) =>
      Result.succeed(api.ClimateFitness(Number(candidate.temperature.min === -10_000))))
    expect(tieTree.search(zeroTarget)).toBe('second')

    const emptyTree = createClimateRTree([], climateParameterPointFitnessResult)
    expect(emptyTree.search(zeroTarget)).toBeUndefined()
    expect(emptyTree.searchIndex(zeroTarget)).toBeUndefined()
    expect(() => createClimateRTree(null as never, climateParameterPointFitnessResult)).toThrow(
      'RTree entries must be an array',
    )
    expect(() => createClimateRTree([], null as never)).toThrow(
      'RTree fitness must be a function',
    )
  })

  it('rejects malformed entries and targets at the RTree boundary', () => {
    expectFailure(
      createRawClimateRTree([[zeroPoint] as never], climateParameterPointFitnessResult),
      'entries[0] must be a [point, value] tuple',
    )

    const tree = unwrap(
      createRawClimateRTree([[zeroPoint, 'zero']] as const, climateParameterPointFitnessResult),
    )
    expectFailure(tree.search(null as never), 'RTree target must be a ClimateTargetPoint')
  })

  it('validates callback Results and fitness values during RTree search', () => {
    const entries = [[zeroPoint, 'zero']] as const

    const nonResultTree = unwrap(createRawClimateRTree(entries, (() => 1) as never))
    expectFailure(nonResultTree.search(zeroTarget), 'RTree fitness must return a Result')

    const invalidErrorTree = unwrap(
      createRawClimateRTree(entries, (() => Result.fail(new Error('private failure'))) as never),
    )
    expectFailure(invalidErrorTree.search(zeroTarget), 'RTree fitness returned an invalid error')

    const invalidValueTree = unwrap(
      createRawClimateRTree(entries, (() => Result.succeed('not a number')) as never),
    )
    expectFailure(invalidValueTree.search(zeroTarget), 'RTree fitness must return a number')

    const infiniteFitnessTree = unwrap(
      createRawClimateRTree(
        entries,
        (() => Result.succeed(Number.POSITIVE_INFINITY)) as never,
      ),
    )
    const infiniteFitnessResult = infiniteFitnessTree.search(zeroTarget)
    expectFailure(
      infiniteFitnessResult,
      'climate fitness must be finite and non-negative',
    )
    if (Result.isFailure(infiniteFitnessResult)) {
      expect(infiniteFitnessResult.failure).toBeInstanceOf(RangeError)
    }

    const typedFailure = new TypeError('fitness rejected')
    const failedTree = unwrap(
      createRawClimateRTree(entries, (() => Result.fail(typedFailure)) as never),
    )
    const searchResult = failedTree.search(zeroTarget)
    expect(Result.isFailure(searchResult)).toBe(true)
    if (Result.isFailure(searchResult)) {
      expect(searchResult.failure).toBe(typedFailure)
    }

    const rangeFailure = new RangeError('fitness out of range')
    const rangeFailureTree = unwrap(
      createRawClimateRTree(entries, (() => Result.fail(rangeFailure)) as never),
    )
    const rangeSearchResult = rangeFailureTree.search(zeroTarget)
    expect(Result.isFailure(rangeSearchResult)).toBe(true)
    if (Result.isFailure(rangeSearchResult)) {
      expect(rangeSearchResult.failure).toBe(rangeFailure)
    }
  })
})

describe('Climate samplers and spawn search', () => {
  it('samples all six channels through direct, context, and session evaluators', () => {
    const sampler = makeSampler()
    const samplePosition = worldPosition(1, 2, 3)
    const context = createDensityEvaluationContext()
    const session = createDensityEvaluationSession(context)
    expect(sampleClimate(sampler, samplePosition)).toEqual(zeroTarget)
    expect(sampleClimate(sampler, samplePosition, context)).toEqual(zeroTarget)
    expect(sampleClimate(sampler, samplePosition, session)).toEqual(zeroTarget)
    expect(Object.isFrozen(sampler)).toBe(true)
    expect(Object.isFrozen(sampler.spawnTarget)).toBe(true)
    expect(isClimateSampler(sampler)).toBe(true)
    expect(isClimateSampler(null)).toBe(false)
    expect(isClimateSampler({})).toBe(false)
    expect(isClimateSampler({
      ...sampler,
      temperature: null,
    })).toBe(false)
    expect(isClimateSampler({
      ...sampler,
      humidity: null,
    })).toBe(false)
    expect(isClimateSampler({
      ...sampler,
      continentalness: null,
    })).toBe(false)
    expect(isClimateSampler({
      ...sampler,
      erosion: null,
    })).toBe(false)
    expect(isClimateSampler({
      ...sampler,
      depth: null,
    })).toBe(false)
    expect(isClimateSampler({
      ...sampler,
      weirdness: null,
    })).toBe(false)
    expect(isClimateSampler({ ...sampler, spawnTarget: globalThis.undefined })).toBe(false)
    expect(isClimateSampler({
      ...sampler,
      spawnTarget: [null],
    })).toBe(false)
    expect(requireClimateSampler(sampler)).toEqual(sampler)
    expect(requireClimateSampler({ ...sampler, spawnTarget: globalThis.undefined })).toEqual(sampler)
    expect(() => requireClimateSampler(null)).toThrow('sampler must be an object')
    expect(() => createClimateSampler({
      ...sampler,
      spawnTarget: null as never,
    })).toThrow('sampler.spawnTarget must be an array')
    expect(() => createClimateSampler({
      ...sampler,
      temperature: null as never,
    })).toThrow('sampler.temperature must be a DensityFunction')
    expect(Result.isFailure(api.sampleClimate(sampler, samplePosition, null as never))).toBe(true)
  })

  it('matches the official sampler runtime shape', () => {
    const emptySampler = empty()
    expect(Object.isFrozen(emptySampler)).toBe(true)
    expect(emptySampler.spawnTarget).toEqual([])
    expect(sampleClimateAt(emptySampler, 1, 2, 3)).toEqual(zeroTarget)

    const runtime = createClimateSamplerRuntime(makeSampler([zeroPoint]))
    const context = createDensityEvaluationContext()
    expect(Object.isFrozen(runtime)).toBe(true)
    expect(runtime.sample(1, 2, 3)).toEqual(zeroTarget)
    expect(runtime.sample(1, 2, 3, context)).toEqual(zeroTarget)
    expect(sampleClimateAt(runtime, 1, 2, 3)).toEqual(zeroTarget)
    expect(runtime.findSpawnPosition({
      origin: blockPoint(10, 20, 30),
      radius: api.ClimateSearchRadius(0),
      verticalRadius: api.ClimateSearchRadius(0),
      step: api.ClimateSearchStep(1),
    })).toEqual(blockPoint(10, 20, 30))
    expect(runtime.sample(1.5, 2, 3)).toEqual(zeroTarget)
    expect(Result.isFailure(api.sampleClimateAt(emptySampler, { x: Number.NaN, y: 0, z: 0 } as never))).toBe(true)
  })

  it('uses the configured spawn target and returns the best bounded block', () => {
    const sampler = makeSampler([zeroPoint])
    expect(findClimateSpawnPosition(sampler, globalThis.undefined, {
      origin: blockPoint(10, 20, 30),
      radius: api.ClimateSearchRadius(0),
      verticalRadius: api.ClimateSearchRadius(0),
      step: api.ClimateSearchStep(1),
    })).toEqual(blockPoint(10, 20, 30))
    expect(findSpawnPosition([zeroPoint], sampler, {
      origin: blockPoint(1, 2, 3),
      radius: api.ClimateSearchRadius(0),
      verticalRadius: api.ClimateSearchRadius(0),
      step: api.ClimateSearchStep(1),
      context: createDensityEvaluationSession(createDensityEvaluationContext()),
    })).toEqual(blockPoint(1, 2, 3))
    expect(() => findClimateSpawnPosition(sampler, [null as never], {
      radius: api.ClimateSearchRadius(0),
      verticalRadius: api.ClimateSearchRadius(0),
    })).toThrow('targets[0] must be a ClimateParameterPoint')
    expect(() => findClimateSpawnPosition(sampler, [], null as never)).toThrow(
      'search options must be an object',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { step: 0 } as never)).toThrow(
      'climate search step must be a positive safe integer',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { radius: -1 } as never)).toThrow(
      'climate search radius must be a non-negative safe integer',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { verticalRadius: -1 } as never)).toThrow(
      'climate search radius must be a non-negative safe integer',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { origin: null as never } as never)).toThrow(
      'origin must be an object',
    )
    expect(() => findClimateSpawnPosition(sampler, [], {
      origin: { x: 1.5, y: 0, z: 0 },
    } as never)).toThrow('origin.x must be a safe integer')
  })

  it('uses default search options for an empty target set and rejects invalid integers', () => {
    const sampler = makeSampler()
    expect(findClimateSpawnPosition(sampler)).toBeUndefined()
    expect(() => findClimateSpawnPosition(sampler, [], { radius: 1.5 } as never)).toThrow(
      'climate search radius must be a non-negative safe integer',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { radius: null as never } as never)).toThrow(
      'radius must be a number',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { step: Number.NaN } as never)).toThrow(
      'step must be a safe integer',
    )
    expect(() => findClimateSpawnPosition(sampler, [], {
      origin: { x: Number.NaN, y: 0, z: 0 },
    } as never)).toThrow('origin.x must be a safe integer')
  })

  it('rejects spawn targets that are not an array', () => {
    expectFailure(
      api.findClimateSpawnPosition(makeSampler([zeroPoint]), 1 as never),
      'targets must be an array',
    )
  })

  it('keeps the first tied spawn candidate and replaces it with a fitter one', () => {
    const sampler = createClimateSampler({
      temperature: unwrap(api.densityCoordinate('x')),
      humidity: densityConstant(0),
      continentalness: densityConstant(0),
      erosion: densityConstant(0),
      depth: densityConstant(0),
      weirdness: densityConstant(0),
      spawnTarget: [zeroPoint],
    })

    expect(findClimateSpawnPosition(sampler, globalThis.undefined, {
      origin: blockPoint(0, 0, 0),
      radius: api.ClimateSearchRadius(1),
      verticalRadius: api.ClimateSearchRadius(0),
      step: api.ClimateSearchStep(1),
    })).toEqual(blockPoint(0, 0, -1))
  })

  it.each([
    {
      axis: 'x',
      origin: blockPoint(Number.MIN_SAFE_INTEGER, 0, 0),
      radius: 1,
      verticalRadius: 0,
    },
    {
      axis: 'y',
      origin: blockPoint(0, Number.MIN_SAFE_INTEGER, 0),
      radius: 0,
      verticalRadius: 1,
    },
    {
      axis: 'z',
      origin: blockPoint(0, 0, Number.MIN_SAFE_INTEGER),
      radius: 1,
      verticalRadius: 0,
    },
  ])(
    'rejects a spawn candidate that overflows the $axis block axis',
    ({ origin, radius, verticalRadius }) => {
      const result = api.findClimateSpawnPosition(makeSampler([zeroPoint]), globalThis.undefined, {
        origin,
        radius: api.ClimateSearchRadius(radius),
        verticalRadius: api.ClimateSearchRadius(verticalRadius),
        step: api.ClimateSearchStep(1),
      })
      expect(Result.isFailure(result)).toBe(true)
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(RangeError)
      }
    },
  )
})
