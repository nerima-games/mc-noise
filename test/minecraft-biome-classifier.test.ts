import { describe, expect, it } from 'vitest'
import {
  MinecraftClimateValue,
} from '../src/domain/minecraft-biome.js'
import {
  BoundedNoise,
} from '../src/domain/noise-primitives.js'
import {
  classifyMinecraftBiomeFromClimate,
  minecraftPeaksAndValleysFromWeirdness,
  refineMinecraftBeachBiome,
  type MinecraftClimateSample,
} from '../src/domain/minecraft-biome-classifier.js'

const unit = (value: number): MinecraftClimateValue => MinecraftClimateValue(value)
const signed = (value: number): BoundedNoise => BoundedNoise(value)

const climate = (overrides: Partial<MinecraftClimateSample> = {}): MinecraftClimateSample => ({
  continentalness: signed(0.1),
  erosion: signed(0.5),
  humidity: unit(0.5),
  pv: signed(0),
  riverNoise: unit(0.7),
  temperature: unit(0.5),
  ...overrides,
})

describe('Minecraft climate biome classifier', () => {
  it('converts weirdness into bounded peaks and valleys', () => {
    expect(minecraftPeaksAndValleysFromWeirdness(signed(0))).toBe(-1)
    expect(minecraftPeaksAndValleysFromWeirdness(signed(1))).toBe(0)
    expect(minecraftPeaksAndValleysFromWeirdness(signed(2 / 3))).toBe(1)
    expect(minecraftPeaksAndValleysFromWeirdness(signed(-2 / 3))).toBe(1)
    expect(minecraftPeaksAndValleysFromWeirdness(signed(-1))).toBe(0)
  })

  it('covers river, ocean, mountain, and ordinary climate routing', () => {
    expect(classifyMinecraftBiomeFromClimate(climate({ continentalness: signed(-0.5) }))).toBe('OCEAN')
    expect(classifyMinecraftBiomeFromClimate(climate({ continentalness: signed(0.5) }))).toBe('PLAINS')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: signed(0.1), riverNoise: unit(0.53) }),
      ),
    ).toBe('PLAINS')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: signed(0.1), riverNoise: unit(0.5) }),
      ),
    ).toBe('RIVER')

    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: signed(0.5), pv: signed(1) }),
      ),
    ).toBe('MOUNTAINS')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: signed(0.5), pv: signed(1), temperature: unit(0.2) }),
      ),
    ).toBe('SNOW')
  })

  it('refines swamp, mountain, forest, and untouched base biomes', () => {
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: signed(0.4), humidity: unit(0.7), temperature: unit(0.6) }),
      ),
    ).toBe('FOREST')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ erosion: signed(0.1), humidity: unit(0.7), temperature: unit(0.6) }),
      ),
    ).toBe('FOREST')
    expect(
      classifyMinecraftBiomeFromClimate(climate({ humidity: unit(0.7), temperature: unit(0.6) })),
    ).toBe('SWAMP')

    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: unit(0.48), temperature: unit(0.2) }),
      ),
    ).toBe('TAIGA')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ continentalness: signed(0.5), pv: signed(1), temperature: unit(0.5) }),
      ),
    ).toBe('MOUNTAINS')

    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: unit(0.9), riverNoise: unit(0.9) }),
      ),
    ).toBe('FLOWER_FOREST')
    expect(classifyMinecraftBiomeFromClimate(climate({ humidity: unit(0.9) }))).toBe('FOREST')
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: unit(0.8), temperature: unit(0.8) }),
      ),
    ).toBe('JUNGLE')
    expect(
      classifyMinecraftBiomeFromClimate(climate({ humidity: unit(0.5), temperature: unit(0.5) })),
    ).toBe('PLAINS')
  })

  it('clamps stretched climate values and refines beaches only at the coast', () => {
    expect(
      classifyMinecraftBiomeFromClimate(
        climate({ humidity: unit(1), temperature: unit(0) }),
      ),
    ).toBe('TAIGA')

    expect(refineMinecraftBeachBiome('OCEAN', [], unit(0))).toBe('OCEAN')
    expect(refineMinecraftBeachBiome('DESERT', ['OCEAN'], unit(0))).toBe('DESERT')
    expect(refineMinecraftBeachBiome('SWAMP', ['OCEAN'], unit(0))).toBe('SWAMP')
    expect(refineMinecraftBeachBiome('PLAINS', ['FOREST'], unit(0.1))).toBe('PLAINS')
    expect(refineMinecraftBeachBiome('PLAINS', ['FOREST', 'OCEAN'], unit(0.12))).toBe('PLAINS')
    expect(refineMinecraftBeachBiome('PLAINS', ['FOREST', 'OCEAN'], unit(0.11))).toBe('BEACH')
  })
})
