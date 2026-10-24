import {
  BlockAxis,
  type BlockAxis as BlockAxisValue,
} from '@nerima-games/mc-kernel/domain/coordinates'
import {
  MINECRAFT_RIVER_NOISE_SCALE,
  MINECRAFT_RIVER_WORLD_OFFSET,
} from './minecraft-biome-classifier.config.js'
import {
  type MinecraftBiome,
  MinecraftClimateValue,
  type MinecraftClimateValue as MinecraftClimateValueType,
} from './minecraft-biome.js'
import {
  type MinecraftClimateSample,
  classifyMinecraftBiomeFromClimate,
  minecraftPeaksAndValleysFromWeirdness,
} from './minecraft-biome-classifier.js'
import {
  NoiseChannelLabel,
  NoiseFrequency,
  channelSeed,
  fbm2D,
  valueNoise2D,
} from './value-noise.js'
import {
  OctaveAmplitude,
  OctaveCount,
} from './octaves.js'
import { BoundedNoise } from './noise-primitives.js'
import { NoiseSeed } from './seed.js'
import { Result } from 'effect'

const MINECRAFT_MIN_SURFACE_Y_VALUE = 38
const MINECRAFT_MAX_SURFACE_Y_VALUE = 92
const MINECRAFT_SEA_LEVEL_VALUE = 63

export const MINECRAFT_MIN_SURFACE_Y: BlockAxisValue = BlockAxis(MINECRAFT_MIN_SURFACE_Y_VALUE)
export const MINECRAFT_MAX_SURFACE_Y: BlockAxisValue = BlockAxis(MINECRAFT_MAX_SURFACE_Y_VALUE)
export const MINECRAFT_CONTINENTALNESS_CONTRAST = 1.15
export const MINECRAFT_SEA_LEVEL: BlockAxisValue = BlockAxis(MINECRAFT_SEA_LEVEL_VALUE)
export const MINECRAFT_LAKE_LEVEL: BlockAxisValue = BlockAxis(MINECRAFT_SEA_LEVEL_VALUE)

export type MinecraftTerrainLevels = Readonly<{
  seaLevel: BlockAxisValue
  lakeLevel: BlockAxisValue
}>

export const MINECRAFT_DEFAULT_TERRAIN_LEVELS: MinecraftTerrainLevels = Object.freeze({
  lakeLevel: MINECRAFT_LAKE_LEVEL,
  seaLevel: MINECRAFT_SEA_LEVEL,
})

const UNIT_INTERVAL_MIN = 0
const UNIT_INTERVAL_MAX = 1
const UNIT_INTERVAL_MIDPOINT = 0.5
const BASE_FREQUENCY_VALUE = 1
const CONTINENTALNESS_WAVELENGTH_BLOCKS = 180
const TEMPERATURE_WAVELENGTH_BLOCKS = 320
const HUMIDITY_WAVELENGTH_BLOCKS = 280
const EROSION_WAVELENGTH_BLOCKS = 220
const WEIRDNESS_WAVELENGTH_BLOCKS = 160
const BIPOLAR_SCALE = 2
const BIPOLAR_OFFSET = 1
const CLIMATE_OCTAVES = 2
const CONTINENTALNESS_OCTAVES = 4
const CLIMATE_PERSISTENCE = 0.5

const CONTINENTALNESS_FBM_OPTIONS = Object.freeze({
  frequency: NoiseFrequency(BASE_FREQUENCY_VALUE / CONTINENTALNESS_WAVELENGTH_BLOCKS),
  octaves: OctaveCount(CONTINENTALNESS_OCTAVES),
  persistence: OctaveAmplitude(CLIMATE_PERSISTENCE),
})
const TEMPERATURE_FBM_OPTIONS = Object.freeze({
  frequency: NoiseFrequency(BASE_FREQUENCY_VALUE / TEMPERATURE_WAVELENGTH_BLOCKS),
  octaves: OctaveCount(CLIMATE_OCTAVES),
  persistence: OctaveAmplitude(CLIMATE_PERSISTENCE),
})
const HUMIDITY_FBM_OPTIONS = Object.freeze({
  frequency: NoiseFrequency(BASE_FREQUENCY_VALUE / HUMIDITY_WAVELENGTH_BLOCKS),
  octaves: OctaveCount(CLIMATE_OCTAVES),
  persistence: OctaveAmplitude(CLIMATE_PERSISTENCE),
})
const EROSION_FREQUENCY = NoiseFrequency(BASE_FREQUENCY_VALUE / EROSION_WAVELENGTH_BLOCKS)
const WEIRDNESS_FREQUENCY = NoiseFrequency(BASE_FREQUENCY_VALUE / WEIRDNESS_WAVELENGTH_BLOCKS)
const RIVER_FREQUENCY = NoiseFrequency(BASE_FREQUENCY_VALUE)
const TEMPERATURE_CHANNEL = NoiseChannelLabel('temperature')
const HUMIDITY_CHANNEL = NoiseChannelLabel('humidity')
const CONTINENTALNESS_CHANNEL = NoiseChannelLabel('continentalness')
const EROSION_CHANNEL = NoiseChannelLabel('erosion')
const WEIRDNESS_CHANNEL = NoiseChannelLabel('weirdness')
const RIVER_CHANNEL = NoiseChannelLabel('river')

