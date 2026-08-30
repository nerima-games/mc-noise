import { describe, expect, it } from 'vitest'
import { MINECRAFT_BIOMES } from '../src/domain/minecraft-biome.js'
import {
  minecraftSurfaceHeightAt,
} from '../src/domain/minecraft-terrain.js'
import { minecraftTerrainColumnAt } from '../src/domain/minecraft-terrain-column.js'

describe('Minecraft terrain columns', () => {
  it('assembles deterministic terrain data without writing world state', () => {
    const seed = 0x1020_3040
    const wx = 17
    const wz = -29
    const first = minecraftTerrainColumnAt(seed, wx, wz)
    const second = minecraftTerrainColumnAt(seed, wx, wz)

    expect(first).toEqual(second)
    expect(MINECRAFT_BIOMES).toContain(first.biome)
    expect(first.initialSurfaceY).toBe(minecraftSurfaceHeightAt(seed, wx, wz))
    expect(first.surfaceY).toBeLessThanOrEqual(first.initialSurfaceY)
    expect(first.surface.fillerDepth).toBeGreaterThan(0)
  })

  it('takes the ocean, beach, and inland biome paths at explicit sea levels', () => {
    const seed = 0x1020_3040
    const wx = 17
    const wz = -29
    const initialSurfaceY = minecraftSurfaceHeightAt(seed, wx, wz)

    const ocean = minecraftTerrainColumnAt(seed, wx, wz, {
      lakeLevel: initialSurfaceY + 10,
      seaLevel: initialSurfaceY + 10,
    })
    expect(ocean.biome).toBe('OCEAN')
    expect(ocean.waterLevel).toBe(initialSurfaceY + 10)

    const beach = minecraftTerrainColumnAt(seed, wx, wz, {
      lakeLevel: initialSurfaceY + 10,
      seaLevel: initialSurfaceY,
    })
    expect(beach.biome).toBe('BEACH')
    expect(beach.waterLevel).toBeUndefined()

    const inland = minecraftTerrainColumnAt(seed, wx, wz, {
      lakeLevel: initialSurfaceY + 10,
      seaLevel: initialSurfaceY - 2,
    })
    expect(MINECRAFT_BIOMES).toContain(inland.biome)
    expect(inland.biome).not.toBe('OCEAN')
    expect(inland.biome).not.toBe('BEACH')
    expect(inland.waterLevel).toBeUndefined()
  })

  it('finds and exposes a deterministic lake basin in the assembled column', () => {
    const seed = 0x1020_3040
    const candidates = Array.from({ length: 81 }, (_, index) => {
      const offset = index - 40
      return minecraftTerrainColumnAt(seed, offset * 16, (40 - Math.abs(offset)) * 16, {
        lakeLevel: 0,
        seaLevel: 0,
      })
    })
    const lakeColumn = candidates.find((column) => typeof column.lakeBasinY !== 'undefined')

    expect(lakeColumn).toBeDefined()
    expect(lakeColumn?.surface.top).toBeDefined()
    expect(lakeColumn?.waterLevel).toBe(0)
  })
})
