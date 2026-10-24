import { Result } from 'effect'
import { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { describe, expect, it, vi } from 'vitest'
import { MinecraftClimateValue } from '../src/domain/minecraft-biome.js'
import { NoiseSeed } from '../src/domain/seed.js'
import { classifyMinecraftBiomeFromClimate } from '../src/domain/minecraft-biome-classifier.js'
import {
  MINECRAFT_DEFAULT_TERRAIN_LEVELS,
  minecraftBiomeFor,
  minecraftClimateAt,
  minecraftContinentalnessAt,
  minecraftSurfaceBiomeAt,
  minecraftSurfaceHeightAt,
  minecraftSurfaceHeightFromContinentalness,
} from '../src/domain/minecraft-terrain.js'

const unwrap = <Value, ErrorValue>(result: Result.Result<Value, ErrorValue>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

const noiseControl = vi.hoisted(() => ({ rejectClimateNoise: false, rejectedClimateNoiseCalls: 0 }))

vi.mock('../src/domain/value-noise.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/domain/value-noise.js')>()
  return {
    ...actual,
    fbm2D: (...args: Parameters<typeof actual.fbm2D>) => {
      if (noiseControl.rejectClimateNoise) {
        noiseControl.rejectedClimateNoiseCalls += 1
        // Return an out-of-contract sample so the climate adapter's failure path runs.
        return Result.succeed(1.5)
      }
      return actual.fbm2D(...args)
    },
  }
})

describe('Minecraft terrain fields', () => {
  const seed = NoiseSeed(0x1234_5678)
  const wx = BlockAxis(123)
  const wz = BlockAxis(-456)

  it('maps normalized continentalness to the bounded surface-height interval', () => {
    expect(minecraftSurfaceHeightFromContinentalness(MinecraftClimateValue(0))).toBe(38)
    expect(minecraftSurfaceHeightFromContinentalness(MinecraftClimateValue(1))).toBe(92)
    expect(minecraftSurfaceHeightFromContinentalness(MinecraftClimateValue(0.5))).toBe(65)

    const continentalness = unwrap(minecraftContinentalnessAt(seed, wx, wz))
    expect(unwrap(minecraftSurfaceHeightAt(seed, wx, wz))).toBe(
      minecraftSurfaceHeightFromContinentalness(continentalness),
    )
  })

  it('samples climate deterministically with or without precomputed continentalness', () => {
    const continentalness = unwrap(minecraftContinentalnessAt(seed, wx, wz))
    const implicit = unwrap(minecraftClimateAt(seed, wx, wz))
    const explicit = unwrap(minecraftClimateAt(seed, wx, wz, continentalness))

    expect(explicit).toEqual(implicit)
    expect(unwrap(minecraftClimateAt(seed, wx, wz))).toEqual(implicit)
  })

  it('rejects a continentalness value that maps outside the signed-noise range', () => {
    // @ts-expect-error malformed runtime input exercises bounded-noise validation
    const result = minecraftClimateAt(seed, wx, wz, -1)

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(RangeError)
      expect(result.failure.message).toBe('noise value must be finite and within [-1, 1]')
    }
  })

  it('rejects an octave result outside the climate value range', () => {
    noiseControl.rejectedClimateNoiseCalls = 0
    noiseControl.rejectClimateNoise = true
    try {
      const result = minecraftClimateAt(seed, wx, wz, MinecraftClimateValue(0.5))

      expect(Result.isFailure(result)).toBe(true)
      expect(noiseControl.rejectedClimateNoiseCalls).toBe(1)
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(RangeError)
        expect(result.failure.message).toBe('Minecraft climate value must be finite and within [0, 1]')
      }
    } finally {
      noiseControl.rejectClimateNoise = false
    }
  })

  it('selects ocean, beach, and climate-derived surface biomes at their level boundaries', () => {
    const surfaceBiome = unwrap(minecraftSurfaceBiomeAt(seed, wx, wz))
    expect(surfaceBiome.surfaceY).toBe(unwrap(minecraftSurfaceHeightAt(seed, wx, wz)))

    const biomeAt = (surfaceY: number, levels = MINECRAFT_DEFAULT_TERRAIN_LEVELS) =>
      unwrap(minecraftBiomeFor({
        levels,
        seed,
        surfaceY: BlockAxis(surfaceY),
        wx,
        wz,
      }))

    expect(biomeAt(60)).toBe('OCEAN')
    expect(biomeAt(61)).toBe('BEACH')
    expect(biomeAt(64)).toBe('BEACH')

    const climate = unwrap(minecraftClimateAt(seed, wx, wz))
    expect(biomeAt(65)).toBe(classifyMinecraftBiomeFromClimate(climate))
    expect(biomeAt(65, { seaLevel: BlockAxis(0), lakeLevel: BlockAxis(0) })).toBe(
      classifyMinecraftBiomeFromClimate(climate),
    )
    expect(unwrap(minecraftSurfaceBiomeAt(seed, wx, wz)).biome).toBe(surfaceBiome.biome)
  })
})
