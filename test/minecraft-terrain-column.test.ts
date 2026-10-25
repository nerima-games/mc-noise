import { Option, Result } from 'effect'
import { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { describe, expect, it, vi } from 'vitest'
import { MINECRAFT_BIOMES } from '../src/domain/minecraft-biome.js'
import { NoiseSeed } from '../src/domain/seed.js'
import { NoiseChannelLabel, channelSeed } from '../src/domain/value-noise.js'
import { minecraftSurfaceHeightAt } from '../src/domain/minecraft-terrain.js'
import { minecraftTerrainColumnAt } from '../src/domain/minecraft-terrain-column.js'

const unwrap = <Value, ErrorValue>(result: Result.Result<Value, ErrorValue>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

const optionValue = <Value>(option: Option.Option<Value>): Value | undefined => {
  if (Option.isSome(option)) {
    return option.value
  }
  return globalThis.undefined
}

const noiseControl = vi.hoisted(() => ({ rejectLakeNoise: false, rejectedLakeNoiseCalls: 0, targetSeed: 0 }))

vi.mock('../src/domain/value-noise.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/domain/value-noise.js')>()
  return {
    ...actual,
    valueNoise2D: (...args: Parameters<typeof actual.valueNoise2D>) => {
      if (noiseControl.rejectLakeNoise && args[0] === noiseControl.targetSeed) {
        noiseControl.rejectedLakeNoiseCalls += 1
        // Return an out-of-contract sample so the climate adapter's failure path runs.
        return Result.succeed(1.5)
      }
      return actual.valueNoise2D(...args)
    },
  }
})

describe('Minecraft terrain columns', () => {
  it('assembles deterministic terrain data without writing world state', () => {
    const seed = NoiseSeed(0x1020_3040)
    const wx = BlockAxis(17)
    const wz = BlockAxis(-29)
    const first = unwrap(minecraftTerrainColumnAt(seed, wx, wz))
    const second = unwrap(minecraftTerrainColumnAt(seed, wx, wz))

    expect(first).toEqual(second)
    expect(MINECRAFT_BIOMES).toContain(first.biome)
    expect(first.initialSurfaceY).toBe(unwrap(minecraftSurfaceHeightAt(seed, wx, wz)))
    expect(first.surfaceY).toBeLessThanOrEqual(first.initialSurfaceY)
    expect(first.surface.fillerDepth).toBeGreaterThan(0)
  })

  it('takes the ocean, beach, and inland biome paths at explicit sea levels', () => {
    const seed = NoiseSeed(0x1020_3040)
    const wx = BlockAxis(17)
    const wz = BlockAxis(-29)
    const initialSurfaceY = unwrap(minecraftSurfaceHeightAt(seed, wx, wz))

    const ocean = unwrap(minecraftTerrainColumnAt(seed, wx, wz, {
      lakeLevel: BlockAxis(initialSurfaceY + 10),
      seaLevel: BlockAxis(initialSurfaceY + 10),
    }))
    expect(ocean.biome).toBe('OCEAN')
    expect(optionValue(ocean.waterLevel)).toBe(initialSurfaceY + 10)

    const beach = unwrap(minecraftTerrainColumnAt(seed, wx, wz, {
      lakeLevel: BlockAxis(initialSurfaceY + 10),
      seaLevel: initialSurfaceY,
    }))
    expect(beach.biome).toBe('BEACH')
    expect(Option.isNone(beach.waterLevel)).toBe(true)

    const inland = unwrap(minecraftTerrainColumnAt(seed, wx, wz, {
      lakeLevel: BlockAxis(initialSurfaceY + 10),
      seaLevel: BlockAxis(initialSurfaceY - 2),
    }))
    expect(MINECRAFT_BIOMES).toContain(inland.biome)
    expect(inland.biome).not.toBe('OCEAN')
    expect(inland.biome).not.toBe('BEACH')
    expect(Option.isNone(inland.waterLevel)).toBe(true)
  })

  it('finds and exposes a deterministic lake basin in the assembled column', () => {
    const seed = NoiseSeed(0x1020_3040)
    const candidates = Array.from({ length: 81 }, (_, index) => {
      const offset = index - 40
      return unwrap(minecraftTerrainColumnAt(
        seed,
        BlockAxis(offset * 16),
        BlockAxis((40 - Math.abs(offset)) * 16),
        { lakeLevel: BlockAxis(0), seaLevel: BlockAxis(0) },
      ))
    })
    const lakeColumn = candidates.find((column) => Option.isSome(column.lakeBasinY))

    expect(lakeColumn).toBeDefined()
    expect(lakeColumn?.surface.top).toBeDefined()
    expect(optionValue(lakeColumn?.waterLevel ?? Option.none())).toBe(0)
  })

  it('returns a RangeError when lake noise violates the climate value range', () => {
    const seed = NoiseSeed(0x1020_3040)
    noiseControl.targetSeed = channelSeed(seed, NoiseChannelLabel('lake'))
    noiseControl.rejectedLakeNoiseCalls = 0
    noiseControl.rejectLakeNoise = true
    try {
      const result = minecraftTerrainColumnAt(
        seed,
        BlockAxis(17),
        BlockAxis(-29),
      )

      expect(Result.isFailure(result)).toBe(true)
      expect(noiseControl.rejectedLakeNoiseCalls).toBe(1)
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(RangeError)
        expect(result.failure.message).toBe('Minecraft climate value must be finite and within [0, 1]')
      }
    } finally {
      noiseControl.rejectLakeNoise = false
    }
  })
})
