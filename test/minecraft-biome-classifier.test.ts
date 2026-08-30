import { describe, expect, it } from 'vitest'
import {
  classifyMinecraftBiomeFromClimate,
  minecraftPeaksAndValleysFromWeirdness,
  refineMinecraftBeachBiome,
  type MinecraftClimateSample,
} from '../src/domain/minecraft-biome-classifier.js'

const climate = (overrides: Partial<MinecraftClimateSample> = {}): MinecraftClimateSample => ({
  continentalness: 0.1,
  erosion: 0.5,
  humidity: 0.5,
  pv: 0,
  riverNoise: 0.7,
  temperature: 0.5,
  ...overrides,
})

describe('Minecraft climate biome classifier', () => {
  it('converts weirdness into peaks and valleys', () => {
    expect(minecraftPeaksAndValleysFromWeirdness(0)).toBe(-1)
    expect(minecraftPeaksAndValleysFromWeirdness(1)).toBe(0)
    expect(minecraftPeaksAndValleysFromWeirdness(2 / 3)).toBe(1)
    expect(minecraftPeaksAndValleysFromWeirdness(-2 / 3)).toBe(1)
  })

  it('covers river, ocean, mountain, and ordinary climate routing', () => {
    expect(classifyMinecraftBiomeFromClimate(climate({ continentalness: -0.5 }))).toBe('OCEAN')
    expect(classifyMinecraftBiomeFromClimate(climate({ continentalness: 0.5 }))).toBe('PLAINS')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: 0.1, riverNoise: 0.53 }),
      ),
    ).toBe('PLAINS')
    expect(classifyMinecraftBiomeFromClimate(climate({ continentalness: 0.1, riverNoise: 0.5 }))).toBe('RIVER')

    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: 0.5, pv: 1 }),
      ),
    ).toBe('MOUNTAINS')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: 0.5, pv: 1, temperature: 0.2 }),
      ),
    ).toBe('SNOW')
  })

  it('refines swamp, mountain, forest, and untouched base biomes', () => {
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: 0.4, humidity: 0.7, temperature: 0.6 }),
      ),
    ).toBe('FOREST')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ erosion: 0.1, humidity: 0.7, temperature: 0.6 }),
      ),
    ).toBe('FOREST')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: 0.7, temperature: 0.6 }),
      ),
    ).toBe('SWAMP')

    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: 0.48, temperature: 0.2 }),
      ),
    ).toBe('TAIGA')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: 0.5, pv: 1, temperature: 0.5 }),
      ),
    ).toBe('MOUNTAINS')

    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: 0.9, riverNoise: 0.9 }),
      ),
    ).toBe('FLOWER_FOREST')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: 0.9 }),
      ),
    ).toBe('FOREST')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: 0.8, temperature: 0.8 }),
      ),
    ).toBe('JUNGLE')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: 0.5, temperature: 0.5 }),
      ),
    ).toBe('PLAINS')
  })

  it('clamps stretched climate values and refines beaches only at the coast', () => {
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: 2, temperature: -1 }),
      ),
    ).toBe('TAIGA')

    expect(refineMinecraftBeachBiome('OCEAN', [], 0)).toBe('OCEAN')
    expect(refineMinecraftBeachBiome('DESERT', ['OCEAN'], 0)).toBe('DESERT')
    expect(refineMinecraftBeachBiome('SWAMP', ['OCEAN'], 0)).toBe('SWAMP')
    expect(refineMinecraftBeachBiome('PLAINS', ['FOREST'], 0.1)).toBe('PLAINS')
    expect(refineMinecraftBeachBiome('PLAINS', ['FOREST', 'OCEAN'], 0.12)).toBe('PLAINS')
    expect(refineMinecraftBeachBiome('PLAINS', ['FOREST', 'OCEAN'], 0.11)).toBe('BEACH')
  })
})
