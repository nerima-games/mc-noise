import type { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { BoundedNoise } from './octaves.js'
import { CHUNK_SIZE_XZ } from '@nerima-games/mc-kernel'
import type { NoiseFn2D } from './perlin.js'
import { Result } from 'effect'
import { peaksAndValleysFromWeirdness } from './transforms.js'
import { requireSafeInteger } from './number-validation.js'

export const CHUNK_COLUMN_SAMPLE_COUNT: number = CHUNK_SIZE_XZ * CHUNK_SIZE_XZ

export const TERRAIN_SAMPLE_STEP = 2
const SAMPLE_INDEX_STEP = 1
const UNIT_WEIGHT = 1
const SPARSE_GRID_OFFSET = 1
const TERRAIN_SPARSE_GRID_SIZE = CHUNK_SIZE_XZ / TERRAIN_SAMPLE_STEP + SPARSE_GRID_OFFSET
const TERRAIN_SPARSE_SAMPLE_COUNT = TERRAIN_SPARSE_GRID_SIZE * TERRAIN_SPARSE_GRID_SIZE
const FLOAT64_BYTES = Float64Array.BYTES_PER_ELEMENT
const FLOAT64_LITTLE_ENDIAN = true
const NO_RESULT_VALUE: void = globalThis.undefined

export const SCALE_C = 0.0005
export const SCALE_E = 0.001
export const SCALE_W = 0.002
export const SCALE_J = 0.02

export const toPV: typeof peaksAndValleysFromWeirdness = peaksAndValleysFromWeirdness

export type TerrainChannelSamples = Readonly<{
  continentalness: Float64Array
  erosion: Float64Array
  jaggedness: Float64Array
  pv: Float64Array
}>

type TerrainNoiseFunctions = Readonly<{
  continentalness: NoiseFn2D
  erosion: NoiseFn2D
  jaggedness: NoiseFn2D
  weirdness: NoiseFn2D
}>

type SparseSamples = Readonly<{
  readonly values: DataView
}>

type SparseTerrainChannels = {
  continentalness: SparseSamples
  erosion: SparseSamples
  jaggedness: SparseSamples
  weirdness: SparseSamples
}

type TerrainOrigin = Readonly<{
  xStart: BlockAxis
  zStart: BlockAxis
}>

type SparseSamplingContext = Readonly<{
  noiseFunctions: TerrainNoiseFunctions
  sparse: SparseTerrainChannels
  origin: TerrainOrigin
}>

const createSparseSamples = (): SparseSamples => ({
  values: new DataView(new ArrayBuffer(TERRAIN_SPARSE_SAMPLE_COUNT * FLOAT64_BYTES)),
})

const createSparseTerrainChannels = (): SparseTerrainChannels => ({
  continentalness: createSparseSamples(),
  erosion: createSparseSamples(),
  jaggedness: createSparseSamples(),
  weirdness: createSparseSamples(),
})

const blendSparseChannelSample = (
  values: DataView,
  baseIndex: number,
  xWeight: number,
  zWeight: number,
): number => {
  const inverseXWeight = UNIT_WEIGHT - xWeight
  const inverseZWeight = UNIT_WEIGHT - zWeight
  const read = (index: number): number => values.getFloat64(index * FLOAT64_BYTES, FLOAT64_LITTLE_ENDIAN)
  return (
    inverseXWeight * inverseZWeight * read(baseIndex) +
    xWeight * inverseZWeight * read(baseIndex + TERRAIN_SPARSE_GRID_SIZE) +
    inverseXWeight * zWeight * read(baseIndex + SPARSE_GRID_OFFSET) +
    xWeight * zWeight * read(baseIndex + TERRAIN_SPARSE_GRID_SIZE + SPARSE_GRID_OFFSET)
  )
}

type SampledTerrainValues = Readonly<{
  continentalness: number
  erosion: number
  jaggedness: number
  weirdness: number
}>

const sampleTerrainValues = (
  noiseFunctions: TerrainNoiseFunctions,
  worldX: number,
  worldZ: number,
): SampledTerrainValues => ({
  continentalness: noiseFunctions.continentalness(worldX * SCALE_C, worldZ * SCALE_C),
  erosion: noiseFunctions.erosion(worldX * SCALE_E, worldZ * SCALE_E),
  jaggedness: noiseFunctions.jaggedness(worldX * SCALE_J, worldZ * SCALE_J),
  weirdness: noiseFunctions.weirdness(worldX * SCALE_W, worldZ * SCALE_W),
})

const storeSparseTerrainValues = (
  sparse: SparseTerrainChannels,
  sparseIndex: number,
  values: SampledTerrainValues,
): void => {
  sparse.continentalness.values.setFloat64(sparseIndex * FLOAT64_BYTES, values.continentalness, FLOAT64_LITTLE_ENDIAN)
  sparse.erosion.values.setFloat64(sparseIndex * FLOAT64_BYTES, values.erosion, FLOAT64_LITTLE_ENDIAN)
  sparse.jaggedness.values.setFloat64(sparseIndex * FLOAT64_BYTES, values.jaggedness, FLOAT64_LITTLE_ENDIAN)
  sparse.weirdness.values.setFloat64(sparseIndex * FLOAT64_BYTES, values.weirdness, FLOAT64_LITTLE_ENDIAN)
}

const sampleSparsePoint = (
  context: SparseSamplingContext,
  sparseX: number,
  sparseZ: number,
): void => {
  const worldX = context.origin.xStart + sparseX * TERRAIN_SAMPLE_STEP
  const worldZ = context.origin.zStart + sparseZ * TERRAIN_SAMPLE_STEP
  const sparseIndex = sparseX * TERRAIN_SPARSE_GRID_SIZE + sparseZ
  storeSparseTerrainValues(context.sparse, sparseIndex, sampleTerrainValues(context.noiseFunctions, worldX, worldZ))
}

const sampleSparseRow = (
  context: SparseSamplingContext,
  sparseX: number,
): void => {
  for (let sparseZ = 0; sparseZ < TERRAIN_SPARSE_GRID_SIZE; sparseZ += SAMPLE_INDEX_STEP) {
    sampleSparsePoint(context, sparseX, sparseZ)
  }
}

const sampleSparseChannels = (
  noiseFunctions: TerrainNoiseFunctions,
  origin: TerrainOrigin,
): SparseTerrainChannels => {
  const sparse = createSparseTerrainChannels()
  const context = { noiseFunctions, origin, sparse }
  for (let sparseX = 0; sparseX < TERRAIN_SPARSE_GRID_SIZE; sparseX += SAMPLE_INDEX_STEP) {
    sampleSparseRow(context, sparseX)
  }
  return sparse
}

const createTerrainChannelSamples = (): TerrainChannelSamples => ({
  continentalness: new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT),
  erosion: new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT),
  jaggedness: new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT),
  pv: new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT),
})

