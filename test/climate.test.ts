import { describe, expect, it } from 'vitest'
import {
  CLIMATE_CHANNELS,
  CLIMATE_HYPERCUBE_DIMENSION,
  CLIMATE_PARAMETER_COUNT,
  CLIMATE_QUANTIZATION_FACTOR,
  climateParameter,
  climateParameterDistance,
  climateParameterPointFitness,
  climateParameterRange,
  climateParameterSpace,
  climateParameterSpan,
  climateParameters,
  climateTarget,
  createClimateParameterFromQuantized,
  createClimateParameterList,
  createClimateParameterPointFromQuantized,
  createClimateParameterSpace,
  createClimateSampler,
  createClimateSamplerRuntime,
  createClimateTargetPointFromQuantized,
  createDensityEvaluationContext,
  createDensityEvaluationSession,
  densityConstant,
  empty,
  findClimateSpawnPosition,
  findClimateValue,
  findClimateValueBruteForce,
  findClimateValueIndex,
  findSpawnPosition,
  isClimateParameter,
  isClimateParameterPoint,
  isClimateSampler,
  isClimateTargetPoint,
  parameterPoint,
  parameters,
  point,
  quantizeCoord,
  requireClimateParameter,
  requireClimateParameterList,
  requireClimateParameterPoint,
  requireClimateSampler,
  sampleClimate,
  sampleClimateAt,
  span,
  target,
  unquantizeCoord,
  type ClimateParameterPoint,
  type ClimateParameterSpace,
  type ClimateSampler,
} from '../src/index.js'
import { createClimateRTree } from '../src/domain/climate-rtree.js'

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
    expect(() => quantizeCoord(Number.NaN)).toThrow('coordinate must be finite')
    expect(() => unquantizeCoord('bad' as never)).toThrow(
      'quantized coordinate must be a number',
    )
    expect(() => quantizeCoord(Number.MAX_VALUE)).toThrow(
      'coordinate must be a safe integer',
    )
    expect(() => unquantizeCoord(1.5)).toThrow(
      'quantized coordinate must be a safe integer',
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
    expect(requireClimateParameter('parameter', { min: 0, max: 1 })).toEqual({
      min: 0,
      max: 1,
    })
    expect(() => requireClimateParameter('parameter', null)).toThrow(
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
    expect(requireClimateParameterPoint('point', fromSpace)).toEqual(fromSpace)
    expect(() => requireClimateParameterPoint('point', null)).toThrow(
      'point must be a ClimateParameterPoint',
    )
    expect(isClimateTargetPoint(null)).toBe(false)
    expect(isClimateTargetPoint({ ...targetFromQuantized, temperature: 1.5 })).toBe(false)
    expect(() => createClimateTargetPointFromQuantized(1.5, 2, 3, 4, 5, 6)).toThrow(
      'temperature must be a safe integer',
    )
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
    ] as const, climateParameterPointFitness)
    expect(splitTree.search(zeroTarget)).toBe('zero')

    const unitPoint = climateParameters(1, 1, 1, 1, 1, 1, 0)
    const directionalTree = createClimateRTree([
      [zeroPoint, 'zero'],
      [unitPoint, 'unit'],
    ] as const, climateParameterPointFitness)
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
      Number(candidate.temperature.min === -10_000))
    expect(tieTree.search(zeroTarget)).toBe('second')

    const emptyTree = createClimateRTree([], climateParameterPointFitness)
    expect(emptyTree.search(zeroTarget)).toBeUndefined()
    expect(emptyTree.searchIndex(zeroTarget)).toBeUndefined()
    expect(() => createClimateRTree(null as never, climateParameterPointFitness)).toThrow(
      'RTree entries must be an array',
    )
    expect(() => createClimateRTree([], null as never)).toThrow(
      'RTree fitness must be a function',
    )
  })
})

describe('Climate samplers and spawn search', () => {
  it('samples all six channels through direct, context, and session evaluators', () => {
    const sampler = makeSampler()
    const position = { x: 1, y: 2, z: 3 }
    const context = createDensityEvaluationContext()
    const session = createDensityEvaluationSession(context)
    expect(sampleClimate(sampler, position)).toEqual(zeroTarget)
    expect(sampleClimate(sampler, position, context)).toEqual(zeroTarget)
    expect(sampleClimate(sampler, position, session)).toEqual(zeroTarget)
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
    expect(() => sampleClimate(sampler, position, null as never)).toThrow(
      'evaluation context must be an object',
    )
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
      origin: { x: 10, y: 20, z: 30 },
      radius: 0,
      verticalRadius: 0,
      step: 1,
    })).toEqual({ x: 10, y: 20, z: 30 })
    expect(() => runtime.sample(1.5, 2, 3)).toThrow(
      'x must be a safe integer',
    )
    expect(() => sampleClimateAt(emptySampler, 1, 2.5, 3)).toThrow(
      'y must be a safe integer',
    )
  })

  it('uses the configured spawn target and returns the best bounded block', () => {
    const sampler = makeSampler([zeroPoint])
    expect(findClimateSpawnPosition(sampler, globalThis.undefined, {
      origin: { x: 10, y: 20, z: 30 },
      radius: 0,
      verticalRadius: 0,
      step: 1,
    })).toEqual({ x: 10, y: 20, z: 30 })
    expect(findSpawnPosition([zeroPoint], sampler, {
      origin: { x: 1, y: 2, z: 3 },
      radius: 0,
      verticalRadius: 0,
      step: 1,
      context: createDensityEvaluationSession(createDensityEvaluationContext()),
    })).toEqual({ x: 1, y: 2, z: 3 })
    expect(findClimateSpawnPosition(makeSampler())).toBeUndefined()
    expect(() => findClimateSpawnPosition(sampler, [null as never], {
      radius: 0,
      verticalRadius: 0,
    })).toThrow('targets[0] must be a ClimateParameterPoint')
    expect(() => findClimateSpawnPosition(sampler, [], null as never)).toThrow(
      'search options must be an object',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { step: 0 })).toThrow(
      'step must be positive',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { radius: -1 })).toThrow(
      'radius must be non-negative',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { verticalRadius: -1 })).toThrow(
      'verticalRadius must be non-negative',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { origin: null as never })).toThrow(
      'origin must be an object',
    )
    expect(() => findClimateSpawnPosition(sampler, [], {
      origin: { x: 1.5, y: 0, z: 0 },
    })).toThrow('origin.x must be a safe integer')
  })

  it('covers default search bounds and rejects invalid integer options', () => {
    const sampler = makeSampler([zeroPoint])
    expect(findClimateSpawnPosition(sampler)).toBeDefined()
    expect(() => findClimateSpawnPosition(sampler, [], { radius: 1.5 })).toThrow(
      'radius must be a safe integer',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { radius: null as never })).toThrow(
      'radius must be a number',
    )
    expect(() => findClimateSpawnPosition(sampler, [], { step: Number.NaN })).toThrow(
      'step must be a safe integer',
    )
    expect(() => findClimateSpawnPosition(sampler, [], {
      origin: { x: Number.NaN, y: 0, z: 0 },
    })).toThrow('origin.x must be a safe integer')
  })
})
