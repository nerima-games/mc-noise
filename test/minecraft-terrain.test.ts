import { describe, expect, it } from 'vitest'
import {
  classifyMinecraftBiomeFromClimate,
} from '../src/domain/minecraft-biome-classifier.js'
import {
  MINECRAFT_DEFAULT_TERRAIN_LEVELS,
  minecraftBiomeFor,
  minecraftClimateAt,
  minecraftContinentalnessAt,
  minecraftSurfaceBiomeAt,
  minecraftSurfaceHeightAt,
  minecraftSurfaceHeightFromContinentalness,
} from '../src/domain/minecraft-terrain.js'

describe('Minecraft terrain fields', () => {
  const seed = 0x1234_5678
  const wx = 123
  const wz = -456

  it('maps continentalness to the bounded surface-height interval', () => {
    expect(minecraftSurfaceHeightFromContinentalness(-10)).toBe(38)
    expect(minecraftSurfaceHeightFromContinentalness(10)).toBe(92)
    expect(minecraftSurfaceHeightFromContinentalness(0.5)).toBe(65)

    const continentalness = minecraftContinentalnessAt(seed, wx, wz)
    expect(minecraftSurfaceHeightAt(seed, wx, wz)).toBe(
      minecraftSurfaceHeightFromContinentalness(continentalness),
    )
  })

  it('samples climate deterministically with or without the precomputed continentalness', () => {
    const continentalness = minecraftContinentalnessAt(seed, wx, wz)
    const implicit = minecraftClimateAt(seed, wx, wz)
    const explicit = minecraftClimateAt(seed, wx, wz, continentalness * 2 - 1)

    expect(explicit).toEqual(implicit)
    expect(minecraftClimateAt(seed, wx, wz)).toEqual(implicit)
  })

  it('selects ocean, beach, and climate-derived surface biomes at their level boundaries', () => {
    const surfaceBiome = minecraftSurfaceBiomeAt(seed, wx, wz)
    expect(surfaceBiome.surfaceY).toBe(minecraftSurfaceHeightAt(seed, wx, wz))

    expect(minecraftBiomeFor({ seed, surfaceY: 60, wx, wz })).toBe('OCEAN')
    expect(minecraftBiomeFor({ seed, surfaceY: 61, wx, wz })).toBe('BEACH')
    expect(minecraftBiomeFor({ seed, surfaceY: 64, wx, wz })).toBe('BEACH')

    const climate = minecraftClimateAt(seed, wx, wz)
    expect(minecraftBiomeFor({ seed, surfaceY: 65, wx, wz })).toBe(
      classifyMinecraftBiomeFromClimate(climate),
    )
    expect(minecraftBiomeFor({ levels: { seaLevel: 0, lakeLevel: 0 }, seed, surfaceY: 65, wx, wz })).toBe(
      classifyMinecraftBiomeFromClimate(climate),
    )
    expect(
      minecraftSurfaceBiomeAt(seed, wx, wz, MINECRAFT_DEFAULT_TERRAIN_LEVELS).biome,
    ).toBe(surfaceBiome.biome)
  })
})
