import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { classifyMinecraftCaveBiome, MinecraftClimateValue, BoundedNoise } from '../src/index.js'
import type { MinecraftClimateSample } from '../src/index.js'

const climate = (overrides: Partial<MinecraftClimateSample> = {}): MinecraftClimateSample => ({
  continentalness: BoundedNoise(0),
  erosion: BoundedNoise(0),
  humidity: MinecraftClimateValue(0.5),
  pv: BoundedNoise(0),
  riverNoise: MinecraftClimateValue(0.5),
  temperature: MinecraftClimateValue(0.5),
  ...overrides,
})

describe('cave biome classification', () => {
  it('recognizes each cave and its inclusive climate boundaries', () => {
    expect(classifyMinecraftCaveBiome(climate({ erosion: BoundedNoise(-0.375) }), 1.1))
      .toEqual({ kind: 'cave', biome: 'DEEP_DARK' })
    for (const depth of [0.2, 0.9]) {
      expect(classifyMinecraftCaveBiome(climate({ humidity: MinecraftClimateValue(0.85) }), depth))
        .toEqual({ kind: 'cave', biome: 'LUSH_CAVES' })
      expect(classifyMinecraftCaveBiome(climate({ continentalness: BoundedNoise(0.8) }), depth))
        .toEqual({ kind: 'cave', biome: 'DRIPSTONE_CAVES' })
    }
  })

  it('returns no match outside the target intervals', () => {
    expect(classifyMinecraftCaveBiome(climate({ erosion: BoundedNoise(-0.3749) }), 1.1)).toEqual({ kind: 'none' })
    expect(classifyMinecraftCaveBiome(climate({ erosion: BoundedNoise(-1) }), 1.1001)).toEqual({ kind: 'none' })
    expect(classifyMinecraftCaveBiome(climate({ humidity: MinecraftClimateValue(0.8499), continentalness: BoundedNoise(0.7999) }), 0.5))
      .toEqual({ kind: 'none' })
    for (const depth of [0.1999, 0.9001]) {
      expect(classifyMinecraftCaveBiome(climate({ humidity: MinecraftClimateValue(1), continentalness: BoundedNoise(1) }), depth))
        .toEqual({ kind: 'none' })
    }
  })

  it('gives lush caves priority when underground intervals overlap', () => {
    expect(classifyMinecraftCaveBiome(climate({ humidity: MinecraftClimateValue(1), continentalness: BoundedNoise(1) }), 0.5))
      .toEqual({ kind: 'cave', biome: 'LUSH_CAVES' })
  })

  it('never selects a cave at surface depth regardless of climate', () => {
    fc.assert(fc.property(
      fc.double({ min: -1, max: 1, noNaN: true }),
      fc.double({ min: -1, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      (continentalness, erosion, humidity) => {
        for (const depth of [0, 1]) {
          expect(classifyMinecraftCaveBiome(climate({
            continentalness: BoundedNoise(continentalness),
            erosion: BoundedNoise(erosion),
            humidity: MinecraftClimateValue(humidity),
          }), depth)).toEqual({ kind: 'none' })
        }
      },
    ))
  })
})
