import {
  MINECRAFT_DEFAULT_TERRAIN_LEVELS,
  type MinecraftTerrainLevels,
  minecraftClimateAt,
  minecraftContinentalnessAt,
  minecraftSurfaceHeightFromContinentalness,
} from './minecraft-terrain.js'
import {
  MINECRAFT_LAKE_NOISE_SCALE,
  MINECRAFT_LAKE_WORLD_OFFSET,
  minecraftComputeLakeBasin,
  minecraftDetermineWaterLevel,
  minecraftIsLakeShoreColumn,
  minecraftResolveSurfaceY,
} from './minecraft-lakes.js'
import {
  type MinecraftClimateSample,
  classifyMinecraftBiomeFromClimate,
} from './minecraft-biome-classifier.js'
import {
  type MinecraftResolvedSurfaceMaterial,
  resolveMinecraftSurfaceMaterial,
} from './minecraft-surface.js'
import { channelSeed, valueNoise2D } from './value-noise.js'
import type { MinecraftBiome } from './minecraft-biome.js'

const LAKE_NOISE_OCTAVES = 1
const CONTINENTALNESS_BIPOLAR_SCALE = 2
const CONTINENTALNESS_BIPOLAR_OFFSET = 1
const OCEAN_BELOW_SEA_LEVEL_MARGIN = 2
const BEACH_ABOVE_SEA_LEVEL_MARGIN = 1

export type MinecraftTerrainColumn = Readonly<{
  biome: MinecraftBiome
  initialSurfaceY: number
  lakeBasinY: number | undefined
  surface: MinecraftResolvedSurfaceMaterial
  surfaceY: number
  temperature: number
  waterLevel: number | undefined
}>

const minecraftLakeNoiseAt = (seed: number, wx: number, wz: number): number =>
  valueNoise2D(
    channelSeed(seed, 'lake'),
    wx * MINECRAFT_LAKE_NOISE_SCALE + MINECRAFT_LAKE_WORLD_OFFSET,
    wz * MINECRAFT_LAKE_NOISE_SCALE + MINECRAFT_LAKE_WORLD_OFFSET,
    LAKE_NOISE_OCTAVES,
  )

const minecraftBiomeForColumn = (
  initialSurfaceY: number,
  climate: MinecraftClimateSample,
  levels: MinecraftTerrainLevels,
): MinecraftBiome => {
  if (initialSurfaceY < levels.seaLevel - OCEAN_BELOW_SEA_LEVEL_MARGIN) {
    return 'OCEAN'
  }
  if (initialSurfaceY <= levels.seaLevel + BEACH_ABOVE_SEA_LEVEL_MARGIN) {
    return 'BEACH'
  }
  return classifyMinecraftBiomeFromClimate(climate)
}

export const minecraftTerrainColumnAt = (
  seed: number,
  wx: number,
  wz: number,
  levels: MinecraftTerrainLevels = MINECRAFT_DEFAULT_TERRAIN_LEVELS,
): MinecraftTerrainColumn => {
  const continentalness = minecraftContinentalnessAt(seed, wx, wz)
  const initialSurfaceY = minecraftSurfaceHeightFromContinentalness(continentalness)
  const climate = minecraftClimateAt(
    seed,
    wx,
    wz,
    continentalness * CONTINENTALNESS_BIPOLAR_SCALE - CONTINENTALNESS_BIPOLAR_OFFSET,
  )
  const biome = minecraftBiomeForColumn(initialSurfaceY, climate, levels)
  const lakeNoiseValue = minecraftLakeNoiseAt(seed, wx, wz)
  const lakeBasinY = minecraftComputeLakeBasin(biome, lakeNoiseValue, initialSurfaceY, levels)
  const surfaceY = minecraftResolveSurfaceY(biome, initialSurfaceY, lakeBasinY)
  const waterLevel = minecraftDetermineWaterLevel(biome, surfaceY, lakeBasinY, levels)
  const surface = resolveMinecraftSurfaceMaterial(biome, surfaceY, waterLevel ?? levels.seaLevel, {
    hasLakeBasin: typeof lakeBasinY !== 'undefined',
    isShore: minecraftIsLakeShoreColumn(lakeBasinY, lakeNoiseValue, surfaceY, levels),
  })

  return {
    biome,
    initialSurfaceY,
    lakeBasinY,
    surface,
    surfaceY,
    temperature: climate.temperature,
    waterLevel,
  }
}