const writeExpandedSample = (
  sparse: SparseTerrainChannels,
  output: TerrainChannelSamples,
  x: number,
  z: number,
): Result.Result<void, RangeError> => {
  const sparseZ = Math.floor(z / TERRAIN_SAMPLE_STEP),
    zWeight = (z % TERRAIN_SAMPLE_STEP) / TERRAIN_SAMPLE_STEP,
    sparseX = Math.floor(x / TERRAIN_SAMPLE_STEP),
    xWeight = (x % TERRAIN_SAMPLE_STEP) / TERRAIN_SAMPLE_STEP,
    baseIndex = sparseX * TERRAIN_SPARSE_GRID_SIZE + sparseZ,
    outputIndex = z * CHUNK_SIZE_XZ + x,
    weirdness = blendSparseChannelSample(sparse.weirdness.values, baseIndex, xWeight, zWeight)

  const boundedWeirdness = Result.mapError(
    BoundedNoise.result(weirdness),
    (error) => new RangeError(error.message),
  )
  if (Result.isFailure(boundedWeirdness)) {
    return Result.fail(boundedWeirdness.failure)
  }

  output.continentalness[outputIndex] = blendSparseChannelSample(
    sparse.continentalness.values,
    baseIndex,
    xWeight,
    zWeight,
  )
  output.erosion[outputIndex] = blendSparseChannelSample(sparse.erosion.values, baseIndex, xWeight, zWeight)
  output.jaggedness[outputIndex] = blendSparseChannelSample(sparse.jaggedness.values, baseIndex, xWeight, zWeight)
  output.pv[outputIndex] = toPV(boundedWeirdness.success)
  return Result.succeed(NO_RESULT_VALUE)
}

const expandTerrainRow = (
  sparse: SparseTerrainChannels,
  output: TerrainChannelSamples,
  z: number,
): Result.Result<void, RangeError> => {
  for (let x = 0; x < CHUNK_SIZE_XZ; x += SAMPLE_INDEX_STEP) {
    const written = writeExpandedSample(sparse, output, x, z)
    if (Result.isFailure(written)) {
      return Result.fail(written.failure)
    }
  }
  return Result.succeed(NO_RESULT_VALUE)
}

const expandTerrainChannels = (sparse: SparseTerrainChannels): Result.Result<TerrainChannelSamples, RangeError> => {
  const output = createTerrainChannelSamples()
  for (let z = 0; z < CHUNK_SIZE_XZ; z += SAMPLE_INDEX_STEP) {
    const expanded = expandTerrainRow(sparse, output, z)
    if (Result.isFailure(expanded)) {
      return Result.fail(expanded.failure)
    }
  }
  return Result.succeed(output)
}

type TerrainChannelArguments = readonly [
  noiseFnContinentalness: NoiseFn2D,
  noiseFnErosion: NoiseFn2D,
  noiseFnWeirdness: NoiseFn2D,
  noiseFnJaggedness: NoiseFn2D,
  xStart: BlockAxis,
  zStart: BlockAxis,
]

export const computeTerrainChannels = (...args: TerrainChannelArguments): Result.Result<TerrainChannelSamples, RangeError> =>
  Result.gen(function* computeTerrainChannelsResult() {
    const [noiseFnContinentalness, noiseFnErosion, noiseFnWeirdness, noiseFnJaggedness, xStart, zStart] = args
    yield* requireSafeInteger(xStart, () => `xStart must be a safe integer, received ${xStart}`)
    yield* requireSafeInteger(zStart, () => `zStart must be a safe integer, received ${zStart}`)
    const noiseFunctions = {
      continentalness: noiseFnContinentalness,
      erosion: noiseFnErosion,
      jaggedness: noiseFnJaggedness,
      weirdness: noiseFnWeirdness,
    }
    return yield* expandTerrainChannels(sampleSparseChannels(noiseFunctions, { xStart, zStart }))
  })