const stretchUnitInterval = (value: number, contrast: number): number =>
  Math.min(
    UNIT_INTERVAL_MAX,
    Math.max(
      UNIT_INTERVAL_MIN,
      (value - UNIT_INTERVAL_MIDPOINT) * contrast + UNIT_INTERVAL_MIDPOINT,
    ),
  )

const toBipolar = (
  unitValue: MinecraftClimateValueType,
): Result.Result<BoundedNoise, RangeError> =>
  Result.mapError(
    BoundedNoise.result(unitValue * BIPOLAR_SCALE - BIPOLAR_OFFSET),
    (error) => new RangeError(error.message),
  )

const readClimateValue = (
  value: number,
): Result.Result<MinecraftClimateValueType, RangeError> =>
  Result.mapError(
    MinecraftClimateValue.result(value),
    (error) => new RangeError(error.message),
  )

const toPositionNumber = (value: BlockAxisValue): number => value

export const minecraftContinentalnessAt = (
  seed: NoiseSeed,
  wx: BlockAxisValue,
  wz: BlockAxisValue,
): Result.Result<MinecraftClimateValueType, RangeError> =>
  Result.flatMap(
    fbm2D(
      channelSeed(seed, CONTINENTALNESS_CHANNEL),
      toPositionNumber(wx),
      toPositionNumber(wz),
      CONTINENTALNESS_FBM_OPTIONS,
    ),
    readClimateValue,
  )

export const minecraftSurfaceHeightFromContinentalness = (
  continentalness: MinecraftClimateValueType,
): BlockAxisValue =>
  BlockAxis(
    Math.floor(
      MINECRAFT_MIN_SURFACE_Y +
        (MINECRAFT_MAX_SURFACE_Y - MINECRAFT_MIN_SURFACE_Y) *
          stretchUnitInterval(continentalness, MINECRAFT_CONTINENTALNESS_CONTRAST),
    ),
  )

export const minecraftSurfaceHeightAt = (
  seed: NoiseSeed,
  wx: BlockAxisValue,
  wz: BlockAxisValue,
): Result.Result<BlockAxisValue, RangeError> =>
  Result.map(
    minecraftContinentalnessAt(seed, wx, wz),
    minecraftSurfaceHeightFromContinentalness,
  )

const minecraftClimateAtWithContinentalness = (
  seed: NoiseSeed,
  wx: BlockAxisValue,
  wz: BlockAxisValue,
  continentalness: BoundedNoise,
): Result.Result<MinecraftClimateSample, RangeError> =>
  Result.gen(function* resultGenerator() {
    const x = toPositionNumber(wx)
    const z = toPositionNumber(wz)
    const temperature = yield* Result.flatMap(
      fbm2D(
        channelSeed(seed, TEMPERATURE_CHANNEL),
        x,
        z,
        TEMPERATURE_FBM_OPTIONS,
      ),
      readClimateValue,
    )
    const humidity = yield* Result.flatMap(
      fbm2D(
        channelSeed(seed, HUMIDITY_CHANNEL),
        x,
        z,
        HUMIDITY_FBM_OPTIONS,
      ),
      readClimateValue,
    )
    const erosionNoise = yield* Result.flatMap(
      valueNoise2D(
        channelSeed(seed, EROSION_CHANNEL),
        x,
        z,
        EROSION_FREQUENCY,
      ),
      readClimateValue,
    )
    const weirdnessNoise = yield* Result.flatMap(
      valueNoise2D(
        channelSeed(seed, WEIRDNESS_CHANNEL),
        x,
        z,
        WEIRDNESS_FREQUENCY,
      ),
      readClimateValue,
    )
    const erosion = yield* toBipolar(erosionNoise)
    const weirdness = yield* toBipolar(weirdnessNoise)
    const riverNoise = yield* Result.flatMap(
      valueNoise2D(
        channelSeed(seed, RIVER_CHANNEL),
        x * MINECRAFT_RIVER_NOISE_SCALE + MINECRAFT_RIVER_WORLD_OFFSET,
        z * MINECRAFT_RIVER_NOISE_SCALE + MINECRAFT_RIVER_WORLD_OFFSET,
        RIVER_FREQUENCY,
      ),
      readClimateValue,
    )

    return Object.freeze({
      continentalness,
      erosion,
      humidity,
      pv: minecraftPeaksAndValleysFromWeirdness(weirdness),
      riverNoise,
      temperature,
    })
  })

