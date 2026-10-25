import { Option, Result } from 'effect'
import { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { describe, expect, it } from 'vitest'
import { MinecraftClimateValue } from '../src/domain/minecraft-biome.js'
import {
  minecraftComputeLakeBasin,
  minecraftDetermineWaterLevel,
  minecraftIsLakeShoreColumn,
  minecraftResolveSurfaceY,
  minecraftShouldFreezeWaterSurface,
} from '../src/domain/minecraft-lakes.js'

const levels = { lakeLevel: BlockAxis(63), seaLevel: BlockAxis(63) }
const climateValue = (value: number): MinecraftClimateValue => MinecraftClimateValue(value)

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

describe('Minecraft lakes and water levels', () => {
  it('rejects a basin whose computed block axis underflows the safe integer range', () => {
    const minimumBlockAxis = BlockAxis(Number.MIN_SAFE_INTEGER)
    const result = minecraftComputeLakeBasin(
      'PLAINS',
      climateValue(1),
      minimumBlockAxis,
      { lakeLevel: minimumBlockAxis, seaLevel: BlockAxis(0) },
    )

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(RangeError)
    }
  })

  it('rejects a resolved surface outside the safe block-axis range', () => {
    // @ts-expect-error malformed runtime input exercises output BlockAxis validation
    const result = minecraftResolveSurfaceY('PLAINS', Number.MAX_SAFE_INTEGER + 1, Option.none())

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(RangeError)
    }
  })

  it('returns explicit absence for invalid lake candidates and carves a smooth basin', () => {
    expect(Option.isNone(unwrap(minecraftComputeLakeBasin('OCEAN', climateValue(1), BlockAxis(90), levels)))).toBe(true)
    expect(Option.isNone(unwrap(minecraftComputeLakeBasin('PLAINS', climateValue(0.7), BlockAxis(90), levels)))).toBe(true)
    expect(Option.isNone(unwrap(minecraftComputeLakeBasin('PLAINS', climateValue(0.8), BlockAxis(62), levels)))).toBe(true)
    expect(optionValue(unwrap(minecraftComputeLakeBasin('PLAINS', climateValue(0.8), BlockAxis(90), levels)))).toBe(82)
    expect(optionValue(unwrap(minecraftComputeLakeBasin('PLAINS', climateValue(1), BlockAxis(90), levels)))).toBe(45)
  })

  it('resolves river cuts, lake overrides, and ordinary terrain surfaces', () => {
    expect(unwrap(minecraftResolveSurfaceY('RIVER', BlockAxis(55), Option.none()))).toBe(52)
    expect(unwrap(minecraftResolveSurfaceY('RIVER', BlockAxis(58), Option.none()))).toBe(54)
    expect(unwrap(minecraftResolveSurfaceY('RIVER', BlockAxis(90), Option.none()))).toBe(60)
    expect(unwrap(minecraftResolveSurfaceY('RIVER', BlockAxis(90), Option.some(BlockAxis(45))))).toBe(45)
    expect(unwrap(minecraftResolveSurfaceY('PLAINS', BlockAxis(90), Option.none()))).toBe(90)
  })

  it('chooses river, lake, sea, or no water in priority order', () => {
    expect(optionValue(minecraftDetermineWaterLevel('RIVER', BlockAxis(90), Option.none(), levels))).toBe(62)
    expect(optionValue(minecraftDetermineWaterLevel('PLAINS', BlockAxis(50), Option.some(BlockAxis(45)), levels))).toBe(63)
    expect(optionValue(minecraftDetermineWaterLevel('PLAINS', BlockAxis(50), Option.none(), levels))).toBe(63)
    expect(Option.isNone(minecraftDetermineWaterLevel('PLAINS', BlockAxis(63), Option.none(), levels))).toBe(true)
  })

  it('freezes cold and snowy water surfaces', () => {
    expect(minecraftShouldFreezeWaterSurface('SNOW', climateValue(1))).toBe(true)
    expect(minecraftShouldFreezeWaterSurface('PLAINS', climateValue(0.15))).toBe(true)
    expect(minecraftShouldFreezeWaterSurface('PLAINS', climateValue(0.150_001))).toBe(false)
  })

  it('identifies only non-basin columns near a lake shore', () => {
    expect(minecraftIsLakeShoreColumn(Option.some(BlockAxis(45)), climateValue(0.8), BlockAxis(64), levels)).toBe(false)
    expect(minecraftIsLakeShoreColumn(Option.none(), climateValue(0.65), BlockAxis(64), levels)).toBe(false)
    expect(minecraftIsLakeShoreColumn(Option.none(), climateValue(0.8), BlockAxis(67), levels)).toBe(false)
    expect(minecraftIsLakeShoreColumn(Option.none(), climateValue(0.8), BlockAxis(66), levels)).toBe(true)
  })
})
