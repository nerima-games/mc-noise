import { blockIdOf } from '@nerima-games/mc-kernel'
import { describe, expect, it } from 'vitest'
import {
  classifyMinecraftBiome,
  MINECRAFT_BIOMES,
  MINECRAFT_BIOME_SURFACES,
  MINECRAFT_BLOCK,
  MINECRAFT_CHUNK_BIOMES,
  MINECRAFT_BIOME_TREE_DENSITY,
} from '../src/domain/minecraft-biome.js'

describe('Minecraft biome definitions', () => {
  it('classifies the direct temperature and humidity rules in order', () => {
    const cases: ReadonlyArray<readonly [number, number, string]> = [
      [0.2, 0.1, 'SNOW'],
      [0.3, 0.1, 'DESERT'],
      [0.8, 0.8, 'JUNGLE'],
      [0.2, 0.9, 'TAIGA'],
      [0.75, 0.9, 'SWAMP'],
      [0.5, 0.9, 'FOREST'],
      [0.2, 0.6, 'TAIGA'],
      [0.2, 0.45, 'MOUNTAINS'],
      [0.2, 0.3, 'SNOW'],
      [0.8, 0.65, 'JUNGLE'],
      [0.8, 0.3, 'SAVANNA'],
      [0.8, 0.1, 'DESERT'],
      [0.5, 0.2, 'PLAINS'],
      [0.5, 0.7, 'FOREST'],
      [0.5, 0.5, 'PLAINS'],
    ]

    for (const [temperature, humidity, expected] of cases) {
      expect(classifyMinecraftBiome(temperature, humidity)).toBe(expected)
    }
  })

  it('publishes the supported biome, chunk-biome, block, surface, and tree tables', () => {
    expect(MINECRAFT_BIOMES).toEqual([
      'PLAINS',
      'DESERT',
      'FOREST',
      'FLOWER_FOREST',
      'OCEAN',
      'MOUNTAINS',
      'SNOW',
      'SWAMP',
      'JUNGLE',
      'BEACH',
      'RIVER',
      'TAIGA',
      'SAVANNA',
    ])
    expect(MINECRAFT_CHUNK_BIOMES).toEqual([...MINECRAFT_BIOMES, 'NETHER', 'END'])
    expect(MINECRAFT_BLOCK).toMatchObject({
      AIR: blockIdOf('air'),
      BEDROCK: blockIdOf('bedrock'),
      DEEPSLATE: blockIdOf('deepslate'),
      DIRT: blockIdOf('dirt'),
      GRASS: blockIdOf('grass_block'),
      GRAVEL: blockIdOf('gravel'),
      ICE: blockIdOf('ice'),
      LAVA: blockIdOf('lava'),
      LEAVES: blockIdOf('oak_leaves'),
      LOG: blockIdOf('oak_log'),
      OBSIDIAN: blockIdOf('obsidian'),
      SAND: blockIdOf('sand'),
      SNOW: blockIdOf('snow'),
      STONE: blockIdOf('stone'),
      WATER: blockIdOf('water'),
    })

    const sandSurface = {
      filler: MINECRAFT_BLOCK.SAND,
      top: MINECRAFT_BLOCK.SAND,
      underwaterTop: MINECRAFT_BLOCK.SAND,
    }
    const grassSurface = {
      filler: MINECRAFT_BLOCK.DIRT,
      top: MINECRAFT_BLOCK.GRASS,
      underwaterTop: MINECRAFT_BLOCK.GRAVEL,
    }
    const expectedSurfaces = {
      BEACH: sandSurface,
      DESERT: sandSurface,
      FLOWER_FOREST: grassSurface,
      FOREST: grassSurface,
      JUNGLE: grassSurface,
      MOUNTAINS: {
        filler: MINECRAFT_BLOCK.STONE,
        top: MINECRAFT_BLOCK.STONE,
        underwaterTop: MINECRAFT_BLOCK.STONE,
      },
      OCEAN: sandSurface,
      PLAINS: grassSurface,
      RIVER: sandSurface,
      SAVANNA: grassSurface,
      SNOW: {
        filler: MINECRAFT_BLOCK.DIRT,
        top: MINECRAFT_BLOCK.SNOW,
        underwaterTop: MINECRAFT_BLOCK.GRAVEL,
      },
      SWAMP: grassSurface,
      TAIGA: grassSurface,
    }
    const expectedTreeDensity = {
      BEACH: 0,
      DESERT: 0,
      FLOWER_FOREST: 0.012,
      FOREST: 0.012,
      JUNGLE: 0.012,
      MOUNTAINS: 0,
      OCEAN: 0,
      PLAINS: 0.006,
      RIVER: 0,
      SAVANNA: 0.008,
      SNOW: 0.004,
      SWAMP: 0.012,
      TAIGA: 0.009,
    }

    for (const biome of MINECRAFT_BIOMES) {
      expect(MINECRAFT_BIOME_SURFACES[biome]).toEqual(expectedSurfaces[biome])
      expect(MINECRAFT_BIOME_TREE_DENSITY[biome]).toBe(expectedTreeDensity[biome])
    }
  })
})
