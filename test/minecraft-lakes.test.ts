import { describe, expect, it } from 'vitest'
import {
  minecraftComputeLakeBasin,
  minecraftDetermineWaterLevel,
  minecraftIsLakeShoreColumn,
  minecraftResolveSurfaceY,
  minecraftShouldFreezeWaterSurface,
} from '../src/domain/minecraft-lakes.js'

const levels = { lakeLevel: 63, seaLevel: 63 }

describe('Minecraft lakes and water levels', () => {
  it('rejects invalid lake candidates and carves a smooth basin', () => {
    expect(minecraftComputeLakeBasin('OCEAN', 1, 90, levels)).toBeUndefined()
    expect(minecraftComputeLakeBasin('PLAINS', 0.7, 90, levels)).toBeUndefined()
    expect(minecraftComputeLakeBasin('PLAINS', 0.8, 62, levels)).toBeUndefined()
    expect(minecraftComputeLakeBasin('PLAINS', 1, 90, levels)).toBe(45)
    expect(minecraftComputeLakeBasin('PLAINS', 2, 90, levels)).toBe(45)
  })

  it('resolves river cuts, lake overrides, and ordinary terrain surfaces', () => {
    expect(minecraftResolveSurfaceY('RIVER', 55, globalThis.undefined)).toBe(52)
    expect(minecraftResolveSurfaceY('RIVER', 58, globalThis.undefined)).toBe(54)
    expect(minecraftResolveSurfaceY('RIVER', 90, globalThis.undefined)).toBe(60)
    expect(minecraftResolveSurfaceY('RIVER', 90, 45)).toBe(45)
    expect(minecraftResolveSurfaceY('PLAINS', 90, globalThis.undefined)).toBe(90)
  })

  it('chooses river, lake, sea, or no water in priority order', () => {
    expect(minecraftDetermineWaterLevel('RIVER', 90, globalThis.undefined, levels)).toBe(62)
    expect(minecraftDetermineWaterLevel('PLAINS', 50, 45, levels)).toBe(63)
    expect(minecraftDetermineWaterLevel('PLAINS', 50, globalThis.undefined, levels)).toBe(63)
    expect(minecraftDetermineWaterLevel('PLAINS', 63, globalThis.undefined, levels)).toBeUndefined()
  })

  it('freezes cold and snowy water surfaces', () => {
    expect(minecraftShouldFreezeWaterSurface('SNOW', 1)).toBe(true)
    expect(minecraftShouldFreezeWaterSurface('PLAINS', 0.15)).toBe(true)
    expect(minecraftShouldFreezeWaterSurface('PLAINS', 0.150_001)).toBe(false)
  })

  it('identifies only non-basin columns near a lake shore', () => {
    expect(minecraftIsLakeShoreColumn(45, 0.8, 64, levels)).toBe(false)
    expect(minecraftIsLakeShoreColumn(globalThis.undefined, 0.65, 64, levels)).toBe(false)
    expect(minecraftIsLakeShoreColumn(globalThis.undefined, 0.8, 67, levels)).toBe(false)
    expect(minecraftIsLakeShoreColumn(globalThis.undefined, 0.8, 66, levels)).toBe(true)
  })
})
