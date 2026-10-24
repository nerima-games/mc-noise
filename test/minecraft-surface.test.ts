import { Result } from 'effect'
import { describe, expect, it } from 'vitest'
import { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import {
  MINECRAFT_BIOME_SURFACES,
  MINECRAFT_BLOCK,
} from '../src/domain/minecraft-biome.js'
import {
  MinecraftSurfaceFillerDepth,
  resolveMinecraftSurfaceMaterial,
} from '../src/domain/minecraft-surface.js'

describe('Minecraft surface material resolution', () => {
  it('rejects a non-positive filler depth', () => {
    const result = MinecraftSurfaceFillerDepth.result(0)

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure.message).toBe('surface filler depth must be a positive integer')
    }
  })

  it('resolves a dry default surface', () => {
    expect(resolveMinecraftSurfaceMaterial('PLAINS', BlockAxis(64), BlockAxis(63))).toEqual({
      filler: MINECRAFT_BLOCK.DIRT,
      fillerDepth: 4,
      submerged: false,
      top: MINECRAFT_BLOCK.GRASS,
    })
  })

  it('resolves underwater, shore, lake, and snowy materials', () => {
    expect(resolveMinecraftSurfaceMaterial('PLAINS', BlockAxis(62), BlockAxis(63))).toEqual({
      filler: MINECRAFT_BLOCK.DIRT,
      fillerDepth: 4,
      submerged: true,
      top: MINECRAFT_BLOCK.GRAVEL,
    })
    expect(resolveMinecraftSurfaceMaterial('PLAINS', BlockAxis(64), BlockAxis(63), { hasLakeBasin: false, isShore: true })).toEqual({
      filler: MINECRAFT_BLOCK.DIRT,
      fillerDepth: 2,
      submerged: false,
      top: MINECRAFT_BLOCK.SAND,
    })
    expect(resolveMinecraftSurfaceMaterial('PLAINS', BlockAxis(62), BlockAxis(63), { hasLakeBasin: true, isShore: true })).toEqual({
      filler: MINECRAFT_BLOCK.SAND,
      fillerDepth: 2,
      submerged: true,
      top: MINECRAFT_BLOCK.SAND,
    })
    expect(resolveMinecraftSurfaceMaterial('SNOW', BlockAxis(64), BlockAxis(63))).toEqual({
      filler: MINECRAFT_BIOME_SURFACES.SNOW.filler,
      fillerDepth: 4,
      submerged: false,
      top: MINECRAFT_BLOCK.SNOW,
    })
  })
})