export const minecraftClimateAt = (
  seed: NoiseSeed,
  wx: BlockAxisValue,
  wz: BlockAxisValue,
  continentalness?: MinecraftClimateValueType,
): Result.Result<MinecraftClimateSample, RangeError> =>
  Result.gen(function* resultGenerator() {
    let sampledContinentalness = continentalness
    if (typeof sampledContinentalness === 'undefined') {
      sampledContinentalness = yield* minecraftContinentalnessAt(seed, wx, wz)
    }
    const climateContinentalness = yield* toBipolar(sampledContinentalness)
    return yield* minecraftClimateAtWithContinentalness(
      seed,
      wx,
      wz,
      climateContinentalness,
    )
  })

const OCEAN_BELOW_SEA_LEVEL_MARGIN = 2
const BEACH_ABOVE_SEA_LEVEL_MARGIN = 1

type MinecraftBiomePosition = Readonly<{
  surfaceY: BlockAxisValue
  levels: MinecraftTerrainLevels
}>

const minecraftBiomeForWithClimate = (
  query: MinecraftBiomePosition,
  climate: MinecraftClimateSample,
): MinecraftBiome => {
  if (query.surfaceY < query.levels.seaLevel - OCEAN_BELOW_SEA_LEVEL_MARGIN) {
    return 'OCEAN'
  }
  if (query.surfaceY <= query.levels.seaLevel + BEACH_ABOVE_SEA_LEVEL_MARGIN) {
    return 'BEACH'
  }
  return classifyMinecraftBiomeFromClimate(climate)
}

export type MinecraftSurfaceBiome = Readonly<{
  biome: MinecraftBiome
  surfaceY: BlockAxisValue
}>

export const minecraftSurfaceBiomeAt = (
  seed: NoiseSeed,
  wx: BlockAxisValue,
  wz: BlockAxisValue,
  levels: MinecraftTerrainLevels = MINECRAFT_DEFAULT_TERRAIN_LEVELS,
): Result.Result<MinecraftSurfaceBiome, RangeError> =>
  Result.gen(function* resultGenerator() {
    const continentalness = yield* minecraftContinentalnessAt(seed, wx, wz)
    const surfaceY = minecraftSurfaceHeightFromContinentalness(continentalness)
    const climate = yield* minecraftClimateAt(seed, wx, wz, continentalness)
    return Object.freeze({
      biome: minecraftBiomeForWithClimate({ levels, surfaceY }, climate),
      surfaceY,
    })
  })

export type MinecraftBiomeQuery = Readonly<{
  levels?: MinecraftTerrainLevels
  seed: NoiseSeed
  surfaceY: BlockAxisValue
  wx: BlockAxisValue
  wz: BlockAxisValue
}>

export const minecraftBiomeFor = ({
  levels = MINECRAFT_DEFAULT_TERRAIN_LEVELS,
  seed,
  surfaceY,
  wx,
  wz,
}: MinecraftBiomeQuery): Result.Result<MinecraftBiome, RangeError> =>
  Result.gen(function* resultGenerator() {
    const continentalness = yield* minecraftContinentalnessAt(seed, wx, wz)
    const climateContinentalness = yield* toBipolar(continentalness)
    const climate = yield* minecraftClimateAtWithContinentalness(
      seed,
      wx,
      wz,
      climateContinentalness,
    )
    return minecraftBiomeForWithClimate({ levels, surfaceY }, climate)
  })
