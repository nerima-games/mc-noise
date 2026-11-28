import type { ClimateValue } from './climate.js'
import {
  MINECRAFT_BEACH_CONTINENTALNESS_MAX,
  MINECRAFT_CLIMATE_CENTER,
  MINECRAFT_CLIMATE_MAX,
  MINECRAFT_CLIMATE_MIN,
  MINECRAFT_CLIMATE_VARIANCE_STRETCH,
  MINECRAFT_CONTINENTALNESS_MOUNTAIN_MIN,
  MINECRAFT_CONTINENTALNESS_OCEAN_MAX,
  MINECRAFT_CONTINENTALNESS_RIVER_MAX,
  MINECRAFT_CONTINENTALNESS_RIVER_MIN,
  MINECRAFT_CONTINENTALNESS_SWAMP_FOREST_MIN,
  MINECRAFT_EROSION_FOREST_MAX,
  MINECRAFT_MOUNTAININESS_EROSION_BASELINE,
  MINECRAFT_MOUNTAININESS_EROSION_WEIGHT,
  MINECRAFT_MOUNTAININESS_MOUNTAIN_MIN,
  MINECRAFT_MOUNTAININESS_PV_WEIGHT,
  MINECRAFT_MOUNTAININESS_TAIGA_MAX,
  MINECRAFT_PV_BASE,
  MINECRAFT_PV_WEIRDNESS_OFFSET,
  MINECRAFT_PV_WEIRDNESS_SCALE,
  MINECRAFT_RIVER_CENTER,
  MINECRAFT_RIVER_FLOWER_FOREST_MIN,
  MINECRAFT_RIVER_HALF_WIDTH,
  MINECRAFT_TEMP_COLD,
} from './minecraft-biome-classifier.config.js'
import {
  type MinecraftBiome,
  MinecraftClimateValue,
  classifyMinecraftBiome,
} from './minecraft-biome.js'
import { BoundedNoise } from './noise-primitives.js'

const BOUNDED_NOISE_MIN = -1
const BOUNDED_NOISE_MAX = 1

export type MinecraftClimateSample = Readonly<{
  temperature: MinecraftClimateValue
  humidity: MinecraftClimateValue
  continentalness: BoundedNoise
  erosion: BoundedNoise
  pv: BoundedNoise
  riverNoise: MinecraftClimateValue
}>

export const minecraftPeaksAndValleysFromWeirdness = (
  weirdness: BoundedNoise,
): BoundedNoise =>
  BoundedNoise(
    Math.max(
      BOUNDED_NOISE_MIN,
      Math.min(
        BOUNDED_NOISE_MAX,
        MINECRAFT_PV_BASE -
          Math.abs(
            MINECRAFT_PV_WEIRDNESS_SCALE * Math.abs(weirdness) -
              MINECRAFT_PV_WEIRDNESS_OFFSET,
          ),
      ),
    ),
  )

const stretchClimateValue = (value: MinecraftClimateValue): MinecraftClimateValue =>
  MinecraftClimateValue(
    Math.max(
      MINECRAFT_CLIMATE_MIN,
      Math.min(
        MINECRAFT_CLIMATE_MAX,
        MINECRAFT_CLIMATE_CENTER + (value - MINECRAFT_CLIMATE_CENTER) * MINECRAFT_CLIMATE_VARIANCE_STRETCH,
      ),
    ),
  )

const mountaininessAt = (climate: MinecraftClimateSample): number =>
  Math.max(MINECRAFT_CLIMATE_MIN, climate.pv) * MINECRAFT_MOUNTAININESS_PV_WEIGHT +
  Math.max(MINECRAFT_CLIMATE_MIN, MINECRAFT_MOUNTAININESS_EROSION_BASELINE - climate.erosion) *
    MINECRAFT_MOUNTAININESS_EROSION_WEIGHT

const isRiverClimate = (climate: MinecraftClimateSample, riverDistance: number): boolean =>
  climate.continentalness > MINECRAFT_CONTINENTALNESS_RIVER_MIN &&
  climate.continentalness < MINECRAFT_CONTINENTALNESS_RIVER_MAX &&
  riverDistance < MINECRAFT_RIVER_HALF_WIDTH

const isMountainClimate = (climate: MinecraftClimateSample, mountaininess: number): boolean =>
  climate.continentalness > MINECRAFT_CONTINENTALNESS_MOUNTAIN_MIN &&
  mountaininess > MINECRAFT_MOUNTAININESS_MOUNTAIN_MIN

