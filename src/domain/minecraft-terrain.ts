import {
  MINECRAFT_RIVER_NOISE_SCALE,
  MINECRAFT_RIVER_WORLD_OFFSET,
} from './minecraft-biome-classifier.config.js'
import {
  type MinecraftClimateSample,
  classifyMinecraftBiomeFromClimate,
  minecraftPeaksAndValleysFromWeirdness,
} from './minecraft-biome-classifier.js'
import { channelSeed, fbm2D, valueNoise2D } from './value-noise.js'
import type { MinecraftBiome } from './minecraft-biome.js'

export const MINECRAFT_MIN_SURFACE_Y = 38
export const MINECRAFT_MAX_SURFACE_Y = 92
export const MINECRAFT_CONTINENTALNESS_CONTRAST = 1.15
export const MINECRAFT_SEA_LEVEL = 63
export const MINECRAFT_LAKE_LEVEL = 63

export type MinecraftTerrainLevels = Readonly<{
  seaLevel: number
  lakeLevel: number
}>

export const MINECRAFT_DEFAULT_TERRAIN_LEVELS: MinecraftTerrainLevels = {
  lakeLevel: MINECRAFT_LAKE_LEVEL,
  seaLevel: MINECRAFT_SEA_LEVEL,
}

const UNIT_INTERVAL_MIN = 0
const UNIT_INTERVAL_MAX = 1
const UNIT_INTERVAL_MIDPOINT = 0.5
const NOISE_FREQUENCY_UNIT = 1
const CONTINENTALNESS_WAVELENGTH_BLOCKS = 180
const TEMPERATURE_WAVELENGTH_BLOCKS = 320
const HUMIDITY_WAVELENGTH_BLOCKS = 280
const EROSION_WAVELENGTH_BLOCKS = 220
const WEIRDNESS_WAVELENGTH_BLOCKS = 160
const RIVER_NOISE_UNIT_FREQUENCY = 1
const BIPOLAR_SCALE = 2
const BIPOLAR_OFFSET = 1

const stretchUnitInterval = (value: number, contrast: number): number =>
  Math.min(
    UNIT_INTERVAL_MAX,
    Math.max(
      UNIT_INTERVAL_MIN,
      (value - UNIT_INTERVAL_MIDPOINT) * contrast + UNIT_INTERVAL_MIDPOINT,
    ),
  )

const toBipolar = (unitValue: number): number => unitValue * BIPOLAR_SCALE - BIPOLAR_OFFSET

export const minecraftContinentalnessAt = (seed: number, wx: number, wz: number): number =>
  fbm2D(channelSeed(seed, 'continentalness'), wx, wz, {
    frequency: NOISE_FREQUENCY_UNIT / CONTINENTALNESS_WAVELENGTH_BLOCKS,
    octaves: 4,
    persistence: 0.5,
  })

export const minecraftSurfaceHeightFromContinentalness = (continentalness: number): number =>
  Math.floor(
    MINECRAFT_MIN_SURFACE_Y +
      (MINECRAFT_MAX_SURFACE_Y - MINECRAFT_MIN_SURFACE_Y) *
        stretchUnitInterval(continentalness, MINECRAFT_CONTINENTALNESS_CONTRAST),
  )

export const minecraftSurfaceHeightAt = (seed: number, wx: number, wz: number): number =>
  minecraftSurfaceHeightFromContinentalness(minecraftContinentalnessAt(seed, wx, wz))

const minecraftClimateAtWithContinentalness = (
  seed: number,
  wx: number,
  wz: number,
  continentalness: number,
): MinecraftClimateSample => {
  const temperature = fbm2D(channelSeed(seed, 'temperature'), wx, wz, {
    frequency: NOISE_FREQUENCY_UNIT / TEMPERATURE_WAVELENGTH_BLOCKS,
    octaves: 2,
    persistence: 0.5,
  })
  const humidity = fbm2D(channelSeed(seed, 'humidity'), wx, wz, {
    frequency: NOISE_FREQUENCY_UNIT / HUMIDITY_WAVELENGTH_BLOCKS,
    octaves: 2,
    persistence: 0.5,
  })
  const erosion = toBipolar(
    valueNoise2D(
      channelSeed(seed, 'erosion'),
      wx,
      wz,
      NOISE_FREQUENCY_UNIT / EROSION_WAVELENGTH_BLOCKS,
    ),
  )
  const weirdness = toBipolar(
    valueNoise2D(
      channelSeed(seed, 'weirdness'),
      wx,
      wz,
      NOISE_FREQUENCY_UNIT / WEIRDNESS_WAVELENGTH_BLOCKS,
    ),
  )
  const riverNoise = valueNoise2D(
    channelSeed(seed, 'river'),
    wx * MINECRAFT_RIVER_NOISE_SCALE + MINECRAFT_RIVER_WORLD_OFFSET,
    wz * MINECRAFT_RIVER_NOISE_SCALE + MINECRAFT_RIVER_WORLD_OFFSET,
    RIVER_NOISE_UNIT_FREQUENCY,
  )

  return {
    continentalness,
    erosion,
    humidity,
    pv: minecraftPeaksAndValleysFromWeirdness(weirdness),
    riverNoise,
    temperature,
  }
}

export const minecraftClimateAt = (
  seed: number,
  wx: number,
  wz: number,
  continentalness: number = toBipolar(minecraftContinentalnessAt(seed, wx, wz)),
): MinecraftClimateSample =>
  minecraftClimateAtWithContinentalness(
    seed,
    wx,
    wz,
    continentalness,
  )

const OCEAN_BELOW_SEA_LEVEL_MARGIN = 2
const BEACH_ABOVE_SEA_LEVEL_MARGIN = 1

type MinecraftBiomePosition = Readonly<{
  surfaceY: number
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
  surfaceY: number
}>

export const minecraftSurfaceBiomeAt = (
  seed: number,
  wx: number,
  wz: number,
  levels: MinecraftTerrainLevels = MINECRAFT_DEFAULT_TERRAIN_LEVELS,
): MinecraftSurfaceBiome => {
  const continentalness = minecraftContinentalnessAt(seed, wx, wz)
  const surfaceY = minecraftSurfaceHeightFromContinentalness(continentalness)
  const climate = minecraftClimateAtWithContinentalness(seed, wx, wz, toBipolar(continentalness))
  return {
    biome: minecraftBiomeForWithClimate(
      { levels, surfaceY },
      climate,
    ),
    surfaceY,
  }
}

export type MinecraftBiomeQuery = Readonly<{
  levels?: MinecraftTerrainLevels
  seed: number
  surfaceY: number
  wx: number
  wz: number
}>

export const minecraftBiomeFor = ({
  levels = MINECRAFT_DEFAULT_TERRAIN_LEVELS,
  seed,
  surfaceY,
  wx,
  wz,
}: MinecraftBiomeQuery): MinecraftBiome => {
  const continentalness = minecraftContinentalnessAt(seed, wx, wz)
  return minecraftBiomeForWithClimate(
    { levels, surfaceY },
    minecraftClimateAtWithContinentalness(seed, wx, wz, toBipolar(continentalness)),
  )
}
