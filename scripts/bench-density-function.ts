/**
 * Measure the public density-function pipeline on one deterministic workload.
 *
 * This deliberately covers the layers that the scalar-noise benchmark cannot
 * reach: composite evaluation, interpolation and cell caching, all NoiseRouter
 * channels, Climate's six-dimensional search, and Blender callbacks.
 */
import { Option, Result } from 'effect'
import { PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import {
  ClimateValue,
  DensityBound,
  DensityCellSize,
  DensityScale,
  DensityValue,
  NOISE_ROUTER_CHANNELS,
  climateParameters,
  createBlender,
  createClimateParameterList,
  createClimateSampler,
  createDensityEvaluationContext,
  createDensityEvaluationContextFromBlender,
  createDensityEvaluationSession,
  createDensityNoiseSource,
  createNoiseRouter,
  densityAdd,
  densityBlendAlpha,
  densityBlendDensity,
  densityBlendOffset,
  densityCacheAllInCell,
  densityConstant,
  densityCoordinate,
  densityInterpolated,
  densityMul,
  densityNoise,
  evaluateNoiseRouter,
  findClimateValue,
  sampleClimate,
  type DensityEvaluationSession,
  type DensityFunction,
  type DensityPosition,
  type NoiseRouter,
} from '../src/index.js'
import { CHUNKS_ON_LOAD, measure, type MeasureOptions } from './bench-harness.js'

const POINTS_PER_CHUNK = 8
const CLIMATE_ENTRY_COUNT = 64
const OPTIONS: MeasureOptions = {
  iterations: 2,
  runs: 5,
  warmupIterations: 1,
}

const requireSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value =>
  Result.getOrThrow(result)

let sink = 0

const consume = (value: number): void => {
  sink = (sink + value) % 1_000_000_007
}

const constant = (value: number): DensityFunction =>
  requireSuccess(densityConstant(DensityValue(value)))

const coordinate = (axis: 'x' | 'y' | 'z', scale: number): DensityFunction =>
  requireSuccess(densityCoordinate(axis, { scale: DensityScale(scale) }))

const add = (left: DensityFunction, right: DensityFunction): DensityFunction =>
  requireSuccess(densityAdd(left, right))

const multiply = (left: DensityFunction, right: DensityFunction): DensityFunction =>
  requireSuccess(densityMul(left, right))

const samplePositions: ReadonlyArray<DensityPosition> = Object.freeze(
  Array.from(
    { length: CHUNKS_ON_LOAD * POINTS_PER_CHUNK },
    (_, index) => {
      const chunk = Math.floor(index / POINTS_PER_CHUNK)
      const local = index % POINTS_PER_CHUNK
      return Object.freeze({
        x: PositionAxis(chunk * 16 + (local % 4) * 4),
        y: PositionAxis(32 + Math.floor(local / 4) * 16),
        z: PositionAxis(-chunk * 16 + (local % 4) * 4),
      })
    },
  ),
)

const cachedPositions: ReadonlyArray<DensityPosition> = Object.freeze([
  ...samplePositions,
  ...samplePositions,
  ...samplePositions,
  ...samplePositions,
])

const evaluateMany = (
  density: DensityFunction,
  session: DensityEvaluationSession,
  positions: ReadonlyArray<DensityPosition>,
): void => {
  session.clear()
  let total = 0
  for (const position of positions) {
    total += requireSuccess(session.evaluate(density, position))
  }
  consume(total)
}

const evaluateRouterMany = (
  router: NoiseRouter,
  session: DensityEvaluationSession,
): void => {
  session.clear()
  let total = 0
  for (const position of cachedPositions) {
    const values = requireSuccess(evaluateNoiseRouter(router, position, session))
    for (const channel of NOISE_ROUTER_CHANNELS) {
      total += values[channel]
    }
  }
  consume(total)
}

const createClimateEntries = () =>
  Array.from({ length: CLIMATE_ENTRY_COUNT }, (_, index) => {
    const axisValue = (offset: number): number =>
      ((index + offset) % 9) / 4 - 1
    return [
      requireSuccess(climateParameters(
        ClimateValue(axisValue(0)),
        ClimateValue(axisValue(1)),
        ClimateValue(axisValue(2)),
        ClimateValue(axisValue(3)),
        ClimateValue(axisValue(4)),
        ClimateValue(axisValue(5)),
        ClimateValue((index % 7) / 10),
      )),
      index,
    ] as const
  })

const source = requireSuccess(createDensityNoiseSource(
  (x, y, z) =>
    Math.sin(x * 0.01) + Math.cos(y * 0.02) + Math.sin(z * 0.015),
  { maxValue: DensityBound(3), minValue: DensityBound(-3) },
))
const noise = requireSuccess(densityNoise(source, {
  xzScale: DensityScale(0.015),
  yScale: DensityScale(0.02),
}))
const composite = multiply(
  add(noise, coordinate('x', 0.001)),
  add(constant(0.5), coordinate('y', 0.002)),
)
const interpolated = densityCacheAllInCell(densityInterpolated(composite))

const blender = requireSuccess(createBlender({
  blendDensity: (_position, density) =>
    Result.succeed(DensityValue(density * 0.9 + 0.25)),
  blendOffsetAndFactor: (x, z) => Result.succeed({
    alpha: DensityValue(0.5 + 0.25 * Math.sin(x * 0.01)),
    blendingOffset: DensityValue(Math.cos(z * 0.01)),
  }),
}))
const blenderSession = requireSuccess(createDensityEvaluationSession(
  requireSuccess(createDensityEvaluationContextFromBlender(blender, {
    cellHeight: DensityCellSize(16),
    cellWidth: DensityCellSize(4),
  })),
))
const blended = add(
  densityBlendDensity(composite),
  add(densityBlendAlpha(), densityBlendOffset()),
)

const router = requireSuccess(createNoiseRouter(
  Object.fromEntries(
    NOISE_ROUTER_CHANNELS.map((channel, index) => [
      channel,
      add(composite, constant(index * 0.01)),
    ]),
  ) as NoiseRouter,
))
const climateSampler = requireSuccess(createClimateSampler({
  continentalness: coordinate('x', 0.01),
  depth: constant(0.25),
  erosion: coordinate('z', 0.01),
  humidity: noise,
  temperature: composite,
  weirdness: add(noise, constant(0.5)),
}))
const climateList = requireSuccess(createClimateParameterList(createClimateEntries()))
const climateSession = requireSuccess(createDensityEvaluationSession(
  requireSuccess(createDensityEvaluationContext({
    cellHeight: DensityCellSize(16),
    cellWidth: DensityCellSize(4),
  })),
))

const evaluateClimateMany = (): void => {
  climateSession.clear()
  let total = 0
  for (const position of cachedPositions) {
    const target = requireSuccess(sampleClimate(climateSampler, position, climateSession))
    const found = requireSuccess(findClimateValue(climateList, target))
    if (Option.isSome(found)) {
      total += found.value
    } else {
      total -= 1
    }
  }
  consume(total)
}

const measurements: ReadonlyArray<Readonly<{
  readonly name: string
  readonly run: () => void
  readonly detail: string
}>> = [
  {
    detail: `${samplePositions.length} points`,
    name: 'density/composite',
    run: () => evaluateMany(composite, climateSession, samplePositions),
  },
  {
    detail: `${cachedPositions.length} points with repeated cells`,
    name: 'density/interpolated-cache',
    run: () => evaluateMany(interpolated, climateSession, cachedPositions),
  },
  {
    detail: `${cachedPositions.length} points × ${NOISE_ROUTER_CHANNELS.length} channels`,
    name: 'noise-router/all-channels',
    run: () => evaluateRouterMany(router, climateSession),
  },
  {
    detail: `${cachedPositions.length} points × ${CLIMATE_ENTRY_COUNT} R-tree entries`,
    name: 'climate/sampling-search',
    run: evaluateClimateMany,
  },
  {
    detail: `${samplePositions.length} points × 3 Blender callbacks`,
    name: 'density/blender-callbacks',
    run: () => evaluateMany(blended, blenderSession, samplePositions),
  },
]

console.log(
  `density benchmark: ${samplePositions.length} points (${CHUNKS_ON_LOAD} initial-load chunks)`,
)
for (const measurement of measurements) {
  const milliseconds = measure(measurement.run, OPTIONS)
  console.log(
    `${measurement.name.padEnd(30)} ${milliseconds.toFixed(3)} ms/run — ${measurement.detail}`,
  )
}
console.log(`sink=${sink.toFixed(3)}`)