const classifyMountainBiome = (climate: MinecraftClimateSample): MinecraftBiome => {
  if (climate.temperature < MINECRAFT_TEMP_COLD) {
    return 'SNOW'
  }

  return 'MOUNTAINS'
}

const refineClimateBiome = (
  baseBiome: MinecraftBiome,
  climate: MinecraftClimateSample,
  mountaininess: number,
): MinecraftBiome => {
  if (
    baseBiome === 'SWAMP' &&
    (climate.continentalness > MINECRAFT_CONTINENTALNESS_SWAMP_FOREST_MIN ||
      climate.erosion < MINECRAFT_EROSION_FOREST_MAX)
  ) {
    return 'FOREST'
  }

  if (baseBiome === 'MOUNTAINS' && mountaininess < MINECRAFT_MOUNTAININESS_TAIGA_MAX) {
    return 'TAIGA'
  }

  if (baseBiome === 'FOREST' && climate.riverNoise > MINECRAFT_RIVER_FLOWER_FOREST_MIN) {
    return 'FLOWER_FOREST'
  }

  return baseBiome
}

const classifyBiomeByContinentalClimate = (
  baseBiome: MinecraftBiome,
  climate: MinecraftClimateSample,
): MinecraftBiome => {
  if (climate.continentalness < MINECRAFT_CONTINENTALNESS_OCEAN_MAX) {
    return 'OCEAN'
  }

  const mountaininess = mountaininessAt(climate)
  if (isMountainClimate(climate, mountaininess)) {
    return classifyMountainBiome(climate)
  }

  return refineClimateBiome(baseBiome, climate, mountaininess)
}

export const classifyMinecraftBiomeFromClimate = (climate: MinecraftClimateSample): MinecraftBiome => {
  const temperature = stretchClimateValue(climate.temperature)
  const humidity = stretchClimateValue(climate.humidity)
  const riverDistance = Math.abs(climate.riverNoise - MINECRAFT_RIVER_CENTER)

  if (isRiverClimate(climate, riverDistance)) {
    return 'RIVER'
  }

  return classifyBiomeByContinentalClimate(classifyMinecraftBiome(temperature, humidity), climate)
}

export const refineMinecraftBeachBiome = (
  biome: MinecraftBiome,
  neighboringBiomes: ReadonlyArray<MinecraftBiome>,
  continentalness: MinecraftClimateValue,
): MinecraftBiome => {
  if (biome === 'OCEAN' || biome === 'DESERT' || biome === 'SWAMP') {
    return biome
  }

  const adjacentOcean = neighboringBiomes.some((neighbor) => neighbor === 'OCEAN')
  if (adjacentOcean && continentalness < MINECRAFT_BEACH_CONTINENTALNESS_MAX) {
    return 'BEACH'
  }

  return biome
}

export type MinecraftCaveBiome = 'DEEP_DARK' | 'LUSH_CAVES' | 'DRIPSTONE_CAVES'

export type MinecraftCaveBiomeMatch =
  | Readonly<{ kind: 'cave'; biome: MinecraftCaveBiome }>
  | Readonly<{ kind: 'none' }>

// Intervals come from the vanilla overworld biome parameter report:
// https://raw.githubusercontent.com/Arcensoth/mcdata/master/generated/reports/biome_parameters/minecraft/overworld.json
// Overlap priority (deep dark, lush, dripstone) is a project decision, not vanilla distance matching.
const DEEP_DARK_DEPTH = 1.1
const DEEP_DARK_EROSION_MAX = -0.375
const CAVE_DEPTH_MIN = 0.2
const CAVE_DEPTH_MAX = 0.9
const LUSH_HUMIDITY_MIN = 0.85
const DRIPSTONE_CONTINENTALNESS_MIN = 0.8

export const classifyMinecraftCaveBiome = (
  climate: MinecraftClimateSample,
  depth: ClimateValue,
): MinecraftCaveBiomeMatch => {
  if (depth === DEEP_DARK_DEPTH && climate.erosion <= DEEP_DARK_EROSION_MAX) {
    return { biome: 'DEEP_DARK', kind: 'cave' }
  }
  if (depth >= CAVE_DEPTH_MIN && depth <= CAVE_DEPTH_MAX) {
    // MinecraftClimateSample humidity is [0, 1]; vanilla's 0.7 maps to 0.85.
    if (climate.humidity >= LUSH_HUMIDITY_MIN) {
      return { biome: 'LUSH_CAVES', kind: 'cave' }
    }
    if (climate.continentalness >= DRIPSTONE_CONTINENTALNESS_MIN) {
      return { biome: 'DRIPSTONE_CAVES', kind: 'cave' }
    }
  }
  return { kind: 'none' }
}
