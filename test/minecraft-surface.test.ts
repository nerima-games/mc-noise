import { describe, expect, it } from 'vitest'
import {
  MINECRAFT_BIOME_SURFACES,
  MINECRAFT_BLOCK,
} from '../src/domain/minecraft-biome.js'
import { resolveMinecraftSurfaceMaterial } from '../src/domain/minecraft-surface.js'

describe('Minecraft surface material resolution', () => {
  it('resolves a dry default surface', () => {
    expect(resolveMinecraftSurfaceMaterial('PLAINS', 64, 63)).toEqual({
      filler: MINECRAFT_BLOCK.DIRT,
      fillerDepth: 4,
      submerged: false,
      top: MINECRAFT_BLOCK.GRASS,
    })
  })

  it('resolves underwater, shore, lake, and snowy materials', () => {
    expect(resolveMinecraftSurfaceMaterial('PLAINS', 62, 63)).toEqual({
      filler: MINECRAFT_BLOCK.DIRT,
      fillerDepth: 4,
      submerged: true,
      top: MINECRAFT_BLOCK.GRAVEL,
    })
    expect(resolveMinecraftSurfaceMaterial('PLAINS', 64, 63, { hasLakeBasin: false, isShore: true })).toEqual({
      filler: MINECRAFT_BLOCK.DIRT,
      fillerDepth: 2,
      submerged: false,
      top: MINECRAFT_BLOCK.SAND,
    })
    expect(resolveMinecraftSurfaceMaterial('PLAINS', 62, 63, { hasLakeBasin: true, isShore: true })).toEqual({
      filler: MINECRAFT_BLOCK.SAND,
      fillerDepth: 2,
      submerged: true,
      top: MINECRAFT_BLOCK.SAND,
    })
    expect(resolveMinecraftSurfaceMaterial('SNOW', 64, 63)).toEqual({
      filler: MINECRAFT_BIOME_SURFACES.SNOW.filler,
      fillerDepth: 4,
      submerged: false,
      top: MINECRAFT_BLOCK.SNOW,
    })
  })
})
