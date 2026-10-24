import { Result } from 'effect'
import { PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import {
  DensityBound,
  DensityScale,
  DensityValue,
  createDensityOldBlendedNoiseSource,
  decodeDensityFunction,
  densityOldBlendedNoise,
  encodeDensityFunction,
  type DensityFunction,
  type DensityOldBlendedNoiseOctave,
} from '../src/index.js'
import { evaluateDensityFunction } from '../src/domain/density-function-evaluator.js'
import { DefinedValueName, requireDefined } from '../src/domain/defined.js'
import { measureInterleaved, type MeasureOptions } from './bench-harness.js'

const OPTIONS: MeasureOptions = {
  iterations: 100_000,
  runs: 5,
  warmupIterations: 2,
}

const requireSuccess = <Value, Failure>(result: Result.Result<Value, Failure>): Value =>
  Result.getOrThrow(result)

const mainOctave: DensityOldBlendedNoiseOctave = {
  sample: (x, y, z, yScale, yMax) => DensityValue(x + y + z + yScale + yMax),
}
const minLimitOctave: DensityOldBlendedNoiseOctave = {
  sample: (x, y, z, yScale, yMax) => DensityValue(x - y + z + yScale + yMax),
}
const maxLimitOctave: DensityOldBlendedNoiseOctave = {
  sample: (x, y, z, yScale, yMax) => DensityValue(x + y - z + yScale + yMax),
}

const source = requireSuccess(createDensityOldBlendedNoiseSource(
  {
    mainNoise: () => mainOctave,
    minLimitNoise: () => minLimitOctave,
    maxLimitNoise: () => maxLimitOctave,
  },
  { minValue: DensityBound(-10_000), maxValue: DensityBound(10_000) },
))
const direct = requireSuccess(densityOldBlendedNoise(source, {
  xzScale: DensityScale(0.25),
  yScale: DensityScale(0.5),
  xzFactor: DensityScale(80),
  yFactor: DensityScale(160),
  smearScaleMultiplier: DensityScale(4),
}))
const encoded = requireSuccess(encodeDensityFunction(direct, {
  encodeOldBlendedNoiseSource: () => 'old-source',
}))
const decoded = requireSuccess(decodeDensityFunction(encoded, {
  decodeOldBlendedNoiseSource: () => source,
}))
const position = {
  x: PositionAxis(12.5),
  y: PositionAxis(31.75),
  z: PositionAxis(-7.25),
}
let sink = 0

const evaluate = (density: DensityFunction): void => {
  sink = (sink + requireSuccess(evaluateDensityFunction(density, position))) % 1_000_000_007
}

const measurements = measureInterleaved(
  [
    () => evaluate(direct),
    () => evaluate(decoded),
  ],
  OPTIONS,
)
const directMs = requireSuccess(
  requireDefined(measurements[0], DefinedValueName('direct benchmark measurement')),
)
const decodedMs = requireSuccess(
  requireDefined(measurements[1], DefinedValueName('decoded benchmark measurement')),
)

console.log(`old-blended-noise direct=${directMs.toFixed(6)} ms decoded=${decodedMs.toFixed(6)} ms ratio=${(decodedMs / directMs).toFixed(3)}x sink=${sink.toFixed(3)}`)
