import { type BlockId, blockIdOf } from '@nerima-games/mc-kernel'
import {
  MINECRAFT_HUM_DRY,
  MINECRAFT_HUM_JUNGLE,
  MINECRAFT_HUM_MOUNTAINS,
  MINECRAFT_HUM_SAVANNA_MIN,
  MINECRAFT_HUM_TAIGA,
  MINECRAFT_HUM_VERY_DRY,
  MINECRAFT_HUM_VERY_WET,
  MINECRAFT_HUM_WET,
  MINECRAFT_TEMP_COLD,
  MINECRAFT_TEMP_HOT,
  MINECRAFT_TEMP_JUNGLE,
} from './minecraft-biome-classifier.config.js'

export const MINECRAFT_BIOMES = [
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
] as const

export type MinecraftBiome = (typeof MINECRAFT_BIOMES)[number]

export const MINECRAFT_CHUNK_BIOMES = [...MINECRAFT_BIOMES, 'NETHER', 'END'] as const

export type MinecraftChunkBiome = (typeof MINECRAFT_CHUNK_BIOMES)[number]

type MinecraftBiomeRule = Readonly<{
  biome: MinecraftBiome
  when: (temperature: number, humidity: number) => boolean
}>

const MINECRAFT_BIOME_RULES: ReadonlyArray<MinecraftBiomeRule> = [
  { biome: 'SNOW', when: (temperature, humidity) => humidity < MINECRAFT_HUM_VERY_DRY && temperature < MINECRAFT_TEMP_COLD },
  { biome: 'DESERT', when: (temperature, humidity) => humidity < MINECRAFT_HUM_VERY_DRY && temperature >= MINECRAFT_TEMP_COLD },
  { biome: 'JUNGLE', when: (temperature, humidity) => humidity > MINECRAFT_HUM_JUNGLE && temperature > MINECRAFT_TEMP_JUNGLE },
  {
    biome: 'TAIGA',
    when: (temperature, humidity) =>
      humidity > MINECRAFT_HUM_VERY_WET && temperature < MINECRAFT_TEMP_COLD && humidity > MINECRAFT_HUM_TAIGA,
  },
  { biome: 'SWAMP', when: (temperature, humidity) => humidity > MINECRAFT_HUM_VERY_WET && temperature > MINECRAFT_TEMP_HOT },
  { biome: 'FOREST', when: (_temperature, humidity) => humidity > MINECRAFT_HUM_VERY_WET },
  { biome: 'TAIGA', when: (temperature, humidity) => temperature < MINECRAFT_TEMP_COLD && humidity > MINECRAFT_HUM_TAIGA },
  { biome: 'MOUNTAINS', when: (temperature, humidity) => temperature < MINECRAFT_TEMP_COLD && humidity > MINECRAFT_HUM_MOUNTAINS },
  { biome: 'SNOW', when: (temperature) => temperature < MINECRAFT_TEMP_COLD },
  { biome: 'JUNGLE', when: (temperature, humidity) => temperature > MINECRAFT_TEMP_HOT && humidity > MINECRAFT_HUM_WET },
  { biome: 'SAVANNA', when: (temperature, humidity) => temperature > MINECRAFT_TEMP_HOT && humidity > MINECRAFT_HUM_SAVANNA_MIN },
  { biome: 'DESERT', when: (temperature) => temperature > MINECRAFT_TEMP_HOT },
  { biome: 'PLAINS', when: (_temperature, humidity) => humidity < MINECRAFT_HUM_DRY },
  { biome: 'FOREST', when: (_temperature, humidity) => humidity > MINECRAFT_HUM_WET },
]

export const MINECRAFT_FALLBACK_BIOME: MinecraftBiome = 'PLAINS'

export const classifyMinecraftBiome = (temperature: number, humidity: number): MinecraftBiome =>
  MINECRAFT_BIOME_RULES.find((rule) => rule.when(temperature, humidity))?.biome ?? MINECRAFT_FALLBACK_BIOME

export type MinecraftBiomeSurface = Readonly<{
  top: BlockId
  filler: BlockId
  underwaterTop: BlockId
}>

export const MINECRAFT_BLOCK = {
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
} as const

export const MINECRAFT_BIOME_SURFACES: Readonly<Record<MinecraftBiome, MinecraftBiomeSurface>> = {
  BEACH: { filler: MINECRAFT_BLOCK.SAND, top: MINECRAFT_BLOCK.SAND, underwaterTop: MINECRAFT_BLOCK.SAND },
  DESERT: { filler: MINECRAFT_BLOCK.SAND, top: MINECRAFT_BLOCK.SAND, underwaterTop: MINECRAFT_BLOCK.SAND },
  FLOWER_FOREST: { filler: MINECRAFT_BLOCK.DIRT, top: MINECRAFT_BLOCK.GRASS, underwaterTop: MINECRAFT_BLOCK.GRAVEL },
  FOREST: { filler: MINECRAFT_BLOCK.DIRT, top: MINECRAFT_BLOCK.GRASS, underwaterTop: MINECRAFT_BLOCK.GRAVEL },
  JUNGLE: { filler: MINECRAFT_BLOCK.DIRT, top: MINECRAFT_BLOCK.GRASS, underwaterTop: MINECRAFT_BLOCK.GRAVEL },
  MOUNTAINS: { filler: MINECRAFT_BLOCK.STONE, top: MINECRAFT_BLOCK.STONE, underwaterTop: MINECRAFT_BLOCK.STONE },
  OCEAN: { filler: MINECRAFT_BLOCK.SAND, top: MINECRAFT_BLOCK.SAND, underwaterTop: MINECRAFT_BLOCK.SAND },
  PLAINS: { filler: MINECRAFT_BLOCK.DIRT, top: MINECRAFT_BLOCK.GRASS, underwaterTop: MINECRAFT_BLOCK.GRAVEL },
  RIVER: { filler: MINECRAFT_BLOCK.SAND, top: MINECRAFT_BLOCK.SAND, underwaterTop: MINECRAFT_BLOCK.SAND },
  SAVANNA: { filler: MINECRAFT_BLOCK.DIRT, top: MINECRAFT_BLOCK.GRASS, underwaterTop: MINECRAFT_BLOCK.GRAVEL },
  SNOW: { filler: MINECRAFT_BLOCK.DIRT, top: MINECRAFT_BLOCK.SNOW, underwaterTop: MINECRAFT_BLOCK.GRAVEL },
  SWAMP: { filler: MINECRAFT_BLOCK.DIRT, top: MINECRAFT_BLOCK.GRASS, underwaterTop: MINECRAFT_BLOCK.GRAVEL },
  TAIGA: { filler: MINECRAFT_BLOCK.DIRT, top: MINECRAFT_BLOCK.GRASS, underwaterTop: MINECRAFT_BLOCK.GRAVEL },
}

export const MINECRAFT_BIOME_TREE_DENSITY: Readonly<Record<MinecraftBiome, number>> = {
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
