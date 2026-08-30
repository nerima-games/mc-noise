import { CHUNK_SIZE_XZ } from '@nerima-games/mc-kernel'
import type { NoiseFn2D } from './perlin.js'
import { peaksAndValleysFromWeirdness } from './transforms.js'
import { requireFiniteNumber } from './number-validation.js'

export const CHUNK_COLUMN_SAMPLE_COUNT: number = CHUNK_SIZE_XZ * CHUNK_SIZE_XZ

export const TERRAIN_SAMPLE_STEP = 2
const SAMPLE_INDEX_STEP = 1
const UNIT_WEIGHT = 1
const SPARSE_GRID_OFFSET = 1
const TERRAIN_SPARSE_GRID_SIZE = CHUNK_SIZE_XZ / TERRAIN_SAMPLE_STEP + SPARSE_GRID_OFFSET
const TERRAIN_SPARSE_SAMPLE_COUNT = TERRAIN_SPARSE_GRID_SIZE * TERRAIN_SPARSE_GRID_SIZE

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

type SparseTerrainChannels = {
  continentalness: Float64Array
  erosion: Float64Array
  jaggedness: Float64Array
  weirdness: Float64Array
}

type TerrainOrigin = Readonly<{
  xStart: number
  zStart: number
}>

const createSparseTerrainChannels = (): SparseTerrainChannels => ({
  continentalness: new Float64Array(TERRAIN_SPARSE_SAMPLE_COUNT),
  erosion: new Float64Array(TERRAIN_SPARSE_SAMPLE_COUNT),
  jaggedness: new Float64Array(TERRAIN_SPARSE_SAMPLE_COUNT),
  weirdness: new Float64Array(TERRAIN_SPARSE_SAMPLE_COUNT),
})

const blendSparseChannelSample = (values: Float64Array, baseIndex: number, xWeight: number, zWeight: number): number => {
  const inverseXWeight = UNIT_WEIGHT - xWeight
  const inverseZWeight = UNIT_WEIGHT - zWeight
  return (
    inverseXWeight * inverseZWeight * values[baseIndex]! +
    xWeight * inverseZWeight * values[baseIndex + TERRAIN_SPARSE_GRID_SIZE]! +
    inverseXWeight * zWeight * values[baseIndex + SPARSE_GRID_OFFSET]! +
    xWeight * zWeight * values[baseIndex + TERRAIN_SPARSE_GRID_SIZE + SPARSE_GRID_OFFSET]!
  )
}

const sampleSparseRow = (
  noiseFunctions: TerrainNoiseFunctions,
  sparse: SparseTerrainChannels,
  sparseX: number,
  origin: TerrainOrigin,
): void => {
  const worldX = origin.xStart + sparseX * TERRAIN_SAMPLE_STEP
  for (let sparseZ = 0; sparseZ < TERRAIN_SPARSE_GRID_SIZE; sparseZ += SAMPLE_INDEX_STEP) {
    const worldZ = origin.zStart + sparseZ * TERRAIN_SAMPLE_STEP
    const sparseIndex = sparseX * TERRAIN_SPARSE_GRID_SIZE + sparseZ
    sparse.continentalness[sparseIndex] = noiseFunctions.continentalness(worldX * SCALE_C, worldZ * SCALE_C)
    sparse.erosion[sparseIndex] = noiseFunctions.erosion(worldX * SCALE_E, worldZ * SCALE_E)
    sparse.jaggedness[sparseIndex] = noiseFunctions.jaggedness(worldX * SCALE_J, worldZ * SCALE_J)
    sparse.weirdness[sparseIndex] = noiseFunctions.weirdness(worldX * SCALE_W, worldZ * SCALE_W)
  }
}

const sampleSparseChannels = (
  noiseFunctions: TerrainNoiseFunctions,
  origin: TerrainOrigin,
): SparseTerrainChannels => {
  const sparse = createSparseTerrainChannels()
  for (let sparseX = 0; sparseX < TERRAIN_SPARSE_GRID_SIZE; sparseX += SAMPLE_INDEX_STEP) {
    sampleSparseRow(noiseFunctions, sparse, sparseX, origin)
  }
  return sparse
}

const createTerrainChannelSamples = (): TerrainChannelSamples => ({
  continentalness: new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT),
  erosion: new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT),
  jaggedness: new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT),
  pv: new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT),
})

const writeExpandedSample = (sparse: SparseTerrainChannels, output: TerrainChannelSamples, x: number, z: number): void => {
  const sparseZ = Math.floor(z / TERRAIN_SAMPLE_STEP),
    zWeight = (z % TERRAIN_SAMPLE_STEP) / TERRAIN_SAMPLE_STEP,
    sparseX = Math.floor(x / TERRAIN_SAMPLE_STEP),
    xWeight = (x % TERRAIN_SAMPLE_STEP) / TERRAIN_SAMPLE_STEP,
    baseIndex = sparseX * TERRAIN_SPARSE_GRID_SIZE + sparseZ,
    outputIndex = z * CHUNK_SIZE_XZ + x,
    weirdness = blendSparseChannelSample(sparse.weirdness, baseIndex, xWeight, zWeight)

  output.continentalness[outputIndex] = blendSparseChannelSample(
    sparse.continentalness,
    baseIndex,
    xWeight,
    zWeight,
  )
  output.erosion[outputIndex] = blendSparseChannelSample(sparse.erosion, baseIndex, xWeight, zWeight)
  output.jaggedness[outputIndex] = blendSparseChannelSample(sparse.jaggedness, baseIndex, xWeight, zWeight)
  output.pv[outputIndex] = toPV(weirdness)
}

const expandTerrainRow = (sparse: SparseTerrainChannels, output: TerrainChannelSamples, z: number): void => {
  for (let x = 0; x < CHUNK_SIZE_XZ; x += SAMPLE_INDEX_STEP) {
    writeExpandedSample(sparse, output, x, z)
  }
}

const expandTerrainChannels = (sparse: SparseTerrainChannels): TerrainChannelSamples => {
  const output = createTerrainChannelSamples()
  for (let z = 0; z < CHUNK_SIZE_XZ; z += SAMPLE_INDEX_STEP) {
    expandTerrainRow(sparse, output, z)
  }
  return output
}

type TerrainChannelArguments = readonly [
  noiseFnContinentalness: NoiseFn2D,
  noiseFnErosion: NoiseFn2D,
  noiseFnWeirdness: NoiseFn2D,
  noiseFnJaggedness: NoiseFn2D,
  xStart: number,
  zStart: number,
]

export const computeTerrainChannels = (...args: TerrainChannelArguments): TerrainChannelSamples => {
  const [noiseFnContinentalness, noiseFnErosion, noiseFnWeirdness, noiseFnJaggedness, xStart, zStart] = args
  requireFiniteNumber('xStart', xStart)
  requireFiniteNumber('zStart', zStart)
  const noiseFunctions = { continentalness: noiseFnContinentalness, erosion: noiseFnErosion, jaggedness: noiseFnJaggedness, weirdness: noiseFnWeirdness }
  const sparse = sampleSparseChannels(noiseFunctions, { xStart, zStart })
  return expandTerrainChannels(sparse)
}
