/**
 * Measure the public density-function pipeline on one deterministic workload.
 *
 * This deliberately covers the layers that the scalar-noise benchmark cannot
 * reach: composite evaluation, interpolation and cell caching, all NoiseRouter
 * channels, Climate's six-dimensional search, and Blender callbacks.
 */
import {
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

let sink = 0

const consume = (value: number): void => {
  sink = (sink + value) % 1_000_000_007
}

const samplePositions: ReadonlyArray<DensityPosition> = Object.freeze(
  Array.from(
    { length: CHUNKS_ON_LOAD * POINTS_PER_CHUNK },
    (_, index) => {
      const chunk = Math.floor(index / POINTS_PER_CHUNK)
      const local = index % POINTS_PER_CHUNK
      return Object.freeze({
        x: chunk * 16 + (local % 4) * 4,
        y: 32 + Math.floor(local / 4) * 16,
        z: -chunk * 16 + (local % 4) * 4,
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
    total += session.evaluate(density, position)
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
    const values = evaluateNoiseRouter(router, position, session)
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
      climateParameters(
        axisValue(0),
        axisValue(1),
        axisValue(2),
        axisValue(3),
        axisValue(4),
        axisValue(5),
        (index % 7) / 10,
      ),
      index,
    ] as const
  })

const source = createDensityNoiseSource(
  (x, y, z) =>
    Math.sin(x * 0.01) + Math.cos(y * 0.02) + Math.sin(z * 0.015),
  { maxValue: 3, minValue: -3 },
)
const noise = densityNoise(source, { xzScale: 0.015, yScale: 0.02 })
const composite = densityMul(
  densityAdd(noise, densityCoordinate('x', { scale: 0.001 })),
  densityAdd(densityConstant(0.5), densityCoordinate('y', { scale: 0.002 })),
)
const interpolated = densityCacheAllInCell(densityInterpolated(composite))

const blender = createBlender({
  blendDensity: (_position, density) => density * 0.9 + 0.25,
  blendOffsetAndFactor: (x, z) => ({
    alpha: 0.5 + 0.25 * Math.sin(x * 0.01),
    blendingOffset: Math.cos(z * 0.01),
  }),
})
const blenderSession = createDensityEvaluationSession(
  createDensityEvaluationContextFromBlender(blender),
)
const blended = densityAdd(
  densityBlendDensity(composite),
  densityAdd(densityBlendAlpha(), densityBlendOffset()),
)

const router = createNoiseRouter(
  Object.fromEntries(
    NOISE_ROUTER_CHANNELS.map((channel, index) => [
      channel,
      densityAdd(composite, densityConstant(index * 0.01)),
    ]),
  ) as NoiseRouter,
)
const climateSampler = createClimateSampler({
  continentalness: densityCoordinate('x', { scale: 0.01 }),
  depth: densityConstant(0.25),
  erosion: densityCoordinate('z', { scale: 0.01 }),
  humidity: noise,
  temperature: composite,
  weirdness: densityAdd(noise, densityConstant(0.5)),
})
const climateList = createClimateParameterList(createClimateEntries())
const climateSession = createDensityEvaluationSession(
  createDensityEvaluationContext(),
)

const evaluateClimateMany = (): void => {
  climateSession.clear()
  let total = 0
  for (const position of cachedPositions) {
    const target = sampleClimate(climateSampler, position, climateSession)
    total += findClimateValue(climateList, target) ?? -1
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
