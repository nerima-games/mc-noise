import {
  MINECRAFT_BIOME_SURFACES,
  type MinecraftBiome,
} from './minecraft-biome.js'
import type { BlockId } from '@nerima-games/mc-kernel'

export type MinecraftResolvedSurfaceMaterial = Readonly<{
  filler: BlockId
  fillerDepth: number
  submerged: boolean
  top: BlockId
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
  surfaceY: number,
  waterLevel: number,
  options: MinecraftSurfaceMaterialOptions = DEFAULT_SURFACE_OPTIONS,
): MinecraftResolvedSurfaceMaterial => {
  const { filler, top: dryTop, underwaterTop } = MINECRAFT_BIOME_SURFACES[biome]
  const submerged = surfaceY < waterLevel

  if (options.hasLakeBasin) {
    return {
      filler: MINECRAFT_BIOME_SURFACES.BEACH.filler,
      fillerDepth: 2,
      submerged,
      top: MINECRAFT_BIOME_SURFACES.BEACH.top,
    }
  }

  if (options.isShore) {
    return {
      filler,
      fillerDepth: 2,
      submerged,
      top: MINECRAFT_BIOME_SURFACES.BEACH.top,
    }
  }

  if (submerged) {
    return {
      filler,
      fillerDepth: 4,
      submerged,
      top: underwaterTop,
    }
  }

  return {
    filler,
    fillerDepth: 4,
    submerged,
    top: dryTop,
  }
}
