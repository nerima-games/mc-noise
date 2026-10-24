import {
  BlockAxis,
  type BlockAxis as BlockAxisValue,
} from '@nerima-games/mc-kernel/domain/coordinates'
import {
  MINECRAFT_DEFAULT_TERRAIN_LEVELS,
  type MinecraftTerrainLevels,
} from './minecraft-terrain.js'
import type {
  MinecraftBiome,
  MinecraftClimateValue,
} from './minecraft-biome.js'
import { Option, Result } from 'effect'

export const MINECRAFT_LAKE_NOISE_SCALE = 0.02
export const MINECRAFT_LAKE_WORLD_OFFSET = 5_000
export const MINECRAFT_LAKE_THRESHOLD = 0.7
export const MINECRAFT_LAKE_MAX_DEPTH = 18
export const MINECRAFT_LAKE_SHORE_WIDTH = 0.04
const MINECRAFT_RIVER_WATER_LEVEL_VALUE = 62
export const MINECRAFT_RIVER_WATER_LEVEL: BlockAxisValue = BlockAxis(MINECRAFT_RIVER_WATER_LEVEL_VALUE)
export const MINECRAFT_RIVER_MIN_CUT = 4
export const MINECRAFT_RIVER_MAX_CUT = 10
export const MINECRAFT_ICE_FREEZE_TEMPERATURE = 0.15

const NORMALIZED_MIN = 0
const NORMALIZED_MAX = 1
const SMOOTHSTEP_CUBIC_FACTOR = 3
const SMOOTHSTEP_LINEAR_FACTOR = 2
const BASIN_SURFACE_OFFSET = 1
const RIVER_SURFACE_CEILING_OFFSET = 2
const LAKE_SHORE_HEIGHT_MARGIN = 4

const smoothstep01 = (value: number): number => {
  const normalized = Math.max(NORMALIZED_MIN, Math.min(NORMALIZED_MAX, value))
  return normalized * normalized * (SMOOTHSTEP_CUBIC_FACTOR - SMOOTHSTEP_LINEAR_FACTOR * normalized)
}

export const minecraftComputeLakeBasin = (
  biome: MinecraftBiome,
  lakeNoiseValue: MinecraftClimateValue,
  initialSurfaceY: BlockAxisValue,
  terrainLevels: MinecraftTerrainLevels = MINECRAFT_DEFAULT_TERRAIN_LEVELS,
): Result.Result<Option.Option<BlockAxisValue>, RangeError> => {
  const { lakeLevel } = terrainLevels
  if (
    biome === 'OCEAN' ||
    lakeNoiseValue <= MINECRAFT_LAKE_THRESHOLD ||
    initialSurfaceY < lakeLevel
  ) {
    return Result.succeed(Option.none())
  }

  const blend = smoothstep01(
    (lakeNoiseValue - MINECRAFT_LAKE_THRESHOLD) / (NORMALIZED_MAX - MINECRAFT_LAKE_THRESHOLD),
  )
  const carveTarget =
    lakeLevel - BASIN_SURFACE_OFFSET - blend * (MINECRAFT_LAKE_MAX_DEPTH - BASIN_SURFACE_OFFSET)
  const basinY = Math.round(initialSurfaceY + blend * (carveTarget - initialSurfaceY))
  return Result.mapError(
    Result.map(BlockAxis.result(basinY), Option.some),
    (error) => new RangeError(error.message),
  )
}

export const minecraftResolveSurfaceY = (
  biome: MinecraftBiome,
  initialSurfaceY: BlockAxisValue,
  lakeBasinY: Option.Option<BlockAxisValue>,
): Result.Result<BlockAxisValue, RangeError> => {
  if (Option.isSome(lakeBasinY)) {
    return Result.succeed(lakeBasinY.value)
  }
  let riverSurfaceY: number = initialSurfaceY
  if (biome === 'RIVER') {
    riverSurfaceY = Math.max(
      MINECRAFT_RIVER_WATER_LEVEL - MINECRAFT_RIVER_MAX_CUT,
      Math.min(
        initialSurfaceY - MINECRAFT_RIVER_MIN_CUT,
        MINECRAFT_RIVER_WATER_LEVEL - RIVER_SURFACE_CEILING_OFFSET,
      ),
    )
  }

  return Result.mapError(
    BlockAxis.result(riverSurfaceY),
    (error) => new RangeError(error.message),
  )
}

export const minecraftDetermineWaterLevel = (
  biome: MinecraftBiome,
  surfaceY: BlockAxisValue,
  lakeBasinY: Option.Option<BlockAxisValue>,
  terrainLevels: MinecraftTerrainLevels = MINECRAFT_DEFAULT_TERRAIN_LEVELS,
): Option.Option<BlockAxisValue> => {
  const { seaLevel, lakeLevel } = terrainLevels
  if (biome === 'RIVER') {
    return Option.some(MINECRAFT_RIVER_WATER_LEVEL)
  }
  if (Option.isSome(lakeBasinY)) {
    return Option.some(lakeLevel)
  }
  if (surfaceY < seaLevel) {
    return Option.some(seaLevel)
  }
  return Option.none()
}

export const minecraftShouldFreezeWaterSurface = (
  biome: MinecraftBiome,
  temperature: MinecraftClimateValue,
): boolean => biome === 'SNOW' || temperature <= MINECRAFT_ICE_FREEZE_TEMPERATURE

export const minecraftIsLakeShoreColumn = (
  lakeBasinY: Option.Option<BlockAxisValue>,
  lakeNoiseValue: MinecraftClimateValue,
  surfaceY: BlockAxisValue,
  terrainLevels: MinecraftTerrainLevels,
): boolean =>
  Option.isNone(lakeBasinY) &&
  lakeNoiseValue > MINECRAFT_LAKE_THRESHOLD - MINECRAFT_LAKE_SHORE_WIDTH &&
  surfaceY < terrainLevels.lakeLevel + LAKE_SHORE_HEIGHT_MARGIN
