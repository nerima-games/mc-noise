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
  type MinecraftBiome,
  MinecraftClimateValue,
  type MinecraftClimateValue as MinecraftClimateValueType,
} from './minecraft-biome.js'
import {
  type MinecraftClimateSample,
  classifyMinecraftBiomeFromClimate,
} from './minecraft-biome-classifier.js'
import {
  type MinecraftResolvedSurfaceMaterial,
  resolveMinecraftSurfaceMaterial,
} from './minecraft-surface.js'
import {
  NoiseChannelLabel,
  NoiseFrequency,
  channelSeed,
  valueNoise2D,
} from './value-noise.js'
import { Option, Result } from 'effect'
import type { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import type { NoiseSeed } from './seed.js'

const UNIT_NOISE_FREQUENCY = 1
const LAKE_NOISE_FREQUENCY = NoiseFrequency(UNIT_NOISE_FREQUENCY)
const LAKE_NOISE_CHANNEL = NoiseChannelLabel('lake')
const OCEAN_BELOW_SEA_LEVEL_MARGIN = 2
const BEACH_ABOVE_SEA_LEVEL_MARGIN = 1

export type MinecraftTerrainColumn = Readonly<{
  biome: MinecraftBiome
  initialSurfaceY: BlockAxis
  lakeBasinY: Option.Option<BlockAxis>
  surface: MinecraftResolvedSurfaceMaterial
  surfaceY: BlockAxis
  temperature: MinecraftClimateValueType
  waterLevel: Option.Option<BlockAxis>
}>

const minecraftLakeNoiseAt = (
  seed: NoiseSeed,
  wx: BlockAxis,
  wz: BlockAxis,
): Result.Result<MinecraftClimateValueType, RangeError> =>
  Result.flatMap(
    valueNoise2D(
      channelSeed(seed, LAKE_NOISE_CHANNEL),
      wx * MINECRAFT_LAKE_NOISE_SCALE + MINECRAFT_LAKE_WORLD_OFFSET,
      wz * MINECRAFT_LAKE_NOISE_SCALE + MINECRAFT_LAKE_WORLD_OFFSET,
      LAKE_NOISE_FREQUENCY,
    ),
    (value) =>
      Result.mapError(
        MinecraftClimateValue.result(value),
        (error) => new RangeError(error.message),
      ),
  )

const minecraftBiomeForColumn = (
  initialSurfaceY: BlockAxis,
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

const resolveTerrainSurface = ({
  biome,
  surfaceY,
  lakeBasinY,
  lakeNoiseValue,
  levels,
}: Readonly<{
  biome: MinecraftBiome
  surfaceY: BlockAxis
  lakeBasinY: Option.Option<BlockAxis>
  lakeNoiseValue: MinecraftClimateValueType
  levels: MinecraftTerrainLevels
}>): Readonly<{
  surface: MinecraftResolvedSurfaceMaterial
  waterLevel: Option.Option<BlockAxis>
}> => {
  const waterLevel = minecraftDetermineWaterLevel(biome, surfaceY, lakeBasinY, levels)
  let surfaceWaterLevel = levels.seaLevel
  if (Option.isSome(waterLevel)) {
    surfaceWaterLevel = waterLevel.value
  }
  const surface = resolveMinecraftSurfaceMaterial(
    biome,
    surfaceY,
    surfaceWaterLevel,
    {
      hasLakeBasin: Option.isSome(lakeBasinY),
      isShore: minecraftIsLakeShoreColumn(lakeBasinY, lakeNoiseValue, surfaceY, levels),
    },
  )
  return Object.freeze({ surface, waterLevel })
}

export const minecraftTerrainColumnAt = (
  seed: NoiseSeed,
  wx: BlockAxis,
  wz: BlockAxis,
  levels: MinecraftTerrainLevels = MINECRAFT_DEFAULT_TERRAIN_LEVELS,
): Result.Result<MinecraftTerrainColumn, RangeError> =>
  Result.gen(function* buildTerrainColumn() {
    const continentalness = yield* minecraftContinentalnessAt(seed, wx, wz)
    const initialSurfaceY = minecraftSurfaceHeightFromContinentalness(continentalness)
    const climate = yield* minecraftClimateAt(seed, wx, wz, continentalness)
    const biome = minecraftBiomeForColumn(initialSurfaceY, climate, levels)
    const lakeNoiseValue = yield* minecraftLakeNoiseAt(seed, wx, wz)
    const lakeBasinY = yield* minecraftComputeLakeBasin(
      biome,
      lakeNoiseValue,
      initialSurfaceY,
      levels,
    )
    const surfaceY = yield* minecraftResolveSurfaceY(biome, initialSurfaceY, lakeBasinY)
    const resolvedSurface = resolveTerrainSurface({
      biome,
      lakeBasinY,
      lakeNoiseValue,
      levels,
      surfaceY,
    })

    return Object.freeze({
      biome,
      initialSurfaceY,
      lakeBasinY,
      surface: resolvedSurface.surface,
      surfaceY,
      temperature: climate.temperature,
      waterLevel: resolvedSurface.waterLevel,
    })
  })
