import { Brand, Option } from 'effect'
import {
  MINECRAFT_BIOME_SURFACES,
  type MinecraftBiome,
} from './minecraft-biome.js'
import type { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import type { BlockId } from '@nerima-games/mc-kernel/domain/block-registry'

const MIN_SURFACE_FILLER_DEPTH = 0
const SHORE_SURFACE_FILLER_DEPTH = 2
const TERRAIN_SURFACE_FILLER_DEPTH = 4

export type MinecraftSurfaceFillerDepth = number & Brand.Brand<'MinecraftSurfaceFillerDepth'>
export const MinecraftSurfaceFillerDepth: Brand.Constructor<MinecraftSurfaceFillerDepth> =
  Brand.make<MinecraftSurfaceFillerDepth>(
    (value) =>
      (Number.isSafeInteger(value) && value > MIN_SURFACE_FILLER_DEPTH) ||
      'surface filler depth must be a positive integer',
  )

export type MinecraftResolvedSurfaceMaterial = Readonly<{
  filler: Option.Option<BlockId>
  fillerDepth: MinecraftSurfaceFillerDepth
  submerged: boolean
  top: Option.Option<BlockId>
}>

export type MinecraftSurfaceMaterialOptions = Readonly<{
  hasLakeBasin: boolean
  isShore: boolean
}>

const DEFAULT_SURFACE_OPTIONS: MinecraftSurfaceMaterialOptions = {
  hasLakeBasin: false,
  isShore: false,
}

export const resolveMinecraftSurfaceMaterial = (
  biome: MinecraftBiome,
  surfaceY: BlockAxis,
  waterLevel: BlockAxis,
  options: MinecraftSurfaceMaterialOptions = DEFAULT_SURFACE_OPTIONS,
): MinecraftResolvedSurfaceMaterial => {
  const { filler, top: dryTop, underwaterTop } = MINECRAFT_BIOME_SURFACES[biome]
  const submerged = surfaceY < waterLevel

  if (options.hasLakeBasin) {
    return {
      filler: MINECRAFT_BIOME_SURFACES.BEACH.filler,
      fillerDepth: MinecraftSurfaceFillerDepth(SHORE_SURFACE_FILLER_DEPTH),
      submerged,
      top: MINECRAFT_BIOME_SURFACES.BEACH.top,
    }
  }

  if (options.isShore) {
    return {
      filler,
      fillerDepth: MinecraftSurfaceFillerDepth(SHORE_SURFACE_FILLER_DEPTH),
      submerged,
      top: MINECRAFT_BIOME_SURFACES.BEACH.top,
    }
  }

  if (submerged) {
    return {
      filler,
      fillerDepth: MinecraftSurfaceFillerDepth(TERRAIN_SURFACE_FILLER_DEPTH),
      submerged,
      top: underwaterTop,
    }
  }

  return {
    filler,
    fillerDepth: MinecraftSurfaceFillerDepth(TERRAIN_SURFACE_FILLER_DEPTH),
    submerged,
    top: dryTop,
  }
}
