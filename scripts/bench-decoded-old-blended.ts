import {
  createDensityOldBlendedNoiseSource,
  decodeDensityFunction,
  densityOldBlendedNoise,
  encodeDensityFunction,
  type DensityFunction,
} from '../src/index.js'
import { evaluateDensityFunction } from '../src/domain/density-function-evaluator.js'
import { requireDefined } from '../src/domain/defined.js'
import { measureInterleaved, type MeasureOptions } from './bench-harness.js'

const OPTIONS: MeasureOptions = {
  iterations: 100_000,
  runs: 5,
  warmupIterations: 2,
}

const mainOctave = { sample: (x: number, y: number, z: number, yScale: number, yMax: number) => x + y + z + yScale + yMax }
const minLimitOctave = { sample: (x: number, y: number, z: number, yScale: number, yMax: number) => x - y + z + yScale + yMax }
const maxLimitOctave = { sample: (x: number, y: number, z: number, yScale: number, yMax: number) => x + y - z + yScale + yMax }

const source = createDensityOldBlendedNoiseSource(
  {
    mainNoise: () => mainOctave,
    minLimitNoise: () => minLimitOctave,
    maxLimitNoise: () => maxLimitOctave,
  },
  { minValue: -10_000, maxValue: 10_000 },
)
const direct = densityOldBlendedNoise(source, {
  xzScale: 0.25,
  yScale: 0.5,
  xzFactor: 80,
  yFactor: 160,
  smearScaleMultiplier: 4,
})
const encoded = encodeDensityFunction(direct, {
  encodeOldBlendedNoiseSource: () => 'old-source',
})
const decoded = decodeDensityFunction(encoded, {
  decodeOldBlendedNoiseSource: () => source,
})
const position = { x: 12.5, y: 31.75, z: -7.25 }
let sink = 0

const evaluate = (density: DensityFunction): void => {
  sink = (sink + evaluateDensityFunction(density, position)) % 1_000_000_007
}

const measurements = measureInterleaved(
  [
    () => evaluate(direct),
    () => evaluate(decoded),
  ],
  OPTIONS,
)
const directMs = requireDefined(measurements[0], 'direct benchmark measurement')
const decodedMs = requireDefined(measurements[1], 'decoded benchmark measurement')

console.log(`old-blended-noise direct=${directMs.toFixed(6)} ms decoded=${decodedMs.toFixed(6)} ms ratio=${(decodedMs / directMs).toFixed(3)}x sink=${sink.toFixed(3)}`)
