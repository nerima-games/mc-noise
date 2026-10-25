# Consumer migration: mc-noise 0.5

Use this guide when upgrading from mc-noise `0.4.x` to `0.5.0`.

mc-noise 0.5 moves to Effect 4 and mc-kernel 0.9. Several public inputs now use
domain brands, and APIs that can reject runtime input return typed `Result`
values. Plan caller updates before upgrading, then change the dependency and its affected call sites in the same update.

## Seed inputs

`createNoiseField` already accepted `NoiseSeed` before 0.5. In 0.5, the
value-noise APIs `channelSeed`, `latticeValue`, `valueNoise2D`, and `fbm2D` now
require that brand for their seed argument. Validate untrusted numbers with
`NoiseSeed.result` and pass the checked value onward:

```ts
import { Result } from 'effect'
import {
  channelSeed,
  NoiseChannelLabel,
  NoiseSeed,
} from '@nerima-games/mc-noise'

const deriveChannelSeedFromUntrustedSeed = (rawSeed: number) => {
  const seed = NoiseSeed.result(rawSeed)
  if (Result.isFailure(seed)) {
    return Result.fail(seed.failure)
  }
  return Result.succeed(channelSeed(seed.success, NoiseChannelLabel('terrain')))
}
```

`NoiseSeed.result` accepts only safe integers. Calling `NoiseSeed(value)`
directly throws for invalid input, so use it only when the value is already
validated. The brand preserves the existing seed mapping: PRNGs and derived
channel seeds use the low 32 bits, so inputs that differ by a multiple of
`2^32` produce the same field. In generated signatures, `NoiseSeedValue` is an
alias of `NoiseSeed`.

## mc-kernel 0.9 coordinate brands

Import coordinate brands from the coordinates subpath and `ChunkHeight` from
the chunk subpath. Keep their meanings distinct: `ChunkAxis` is an integer
chunk-space X/Z coordinate, `BlockAxis` is an integer world-space block
coordinate, `LocalAxis` is a chunk-local horizontal coordinate in `[0, 15]`,
and `PositionAxis` is a finite continuous world-space coordinate measured in
blocks.

```ts
import {
  ChunkAxis,
  PositionAxis,
  chunkCoord,
} from '@nerima-games/mc-kernel/domain/coordinates'
import { ChunkHeight } from '@nerima-games/mc-kernel/domain/chunk'
import { Result } from 'effect'
import { sampleNoise3DChunk } from '@nerima-games/mc-noise'
import type { NoiseFn3D } from '@nerima-games/mc-noise'

const sampleChunk = (
  noise: NoiseFn3D,
  rawChunkX: number,
  rawChunkZ: number,
  rawHeight: number,
  rawOriginY: number,
) => {
  const height = ChunkHeight(rawHeight)
  const chunkXValue = ChunkAxis.result(rawChunkX)
  const chunkZValue = ChunkAxis.result(rawChunkZ)
  const originYValue = PositionAxis.result(rawOriginY)
  if (Result.isFailure(chunkXValue)) return Result.fail(chunkXValue.failure)
  if (Result.isFailure(chunkZValue)) return Result.fail(chunkZValue.failure)
  if (Result.isFailure(height)) return Result.fail(height.failure)
  if (Result.isFailure(originYValue)) return Result.fail(originYValue.failure)

  const chunk = chunkCoord(chunkXValue.success, chunkZValue.success)
  return sampleNoise3DChunk(noise, chunk, height.success, {
    originY: originYValue.success,
  })
}
```

The brand constructors for `ChunkAxis` and `PositionAxis` return branded values
when called directly and can throw on invalid input. Their `.result` methods
validate untrusted numbers without throwing. `ChunkHeight` itself returns a
`Result`.

## Typed failures

Density-function constructors, spline construction and evaluation, codec
operations, climate queries, sampling adapters, and blender construction return
`Result` when their inputs can fail validation. `createBlender(options)` creates
a `Blender` from options, while `requireBlender(value)` validates an unknown
value as a `Blender`. Both return
`Result.Result<Blender, TypeError | RangeError>`; inspect or propagate the
result before using the blender. Callbacks supplied to `createBlender` must
also return `Result`. Pass either result into downstream fallible operations
with `Result.flatMap`:

```ts
import { Result } from 'effect'
import {
  createBlender,
  createDensityEvaluationContextFromBlender,
  requireBlender,
} from '@nerima-games/mc-noise'

const defaultContext = Result.flatMap(
  createBlender({
    blendDensity: (_position, density) => Result.succeed(density),
  }),
  createDensityEvaluationContextFromBlender,
)

const contextFromUnknown = (value: unknown) =>
  Result.flatMap(
    requireBlender(value),
    createDensityEvaluationContextFromBlender,
  )
```

Other fallible APIs use the same `Result` boundary. For example, density
encoding and parsing no longer throw for invalid input:

```ts
import { Result } from 'effect'
import {
  parseDensityFunction,
  stringifyDensityFunction,
  type DensityFunction,
  type DensityFunctionCodecOptions,
} from '@nerima-games/mc-noise'

const roundTripDensity = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions = {},
) => {
  const serialized = stringifyDensityFunction(density, options)
  if (Result.isFailure(serialized)) return serialized
  return parseDensityFunction(serialized.success, options)
}
```

The failure type identifies the validation error, commonly `TypeError` or
`RangeError`; density-function codec operations can also return `SchemaError`
(see [public-api.md](./public-api.md) for the complete union). `Option`
represents absence. An operation that can also fail validation may return a
nested `Result.Result<Option.Option<Value>, E>`, where `E` is its error type.
For example, `findSpawnPosition` returns
`Result.Result<Option.Option<BlockPosition>, TypeError | RangeError>`. Handle
the outer result first: a failure indicates invalid input, `None` means no
spawn position was found, and `Some(position)` contains the `BlockPosition`.

## Declaration signature changes

The generated tables compare complete declarations, so function rows include
both argument and return types. They list every changed, added, and removed
named export, then show field-level changes for exported mc-noise types and
referenced public types from mc-kernel. The field rows include provider, type,
field type, optionality, and presence. New branded value constructors are
mapped to the matching `<Brand>.result(value)` call, including constructors
provided by mc-kernel.

<!-- BEGIN GENERATED SIGNATURE TABLES -->

Compared declarations from the mc-noise 0.4.x base revision `61a4a4d0600a1ce35c75195eb32d38ef817d4918` to the mc-noise 0.5.0 candidate revision `c121ff83db06a71c29e4cad6fa8c4f09cf8bc64c`.

<details>
<summary>Seed brand changes (12)</summary>

| Export | Before | After |
| --- | --- | --- |
| `channelSeed` | <code>export declare const channelSeed: (seed: number, channel: string) =&gt; number;</code> | <code>export declare const channelSeed: (seed: NoiseSeedValue, channel: NoiseChannelLabel) =&gt; NoiseSeedValue;</code> |
| `fbm2D` | <code>export declare const fbm2D: (seed: number, x: number, z: number, options: ValueNoiseFbmOptions) =&gt; number;</code> | <code>export declare const fbm2D: (seed: NoiseSeedValue, x: number, z: number, options: ValueNoiseFbmOptions) =&gt; Result.Result&lt;ValueNoiseFbmSample, RangeError&gt;;</code> |
| `latticeValue` | <code>export declare const latticeValue: (seed: number, x: number, z: number) =&gt; number;</code> | <code>export declare const latticeValue: (seed: NoiseSeedValue, x: LatticeCoordinate, z: LatticeCoordinate) =&gt; BoundedNoise;</code> |
| `MinecraftBiomeQuery` | <code>export type MinecraftBiomeQuery = Readonly&lt;{ levels?: MinecraftTerrainLevels; seed: number; surfaceY: number; wx: number; wz: number; }&gt;;</code> | <code>export type MinecraftBiomeQuery = Readonly&lt;{ levels?: MinecraftTerrainLevels; seed: NoiseSeed; surfaceY: BlockAxisValue; wx: BlockAxisValue; wz: BlockAxisValue; }&gt;;</code> |
| `minecraftClimateAt` | <code>export declare const minecraftClimateAt: (seed: number, wx: number, wz: number, continentalness?: number) =&gt; MinecraftClimateSample;</code> | <code>export declare const minecraftClimateAt: (seed: NoiseSeed, wx: BlockAxisValue, wz: BlockAxisValue, continentalness?: MinecraftClimateValueType) =&gt; Result.Result&lt;MinecraftClimateSample, RangeError&gt;;</code> |
| `minecraftContinentalnessAt` | <code>export declare const minecraftContinentalnessAt: (seed: number, wx: number, wz: number) =&gt; number;</code> | <code>export declare const minecraftContinentalnessAt: (seed: NoiseSeed, wx: BlockAxisValue, wz: BlockAxisValue) =&gt; Result.Result&lt;MinecraftClimateValueType, RangeError&gt;;</code> |
| `minecraftSurfaceBiomeAt` | <code>export declare const minecraftSurfaceBiomeAt: (seed: number, wx: number, wz: number, levels?: MinecraftTerrainLevels) =&gt; MinecraftSurfaceBiome;</code> | <code>export declare const minecraftSurfaceBiomeAt: (seed: NoiseSeed, wx: BlockAxisValue, wz: BlockAxisValue, levels?: MinecraftTerrainLevels) =&gt; Result.Result&lt;MinecraftSurfaceBiome, RangeError&gt;;</code> |
| `minecraftSurfaceHeightAt` | <code>export declare const minecraftSurfaceHeightAt: (seed: number, wx: number, wz: number) =&gt; number;</code> | <code>export declare const minecraftSurfaceHeightAt: (seed: NoiseSeed, wx: BlockAxisValue, wz: BlockAxisValue) =&gt; Result.Result&lt;BlockAxisValue, RangeError&gt;;</code> |
| `minecraftTerrainColumnAt` | <code>export declare const minecraftTerrainColumnAt: (seed: number, wx: number, wz: number, levels?: MinecraftTerrainLevels) =&gt; MinecraftTerrainColumn;</code> | <code>export declare const minecraftTerrainColumnAt: (seed: NoiseSeed, wx: BlockAxis, wz: BlockAxis, levels?: MinecraftTerrainLevels) =&gt; Result.Result&lt;MinecraftTerrainColumn, RangeError&gt;;</code> |
| `NoiseSeed` | <code>export declare const NoiseSeed: Brand.Brand.Constructor&lt;NoiseSeed&gt;;</code><br><code>export type NoiseSeed = number &amp; Brand.Brand&lt;'NoiseSeed'&gt;;</code> | <code>export declare const NoiseSeed: Brand.Constructor&lt;NoiseSeed&gt;;</code><br><code>export type NoiseSeed = number &amp; Brand.Brand&lt;'NoiseSeed'&gt;;</code> |
| `toUint32` | <code>export declare const toUint32: (seed: NoiseSeed) =&gt; number;</code> | <code>export declare const toUint32: (seed: NoiseSeed) =&gt; NoiseSeed;</code> |
| `valueNoise2D` | <code>export declare const valueNoise2D: (seed: number, x: number, z: number, frequency: number) =&gt; number;</code> | <code>export declare const valueNoise2D: (seed: NoiseSeedValue, x: number, z: number, frequency: NoiseFrequency) =&gt; Result.Result&lt;BoundedNoise, RangeError&gt;;</code> |

</details>
<details>
<summary>Coordinate brand changes (44)</summary>

| Export | Before | After |
| --- | --- | --- |
| `BlenderBlendDensity` | <code>export type BlenderBlendDensity = (position: DensityPosition, density: number) =&gt; number;</code> | <code>export type BlenderBlendDensity = (position: Position, density: DensityValue) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> |
| `BlenderBlendOffsetAndFactor` | <code>export type BlenderBlendOffsetAndFactor = (x: number, z: number) =&gt; BlendingOutput;</code> | <code>export type BlenderBlendOffsetAndFactor = (x: PositionAxis, z: PositionAxis) =&gt; DensityFunctionResult&lt;BlendingOutput&gt;;</code> |
| `densityCoordinate` | <code>export declare const densityCoordinate: (axis: DensityCoordinateAxis, options?: DensityCoordinateOptions) =&gt; DensityFunction;</code> | <code>export declare const densityCoordinate: (axis: DensityCoordinateAxis, options?: DensityCoordinateOptions) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityCoordinate` | <code>export type DensityCoordinate = DensityBounds &amp; Readonly&lt;{ readonly kind: 'coordinate'; readonly axis: DensityCoordinateAxis; readonly scale: number; readonly offset: number; }&gt;;</code> | <code>export type DensityCoordinate = DensityBounds &amp; Readonly&lt;{ readonly kind: 'coordinate'; readonly axis: DensityCoordinateAxis; readonly scale: DensityScale; readonly offset: PositionAxis; }&gt;;</code> |
| `DensityCoordinateOptions` | <code>export type DensityCoordinateOptions = Readonly&lt;{ readonly scale?: number; readonly offset?: number; }&gt;;</code> | <code>export type DensityCoordinateOptions = Readonly&lt;{ readonly scale?: DensityScale; readonly offset?: PositionAxis; }&gt;;</code> |
| `DensityEvaluationContext` | <code>export type DensityEvaluationContext = Readonly&lt;{ readonly cellWidth: number; readonly cellHeight: number; readonly blendDensity?: (inputValue: number, position: DensityPosition) =&gt; number; readonly blendAlpha?: (position: DensityPosition) =&gt; number; readonly blendOffset?: (position: DensityPosition) =&gt; number; readonly beardifier?: (position: DensityPosition) =&gt; number; }&gt;;</code> | <code>export type DensityEvaluationContext = Readonly&lt;{ readonly cellWidth: DensityCellSize; readonly cellHeight: DensityCellSize; readonly blendDensity?: (inputValue: DensityValue, position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;; readonly blendAlpha?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;; readonly blendOffset?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;; readonly beardifier?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;; }&gt;;</code> |
| `DensityEvaluationContextOptions` | <code>export type DensityEvaluationContextOptions = Readonly&lt;{ readonly cellWidth?: number; readonly cellHeight?: number; readonly blendDensity?: (inputValue: number, position: DensityPosition) =&gt; number; readonly blendAlpha?: (position: DensityPosition) =&gt; number; readonly blendOffset?: (position: DensityPosition) =&gt; number; readonly beardifier?: (position: DensityPosition) =&gt; number; }&gt;;</code> | <code>export type DensityEvaluationContextOptions = Readonly&lt;{ readonly cellWidth?: DensityCellSize; readonly cellHeight?: DensityCellSize; readonly blendDensity?: (inputValue: DensityValue, position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;; readonly blendAlpha?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;; readonly blendOffset?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;; readonly beardifier?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;; }&gt;;</code> |
| `densityFindTopSurface` | <code>export declare const densityFindTopSurface: (density: DensityFunction, upperBound: DensityFunction, lowerBound: number, cellHeight: number) =&gt; DensityFindTopSurface;</code> | <code>export declare const densityFindTopSurface: (density: DensityFunction, upperBound: DensityFunction, lowerBound: BlockAxis, cellHeight: DensityCellSizeValue) =&gt; DensityFunctionResult&lt;DensityFindTopSurface&gt;;</code> |
| `DensityFindTopSurface` | <code>export type DensityFindTopSurface = DensityBounds &amp; Readonly&lt;{ readonly kind: 'find-top-surface'; readonly density: DensityFunction; readonly upperBound: DensityFunction; readonly lowerBound: number; readonly cellHeight: number; }&gt;;</code> | <code>export type DensityFindTopSurface = DensityBounds &amp; Readonly&lt;{ readonly kind: 'find-top-surface'; readonly density: DensityFunction; readonly upperBound: DensityFunction; readonly lowerBound: BlockAxis; readonly cellHeight: DensityCellSize; }&gt;;</code> |
| `DensityFunctionEncoded` | <code>export type DensityFunctionEncoded = Readonly&lt;{ readonly kind: 'constant'; readonly value: number; }&gt; &#124; Readonly&lt;{ readonly kind: 'coordinate'; readonly axis: DensityCoordinateAxis; readonly scale: number; readonly offset: number; }&gt; &#124; Readonly&lt;{ readonly kind: 'noise'; readonly source: string; readonly xzScale: number; readonly yScale: number; }&gt; &#124; Readonly&lt;{ readonly kind: 'old-blended-noise'; readonly source: string; readonly xzScale: number; readonly yScale: number; readonly xzFactor: number; readonly yFactor: number; readonly smearScaleMultiplier: number; }&gt; &#124; Readonly&lt;{ readonly kind: 'beardifier'; }&gt; &#124; Readonly&lt;{ readonly kind: 'shift'; readonly source: string; }&gt; &#124; Readonly&lt;{ readonly kind: 'shift-a'; readonly source: string; }&gt; &#124; Readonly&lt;{ readonly kind: 'shift-b'; readonly source: string; }&gt; &#124; Readonly&lt;{ readonly kind: 'shifted-noise'; readonly source: string; readonly shiftX: DensityFunctionEncoded; readonly shiftY: DensityFunctionEncoded; readonly shiftZ: DensityFunctionEncoded; readonly xzScale: number; readonly yScale: number; }&gt; &#124; Readonly&lt;{ readonly kind: 'linear-operation'; readonly operation: 'add' &#124; 'mul'; readonly input: DensityFunctionEncoded; readonly argument: number; }&gt; &#124; Readonly&lt;{ readonly kind: 'weird-scaled-sampler'; readonly input: DensityFunctionEncoded; readonly source: string; readonly rarityValueMapper: DensityRarityValueMapper; }&gt; &#124; Readonly&lt;{ readonly kind: 'end-islands'; readonly seed: string; }&gt; &#124; Readonly&lt;{ readonly kind: 'binary'; readonly operation: DensityBinaryOperation; readonly left: DensityFunctionEncoded; readonly right: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'unary'; readonly operation: DensityUnaryOperation; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'clamp'; readonly input: DensityFunctionEncoded; readonly min: number; readonly max: number; }&gt; &#124; Readonly&lt;{ readonly kind: 'range-choice'; readonly input: DensityFunctionEncoded; readonly minInclusive: number; readonly maxExclusive: number; readonly inRange: DensityFunctionEncoded; readonly outOfRange: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'find-top-surface'; readonly density: DensityFunctionEncoded; readonly upperBound: DensityFunctionEncoded; readonly lowerBound: number; readonly cellHeight: number; }&gt; &#124; Readonly&lt;{ readonly kind: 'y-clamped-gradient'; readonly fromY: number; readonly toY: number; readonly fromValue: number; readonly toValue: number; }&gt; &#124; Readonly&lt;{ readonly kind: 'spline'; readonly input: DensityFunctionEncoded; readonly spline: EncodedSpline; }&gt; &#124; Readonly&lt;{ readonly kind: 'interpolated'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'flat-cache'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'cache-2d'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'cache-once'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'cache-all-in-cell'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'blend-density'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'blend-alpha'; }&gt; &#124; Readonly&lt;{ readonly kind: 'blend-offset'; }&gt;;</code> | <code>export type DensityFunctionEncoded = Readonly&lt;{ readonly kind: 'constant'; readonly value: DensityValueType; }&gt; &#124; Readonly&lt;{ readonly kind: 'coordinate'; readonly axis: DensityCoordinateAxis; readonly scale: DensityScaleValue; readonly offset: PositionAxis; }&gt; &#124; Readonly&lt;{ readonly kind: 'noise'; readonly source: string; readonly xzScale: DensityScaleValue; readonly yScale: DensityScaleValue; }&gt; &#124; Readonly&lt;{ readonly kind: 'old-blended-noise'; readonly source: string; readonly xzScale: DensityScaleValue; readonly yScale: DensityScaleValue; readonly xzFactor: DensityScaleValue; readonly yFactor: DensityScaleValue; readonly smearScaleMultiplier: DensityScaleValue; }&gt; &#124; Readonly&lt;{ readonly kind: 'beardifier'; }&gt; &#124; Readonly&lt;{ readonly kind: 'shift'; readonly source: string; }&gt; &#124; Readonly&lt;{ readonly kind: 'shift-a'; readonly source: string; }&gt; &#124; Readonly&lt;{ readonly kind: 'shift-b'; readonly source: string; }&gt; &#124; Readonly&lt;{ readonly kind: 'shifted-noise'; readonly source: string; readonly shiftX: DensityFunctionEncoded; readonly shiftY: DensityFunctionEncoded; readonly shiftZ: DensityFunctionEncoded; readonly xzScale: DensityScaleValue; readonly yScale: DensityScaleValue; }&gt; &#124; Readonly&lt;{ readonly kind: 'linear-operation'; readonly operation: 'add' &#124; 'mul'; readonly input: DensityFunctionEncoded; readonly argument: DensityValueType; }&gt; &#124; Readonly&lt;{ readonly kind: 'weird-scaled-sampler'; readonly input: DensityFunctionEncoded; readonly source: string; readonly rarityValueMapper: DensityRarityValueMapper; }&gt; &#124; Readonly&lt;{ readonly kind: 'end-islands'; readonly seed: string; }&gt; &#124; Readonly&lt;{ readonly kind: 'binary'; readonly operation: DensityBinaryOperation; readonly left: DensityFunctionEncoded; readonly right: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'unary'; readonly operation: DensityUnaryOperation; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'clamp'; readonly input: DensityFunctionEncoded; readonly min: DensityValueType; readonly max: DensityValueType; }&gt; &#124; Readonly&lt;{ readonly kind: 'range-choice'; readonly input: DensityFunctionEncoded; readonly minInclusive: DensityValueType; readonly maxExclusive: DensityValueType; readonly inRange: DensityFunctionEncoded; readonly outOfRange: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'find-top-surface'; readonly density: DensityFunctionEncoded; readonly upperBound: DensityFunctionEncoded; readonly lowerBound: BlockAxis; readonly cellHeight: DensityCellSizeValue; }&gt; &#124; Readonly&lt;{ readonly kind: 'y-clamped-gradient'; readonly fromY: BlockAxis; readonly toY: BlockAxis; readonly fromValue: DensityValueType; readonly toValue: DensityValueType; }&gt; &#124; Readonly&lt;{ readonly kind: 'spline'; readonly input: DensityFunctionEncoded; readonly spline: EncodedSpline; }&gt; &#124; Readonly&lt;{ readonly kind: 'interpolated'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'flat-cache'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'cache-2d'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'cache-once'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'cache-all-in-cell'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'blend-density'; readonly input: DensityFunctionEncoded; }&gt; &#124; Readonly&lt;{ readonly kind: 'blend-alpha'; }&gt; &#124; Readonly&lt;{ readonly kind: 'blend-offset'; }&gt;;</code> |
| `DensityFunctionFunctionContext` | <code>export type DensityFunctionFunctionContext = Readonly&lt;{ readonly blockX: () =&gt; number; readonly blockY: () =&gt; number; readonly blockZ: () =&gt; number; readonly getBlender: () =&gt; Blender; }&gt;;</code> | <code>export type DensityFunctionFunctionContext = Readonly&lt;{ readonly blockX: () =&gt; PositionAxis; readonly blockY: () =&gt; PositionAxis; readonly blockZ: () =&gt; PositionAxis; readonly getBlender: () =&gt; Blender; }&gt;;</code> |
| `DensityMappedNoiseArguments` | <code>export type DensityMappedNoiseArguments = readonly [ fromY: number, toY: number ] &#124; readonly [ yScale: number, fromY: number, toY: number ] &#124; readonly [ xzScale: number, yScale: number, fromY: number, toY: number ];</code> | <code>export type DensityMappedNoiseArguments = readonly [ fromY: BlockAxis, toY: BlockAxis ] &#124; readonly [ yScale: DensityScaleValue, fromY: BlockAxis, toY: BlockAxis ] &#124; readonly [ xzScale: DensityScaleValue, yScale: DensityScaleValue, fromY: BlockAxis, toY: BlockAxis ];</code> |
| `DensityOldBlendedNoiseSample` | <code>export type DensityOldBlendedNoiseSample = readonly [ x: number, y: number, z: number, yScale: number, yMax: number ];</code> | <code>export type DensityOldBlendedNoiseSample = readonly [ x: PositionAxis, y: PositionAxis, z: PositionAxis, yScale: DensityScale, yMax: PositionAxis ];</code> |
| `DensityPosition` | <code>export type DensityPosition = Position;</code> | <code>export type DensityPosition = Readonly&lt;{ readonly x: PositionAxis; readonly y: PositionAxis; readonly z: PositionAxis; }&gt;;</code> |
| `densityYClampedGradient` | <code>export declare const densityYClampedGradient: (fromY: number, toY: number, fromValue: number, toValue: number) =&gt; DensityFunction;</code> | <code>export declare const densityYClampedGradient: (fromY: BlockAxis, toY: BlockAxis, fromValue: DensityValue, toValue: DensityValue) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityYClampedGradient` | <code>export type DensityYClampedGradient = DensityBounds &amp; Readonly&lt;{ readonly kind: 'y-clamped-gradient'; readonly fromY: number; readonly toY: number; readonly fromValue: number; readonly toValue: number; }&gt;;</code> | <code>export type DensityYClampedGradient = DensityBounds &amp; Readonly&lt;{ readonly kind: 'y-clamped-gradient'; readonly fromY: BlockAxis; readonly toY: BlockAxis; readonly fromValue: DensityValue; readonly toValue: DensityValue; }&gt;;</code> |
| `MINECRAFT_LAKE_LEVEL` | <code>export declare const MINECRAFT_LAKE_LEVEL = 63;</code> | <code>export declare const MINECRAFT_LAKE_LEVEL: BlockAxisValue;</code> |
| `MINECRAFT_MAX_SURFACE_Y` | <code>export declare const MINECRAFT_MAX_SURFACE_Y = 92;</code> | <code>export declare const MINECRAFT_MAX_SURFACE_Y: BlockAxisValue;</code> |
| `MINECRAFT_MIN_SURFACE_Y` | <code>export declare const MINECRAFT_MIN_SURFACE_Y = 38;</code> | <code>export declare const MINECRAFT_MIN_SURFACE_Y: BlockAxisValue;</code> |
| `MINECRAFT_RIVER_WATER_LEVEL` | <code>export declare const MINECRAFT_RIVER_WATER_LEVEL = 62;</code> | <code>export declare const MINECRAFT_RIVER_WATER_LEVEL: BlockAxisValue;</code> |
| `MINECRAFT_SEA_LEVEL` | <code>export declare const MINECRAFT_SEA_LEVEL = 63;</code> | <code>export declare const MINECRAFT_SEA_LEVEL: BlockAxisValue;</code> |
| `minecraftComputeLakeBasin` | <code>export declare const minecraftComputeLakeBasin: (biome: MinecraftBiome, lakeNoiseValue: number, initialSurfaceY: number, terrainLevels?: MinecraftTerrainLevels) =&gt; number &#124; undefined;</code> | <code>export declare const minecraftComputeLakeBasin: (biome: MinecraftBiome, lakeNoiseValue: MinecraftClimateValue, initialSurfaceY: BlockAxisValue, terrainLevels?: MinecraftTerrainLevels) =&gt; Result.Result&lt;Option.Option&lt;BlockAxisValue&gt;, RangeError&gt;;</code> |
| `minecraftDetermineWaterLevel` | <code>export declare const minecraftDetermineWaterLevel: (biome: MinecraftBiome, surfaceY: number, lakeBasinY: number &#124; undefined, terrainLevels?: MinecraftTerrainLevels) =&gt; number &#124; undefined;</code> | <code>export declare const minecraftDetermineWaterLevel: (biome: MinecraftBiome, surfaceY: BlockAxisValue, lakeBasinY: Option.Option&lt;BlockAxisValue&gt;, terrainLevels?: MinecraftTerrainLevels) =&gt; Option.Option&lt;BlockAxisValue&gt;;</code> |
| `minecraftIsLakeShoreColumn` | <code>export declare const minecraftIsLakeShoreColumn: (lakeBasinY: number &#124; undefined, lakeNoiseValue: number, surfaceY: number, terrainLevels: MinecraftTerrainLevels) =&gt; boolean;</code> | <code>export declare const minecraftIsLakeShoreColumn: (lakeBasinY: Option.Option&lt;BlockAxisValue&gt;, lakeNoiseValue: MinecraftClimateValue, surfaceY: BlockAxisValue, terrainLevels: MinecraftTerrainLevels) =&gt; boolean;</code> |
| `minecraftResolveSurfaceY` | <code>export declare const minecraftResolveSurfaceY: (biome: MinecraftBiome, initialSurfaceY: number, lakeBasinY: number &#124; undefined) =&gt; number;</code> | <code>export declare const minecraftResolveSurfaceY: (biome: MinecraftBiome, initialSurfaceY: BlockAxisValue, lakeBasinY: Option.Option&lt;BlockAxisValue&gt;) =&gt; Result.Result&lt;BlockAxisValue, RangeError&gt;;</code> |
| `MinecraftSurfaceBiome` | <code>export type MinecraftSurfaceBiome = Readonly&lt;{ biome: MinecraftBiome; surfaceY: number; }&gt;;</code> | <code>export type MinecraftSurfaceBiome = Readonly&lt;{ biome: MinecraftBiome; surfaceY: BlockAxisValue; }&gt;;</code> |
| `minecraftSurfaceHeightFromContinentalness` | <code>export declare const minecraftSurfaceHeightFromContinentalness: (continentalness: number) =&gt; number;</code> | <code>export declare const minecraftSurfaceHeightFromContinentalness: (continentalness: MinecraftClimateValueType) =&gt; BlockAxisValue;</code> |
| `MinecraftTerrainColumn` | <code>export type MinecraftTerrainColumn = Readonly&lt;{ biome: MinecraftBiome; initialSurfaceY: number; lakeBasinY: number &#124; undefined; surface: MinecraftResolvedSurfaceMaterial; surfaceY: number; temperature: number; waterLevel: number &#124; undefined; }&gt;;</code> | <code>export type MinecraftTerrainColumn = Readonly&lt;{ biome: MinecraftBiome; initialSurfaceY: BlockAxis; lakeBasinY: Option.Option&lt;BlockAxis&gt;; surface: MinecraftResolvedSurfaceMaterial; surfaceY: BlockAxis; temperature: MinecraftClimateValueType; waterLevel: Option.Option&lt;BlockAxis&gt;; }&gt;;</code> |
| `MinecraftTerrainLevels` | <code>export type MinecraftTerrainLevels = Readonly&lt;{ seaLevel: number; lakeLevel: number; }&gt;;</code> | <code>export type MinecraftTerrainLevels = Readonly&lt;{ seaLevel: BlockAxisValue; lakeLevel: BlockAxisValue; }&gt;;</code> |
| `noise2DBatchXY` | <code>export declare const noise2DBatchXY: (primitives: NoisePrimitives, xs: readonly number[], zs: readonly number[]) =&gt; ReadonlyArray&lt;number&gt;;</code> | <code>export declare const noise2DBatchXY: (primitives: NoisePrimitives, xs: readonly PositionAxis[], zs: readonly PositionAxis[]) =&gt; Result.Result&lt;ReadonlyArray&lt;number&gt;, RangeError&gt;;</code> |
| `noise3DBatchXYZ` | <code>export declare const noise3DBatchXYZ: (primitives: NoisePrimitives, xs: readonly number[], ys: readonly number[], zs: readonly number[]) =&gt; ReadonlyArray&lt;number&gt;;</code> | <code>export declare const noise3DBatchXYZ: (primitives: NoisePrimitives, xs: readonly PositionAxis[], ys: readonly PositionAxis[], zs: readonly PositionAxis[]) =&gt; Result.Result&lt;ReadonlyArray&lt;number&gt;, RangeError&gt;;</code> |
| `NoiseChunk3DSamplingOptions` | <code>export type NoiseChunk3DSamplingOptions = Readonly&lt;{ readonly originY: number; readonly stepX?: number; readonly stepY?: number; readonly stepZ?: number; }&gt;;</code> | <code>export type NoiseChunk3DSamplingOptions = Readonly&lt;{ readonly originY: PositionAxis; readonly stepX?: GridStep; readonly stepY?: GridStep; readonly stepZ?: GridStep; }&gt;;</code> |
| `NoiseChunkSamplingOptions` | <code>export type NoiseChunkSamplingOptions = Readonly&lt;{ readonly sampleStride?: number; }&gt;;</code> | <code>export type NoiseChunkSamplingOptions = Readonly&lt;{ readonly sampleStride?: SampleStride; }&gt;;</code> |
| `NoiseField` | <code>export type NoiseField = { readonly seed: NoiseSeed; readonly raw2d: NoiseFn2D; readonly raw3d: NoiseFn3D; readonly noise2d: NoiseFn2D; readonly noise3d: NoiseFn3D; readonly octave2d: (x: number, z: number, params?: OctaveParams) =&gt; number; readonly channel: (name: NoiseChannel) =&gt; NoiseFn2D; };</code> | <code>export type NoiseField = { readonly seed: NoiseSeed; readonly raw2d: NoiseFn2D; readonly raw3d: NoiseFn3D; readonly noise2d: NoiseFn2D; readonly noise3d: NoiseFn3D; readonly octave2d: (x: PositionAxis, z: PositionAxis, params?: OctaveParams) =&gt; Result.Result&lt;NormalizedNoise, RangeError&gt;; readonly channel: (name: NoiseChannel) =&gt; NoiseFn2D; };</code> |
| `NoiseGrid2DOptions` | <code>export type NoiseGrid2DOptions = Readonly&lt;{ readonly width: number; readonly depth: number; readonly originX?: number; readonly originZ?: number; readonly stepX?: number; readonly stepZ?: number; }&gt;;</code> | <code>export type NoiseGrid2DOptions = Readonly&lt;{ readonly width: GridDimension; readonly depth: GridDimension; readonly originX?: number; readonly originZ?: number; readonly stepX?: GridStep; readonly stepZ?: GridStep; }&gt;;</code> |
| `NoiseGrid3DOptions` | <code>export type NoiseGrid3DOptions = Readonly&lt;{ readonly width: number; readonly height: number; readonly depth: number; readonly originX?: number; readonly originY?: number; readonly originZ?: number; readonly stepX?: number; readonly stepY?: number; readonly stepZ?: number; }&gt;;</code> | <code>export type NoiseGrid3DOptions = Readonly&lt;{ readonly width: GridDimension; readonly height: GridDimension; readonly depth: GridDimension; readonly originX?: number; readonly originY?: number; readonly originZ?: number; readonly stepX?: GridStep; readonly stepY?: GridStep; readonly stepZ?: GridStep; }&gt;;</code> |
| `NoiseInterpolatedGrid3DOptions` | <code>export type NoiseInterpolatedGrid3DOptions = Readonly&lt;NoiseGrid3DOptions &amp; { readonly sampleStrideX?: number; readonly sampleStrideY?: number; readonly sampleStrideZ?: number; }&gt;;</code> | <code>export type NoiseInterpolatedGrid3DOptions = Readonly&lt;NoiseGrid3DOptions &amp; { readonly sampleStrideX?: SampleStride; readonly sampleStrideY?: SampleStride; readonly sampleStrideZ?: SampleStride; }&gt;;</code> |
| `NoiseInterpolatedGridOptions` | <code>export type NoiseInterpolatedGridOptions = Readonly&lt;NoiseGrid2DOptions &amp; { readonly sampleStride?: number; }&gt;;</code> | <code>export type NoiseInterpolatedGridOptions = Readonly&lt;NoiseGrid2DOptions &amp; { readonly sampleStride?: SampleStride; }&gt;;</code> |
| `NoisePrimitives` | <code>export type NoisePrimitives = Readonly&lt;{ raw2D: NoiseFn2D; raw3D: NoiseFn3D; continentalness: NoiseFn2D; erosion: NoiseFn2D; weirdness: NoiseFn2D; jaggedness: NoiseFn2D; noise2D: NoiseFn2D; octaveNoise2D: (...args: OctaveNoiseArguments) =&gt; number; noise3D: NoiseFn3D; continentalnessAt: NoiseFn2D; erosionAt: NoiseFn2D; weirdnessAt: NoiseFn2D; jaggednessAt: NoiseFn2D; sampleTerrainChannels: (xStart: number, zStart: number) =&gt; TerrainChannelSamples; }&gt;;</code> | <code>export type NoisePrimitives = Readonly&lt;{ raw2D: NoiseFn2D; raw3D: NoiseFn3D; continentalness: NoiseFn2D; erosion: NoiseFn2D; weirdness: NoiseFn2D; jaggedness: NoiseFn2D; noise2D: NoiseFn2D; octaveNoise2D: (...args: OctaveNoiseArguments) =&gt; Result.Result&lt;NormalizedNoise, RangeError&gt;; noise3D: NoiseFn3D; continentalnessAt: NoiseFn2D; erosionAt: NoiseFn2D; weirdnessAt: NoiseFn2D; jaggednessAt: NoiseFn2D; sampleTerrainChannels: (xStart: BlockAxis, zStart: BlockAxis) =&gt; Result.Result&lt;TerrainChannelSamples, RangeError&gt;; }&gt;;</code> |
| `octaveNoise2D` | <code>export declare const octaveNoise2D: (noiseFn: NoiseFn2D, x: number, z: number, params: OctaveParams) =&gt; number;</code> | <code>export declare const octaveNoise2D: (noiseFn: NoiseFn2D, x: PositionAxis, z: PositionAxis, params: OctaveParams) =&gt; Result.Result&lt;NormalizedNoise, RangeError&gt;;</code> |
| `OctaveNoiseArguments` | <code>export type OctaveNoiseArguments = readonly [ x: number, z: number, ...octaveParameters: OctaveParameters ];</code> | <code>export type OctaveNoiseArguments = readonly [ x: PositionAxis, z: PositionAxis, ...octaveParameters: OctaveParameters ];</code> |
| `Point2D` | <code>export type Point2D = readonly [ x: number, z: number ];</code> | <code>export type Point2D = readonly [ x: PositionAxis, z: PositionAxis ];</code> |
| `resolveMinecraftSurfaceMaterial` | <code>export declare const resolveMinecraftSurfaceMaterial: (biome: MinecraftBiome, surfaceY: number, waterLevel: number, options?: MinecraftSurfaceMaterialOptions) =&gt; MinecraftResolvedSurfaceMaterial;</code> | <code>export declare const resolveMinecraftSurfaceMaterial: (biome: MinecraftBiome, surfaceY: BlockAxis, waterLevel: BlockAxis, options?: MinecraftSurfaceMaterialOptions) =&gt; MinecraftResolvedSurfaceMaterial;</code> |
| `sampleClimate` | <code>export declare const sampleClimate: (samplerValue: ClimateSampler, position: DensityPosition, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; ClimateTargetPoint;</code> | <code>export declare const sampleClimate: (samplerValue: ClimateSampler, positionValue: Position, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; Result.Result&lt;ClimateTargetPoint, TypeError &#124; RangeError&gt;;</code> |

</details>
<details>
<summary>Result changes (46)</summary>

| Export | Before | After |
| --- | --- | --- |
| `climateParameter` | <code>export declare const climateParameter: (point: number) =&gt; ClimateParameter;</code> | <code>export declare const climateParameter: (pointValue: ClimateValue) =&gt; Result.Result&lt;ClimateParameter, TypeError &#124; RangeError&gt;;</code> |
| `climateParameterDistance` | <code>export declare const climateParameterDistance: (parameter: ClimateParameter, targetValue: number) =&gt; number;</code> | <code>export declare const climateParameterDistance: (parameter: ClimateParameter, targetValue: QuantizedClimateValue) =&gt; Result.Result&lt;ClimateDistance, TypeError &#124; RangeError&gt;;</code> |
| `climateParameterPointFitness` | <code>export declare const climateParameterPointFitness: (pointValue: ClimateParameterPoint, targetValue: ClimateTargetPoint) =&gt; number;</code> | <code>export declare const climateParameterPointFitness: (pointValue: ClimateParameterPoint, targetValue: ClimateTargetPoint) =&gt; Result.Result&lt;ClimateFitness, TypeError &#124; RangeError&gt;;</code> |
| `climateParameterRange` | <code>export declare const climateParameterRange: (min: number, max: number) =&gt; ClimateParameter;</code> | <code>export declare const climateParameterRange: (min: ClimateValue, max: ClimateValue) =&gt; Result.Result&lt;ClimateParameter, TypeError &#124; RangeError&gt;;</code> |
| `climateParameters` | <code>export declare function climateParameters(...values: ClimateParameterArguments&lt;ClimateParameter&gt;): ClimateParameterPoint;</code><br><code>export declare function climateParameters(...values: ClimateParameterArguments&lt;number&gt;): ClimateParameterPoint;</code> | <code>export declare function climateParameters(...values: ClimateParameterArguments&lt;ClimateParameter&gt;): Result.Result&lt;ClimateParameterPoint, TypeError &#124; RangeError&gt;;</code><br><code>export declare function climateParameters(...values: ClimateParameterArguments&lt;ClimateValue&gt;): Result.Result&lt;ClimateParameterPoint, TypeError &#124; RangeError&gt;;</code> |
| `climateParameterSpace` | <code>export declare const climateParameterSpace: (pointValue: ClimateParameterPoint) =&gt; ClimateParameterSpace;</code> | <code>export declare const climateParameterSpace: (pointValue: ClimateParameterPoint) =&gt; Result.Result&lt;ClimateParameterSpace, TypeError &#124; RangeError&gt;;</code> |
| `climateParameterSpan` | <code>export declare function climateParameterSpan(min: ClimateParameter, max: ClimateParameter): ClimateParameter;</code><br><code>export declare function climateParameterSpan(min: number, max: number): ClimateParameter;</code> | <code>export declare function climateParameterSpan(min: ClimateParameter, max: ClimateParameter): Result.Result&lt;ClimateParameter, TypeError &#124; RangeError&gt;;</code><br><code>export declare function climateParameterSpan(min: ClimateValue, max: ClimateValue): Result.Result&lt;ClimateParameter, TypeError &#124; RangeError&gt;;</code> |
| `ClimateSamplerRuntime` | <code>export type ClimateSamplerRuntime = ClimateSampler &amp; Readonly&lt;{ readonly sample: (x: number, y: number, z: number, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; ClimateTargetPoint; readonly findSpawnPosition: (options?: ClimateSpawnSearchOptions) =&gt; BlockPosition &#124; undefined; }&gt;;</code> | <code>export type ClimateSamplerRuntime = ClimateSampler &amp; Readonly&lt;{ readonly sample: (position: Position, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; Result.Result&lt;ClimateTargetPoint, TypeError &#124; RangeError&gt;; readonly findSpawnPosition: (options?: ClimateSpawnSearchOptions) =&gt; Result.Result&lt;Option.Option&lt;BlockPosition&gt;, TypeError &#124; RangeError&gt;; }&gt;;</code> |
| `climateTarget` | <code>export declare const climateTarget: (...values: ClimateTargetValues) =&gt; ClimateTargetPoint;</code> | <code>export declare const climateTarget: (...values: ClimateValueTargetValues) =&gt; Result.Result&lt;ClimateTargetPoint, TypeError &#124; RangeError&gt;;</code> |
| `computeOctaveNoise` | <code>export declare const computeOctaveNoise: (...args: readonly [ noiseFn: NoiseFn2D, ...OctaveNoiseArguments ]) =&gt; number;</code> | <code>export declare const computeOctaveNoise: (...args: readonly [ noiseFn: NoiseFn2D, ...OctaveNoiseArguments ]) =&gt; Result.Result&lt;NormalizedNoise, RangeError&gt;;</code> |
| `computeTerrainChannels` | <code>export declare const computeTerrainChannels: (...args: TerrainChannelArguments) =&gt; TerrainChannelSamples;</code> | <code>export declare const computeTerrainChannels: (...args: TerrainChannelArguments) =&gt; Result.Result&lt;TerrainChannelSamples, RangeError&gt;;</code> |
| `createClimateParameterList` | <code>export declare const createClimateParameterList: &lt;Value&gt;(entries: readonly ClimateParameterListEntry&lt;Value&gt;[]) =&gt; ClimateParameterList&lt;Value&gt;;</code> | <code>export declare const createClimateParameterList: &lt;Value&gt;(entries: readonly ClimateParameterListEntry&lt;Value&gt;[]) =&gt; Result.Result&lt;ClimateParameterList&lt;Value&gt;, TypeError &#124; RangeError&gt;;</code> |
| `createClimateParameterPointFromQuantized` | <code>export declare const createClimateParameterPointFromQuantized: (parameters: ClimateParameterSpace, offset: number) =&gt; ClimateParameterPoint;</code> | <code>export declare const createClimateParameterPointFromQuantized: (parameters: ClimateParameterSpace, offset: QuantizedClimateValue) =&gt; Result.Result&lt;ClimateParameterPoint, TypeError &#124; RangeError&gt;;</code> |
| `createClimateParameterSpace` | <code>export declare const createClimateParameterSpace: (...values: ClimateParameterInputValues) =&gt; ClimateParameterSpace;</code> | <code>export declare const createClimateParameterSpace: (...values: ClimateParameterInputValues) =&gt; Result.Result&lt;ClimateParameterSpace, TypeError &#124; RangeError&gt;;</code> |
| `createClimateSampler` | <code>export declare const createClimateSampler: (options: ClimateSamplerOptions) =&gt; ClimateSampler;</code> | <code>export declare const createClimateSampler: (options: ClimateSamplerOptions) =&gt; Result.Result&lt;ClimateSampler, TypeError &#124; RangeError&gt;;</code> |
| `createClimateSamplerRuntime` | <code>export declare const createClimateSamplerRuntime: (samplerValue: ClimateSampler) =&gt; ClimateSamplerRuntime;</code> | <code>export declare const createClimateSamplerRuntime: (samplerValue: ClimateSampler) =&gt; Result.Result&lt;ClimateSamplerRuntime, TypeError &#124; RangeError&gt;;</code> |
| `createClimateTargetPointFromQuantized` | <code>export declare const createClimateTargetPointFromQuantized: (...values: ClimateTargetValues) =&gt; ClimateTargetPoint;</code> | <code>export declare const createClimateTargetPointFromQuantized: (...values: ClimateTargetValues) =&gt; Result.Result&lt;ClimateTargetPoint, TypeError &#124; RangeError&gt;;</code> |
| `createSimplexNoise2D` | <code>export declare const createSimplexNoise2D: (rand: RandFn, options?: SimplexNoise2DOptions) =&gt; NoiseFn2D;</code> | <code>export declare const createSimplexNoise2D: (rand: RandFn, options?: SimplexNoise2DOptions) =&gt; Result.Result&lt;NoiseFn2D, RangeError&gt;;</code> |
| `createSimplexNoise3D` | <code>export declare const createSimplexNoise3D: (rand: RandFn, options?: SimplexNoise3DOptions) =&gt; NoiseFn3D;</code> | <code>export declare const createSimplexNoise3D: (rand: RandFn, options?: SimplexNoise3DOptions) =&gt; Result.Result&lt;NoiseFn3D, RangeError&gt;;</code> |
| `createSpline` | <code>export declare const createSpline: (controlPoints: Spline) =&gt; Spline;</code> | <code>export declare const createSpline: (controlPoints: Spline) =&gt; Result.Result&lt;Spline, TypeError &#124; RangeError&gt;;</code> |
| `empty` | <code>export declare const empty: () =&gt; ClimateSampler;</code> | <code>export declare const empty: () =&gt; Result.Result&lt;ClimateSampler, TypeError &#124; RangeError&gt;;</code> |
| `evaluateSpline` | <code>export declare const evaluateSpline: (spline: Spline, input: number) =&gt; number;</code> | <code>export declare const evaluateSpline: (spline: Spline, input: SplineInput) =&gt; Result.Result&lt;SplineValue, TypeError &#124; RangeError&gt;;</code> |
| `findClimateSpawnPosition` | <code>export declare const findClimateSpawnPosition: (samplerValue: ClimateSampler, targets?: readonly ClimateParameterPoint[], options?: ClimateSpawnSearchOptions) =&gt; BlockPosition &#124; undefined;</code> | <code>export declare const findClimateSpawnPosition: (samplerValue: ClimateSampler, targets?: readonly ClimateParameterPoint[], options?: ClimateSpawnSearchOptions) =&gt; Result.Result&lt;Option.Option&lt;BlockPosition&gt;, TypeError &#124; RangeError&gt;;</code> |
| `findClimateValue` | <code>export declare const findClimateValue: &lt;Value&gt;(listValue: ClimateParameterList&lt;Value&gt;, targetValue: ClimateTargetPoint) =&gt; Value &#124; undefined;</code> | <code>export declare const findClimateValue: &lt;Value&gt;(listValue: ClimateParameterList&lt;Value&gt;, targetValue: ClimateTargetPoint) =&gt; Result.Result&lt;Option.Option&lt;Value&gt;, TypeError &#124; RangeError&gt;;</code> |
| `findClimateValueBruteForce` | <code>export declare const findClimateValueBruteForce: &lt;Value&gt;(listValue: ClimateParameterList&lt;Value&gt;, targetValue: ClimateTargetPoint) =&gt; Value &#124; undefined;</code> | <code>export declare const findClimateValueBruteForce: &lt;Value&gt;(listValue: ClimateParameterList&lt;Value&gt;, targetValue: ClimateTargetPoint) =&gt; Result.Result&lt;Option.Option&lt;Value&gt;, TypeError &#124; RangeError&gt;;</code> |
| `findClimateValueIndex` | <code>export declare const findClimateValueIndex: &lt;Value&gt;(listValue: ClimateParameterList&lt;Value&gt;, targetValue: ClimateTargetPoint) =&gt; number &#124; undefined;</code> | <code>export declare const findClimateValueIndex: &lt;Value&gt;(listValue: ClimateParameterList&lt;Value&gt;, targetValue: ClimateTargetPoint) =&gt; Result.Result&lt;Option.Option&lt;ClimateListIndex&gt;, TypeError &#124; RangeError&gt;;</code> |
| `findSpawnPosition` | <code>export declare const findSpawnPosition: (targets: readonly ClimateParameterPoint[], samplerValue: ClimateSampler, options?: ClimateSpawnSearchOptions) =&gt; BlockPosition &#124; undefined;</code> | <code>export declare const findSpawnPosition: (targets: readonly ClimateParameterPoint[], samplerValue: ClimateSampler, options?: ClimateSpawnSearchOptions) =&gt; Result.Result&lt;Option.Option&lt;BlockPosition&gt;, TypeError &#124; RangeError&gt;;</code> |
| `minecraftBiomeFor` | <code>export declare const minecraftBiomeFor: ({ levels, seed, surfaceY, wx, wz, }: MinecraftBiomeQuery) =&gt; MinecraftBiome;</code> | <code>export declare const minecraftBiomeFor: ({ levels, seed, surfaceY, wx, wz, }: MinecraftBiomeQuery) =&gt; Result.Result&lt;MinecraftBiome, RangeError&gt;;</code> |
| `noise2DBatch` | <code>export declare const noise2DBatch: (primitives: NoisePrimitives, points: readonly Point2D[]) =&gt; ReadonlyArray&lt;number&gt;;</code> | <code>export declare const noise2DBatch: (primitives: NoisePrimitives, points: readonly Point2D[]) =&gt; Result.Result&lt;ReadonlyArray&lt;number&gt;, RangeError&gt;;</code> |
| `octaveNoise2DBatch` | <code>export declare const octaveNoise2DBatch: (...args: OctavePointBatchArguments) =&gt; ReadonlyArray&lt;number&gt;;</code> | <code>export declare const octaveNoise2DBatch: (...args: OctavePointBatchArguments) =&gt; Result.Result&lt;ReadonlyArray&lt;number&gt;, RangeError&gt;;</code> |
| `octaveNoise2DBatchXY` | <code>export declare const octaveNoise2DBatchXY: (...args: OctaveBatchArguments) =&gt; ReadonlyArray&lt;number&gt;;</code> | <code>export declare const octaveNoise2DBatchXY: (...args: OctaveBatchArguments) =&gt; Result.Result&lt;ReadonlyArray&lt;number&gt;, RangeError&gt;;</code> |
| `quantizeCoord` | <code>export declare const quantizeCoord: (value: number) =&gt; number;</code> | <code>export declare const quantizeCoord: (value: ClimateValue) =&gt; Result.Result&lt;QuantizedClimateValue, RangeError&gt;;</code> |
| `requireClimateParameter` | <code>export declare const requireClimateParameter: (name: string, value: unknown) =&gt; ClimateParameter;</code> | <code>export declare const requireClimateParameter: (name: ClimateFieldName, value: unknown) =&gt; Result.Result&lt;ClimateParameter, TypeError &#124; RangeError&gt;;</code> |
| `requireClimateParameterList` | <code>export declare const requireClimateParameterList: &lt;Value&gt;(value: unknown) =&gt; ClimateParameterList&lt;Value&gt;;</code> | <code>export declare const requireClimateParameterList: &lt;Value&gt;(value: unknown) =&gt; Result.Result&lt;ClimateParameterList&lt;Value&gt;, TypeError &#124; RangeError&gt;;</code> |
| `requireClimateParameterPoint` | <code>export declare const requireClimateParameterPoint: (name: string, value: unknown) =&gt; ClimateParameterPoint;</code> | <code>export declare const requireClimateParameterPoint: (name: ClimateFieldName, value: unknown) =&gt; Result.Result&lt;ClimateParameterPoint, TypeError &#124; RangeError&gt;;</code> |
| `requireClimateSampler` | <code>export declare const requireClimateSampler: (value: unknown) =&gt; ClimateSampler;</code> | <code>export declare const requireClimateSampler: (value: unknown) =&gt; Result.Result&lt;ClimateSampler, TypeError &#124; RangeError&gt;;</code> |
| `sampleClimateAt` | <code>export declare const sampleClimateAt: (samplerValue: ClimateSampler, ...coordinates: readonly [ x: number, y: number, z: number, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession ]) =&gt; ClimateTargetPoint;</code> | <code>export declare const sampleClimateAt: (samplerValue: ClimateSampler, positionValue: Position, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; Result.Result&lt;ClimateTargetPoint, TypeError &#124; RangeError&gt;;</code> |
| `sampleNoise2DBatch` | <code>export declare const sampleNoise2DBatch: (noise: NoiseFn2D, points: ReadonlyArray&lt;NoisePoint2D&gt;) =&gt; Float32Array;</code> | <code>export declare const sampleNoise2DBatch: (noise: NoiseFn2D, points: ReadonlyArray&lt;NoisePoint2D&gt;) =&gt; Result.Result&lt;Float32Array, RangeError&gt;;</code> |
| `sampleNoise2DChunk` | <code>export declare const sampleNoise2DChunk: (noise: NoiseFn2D, chunk: ChunkCoord, options?: NoiseChunkSamplingOptions) =&gt; Float32Array;</code> | <code>export declare const sampleNoise2DChunk: (noise: NoiseFn2D, chunk: ChunkCoord, options?: NoiseChunkSamplingOptions) =&gt; Result.Result&lt;Float32Array, RangeError&gt;;</code> |
| `sampleNoise2DGrid` | <code>export declare const sampleNoise2DGrid: (noise: NoiseFn2D, options: NoiseGrid2DOptions) =&gt; Float32Array;</code> | <code>export declare const sampleNoise2DGrid: (noise: NoiseFn2D, options: NoiseGrid2DOptions) =&gt; Result.Result&lt;Float32Array, RangeError&gt;;</code> |
| `sampleNoise2DInterpolatedGrid` | <code>export declare const sampleNoise2DInterpolatedGrid: (noise: NoiseFn2D, options: NoiseInterpolatedGridOptions) =&gt; Float32Array;</code> | <code>export declare const sampleNoise2DInterpolatedGrid: (noise: NoiseFn2D, options: NoiseInterpolatedGridOptions) =&gt; Result.Result&lt;Float32Array, RangeError&gt;;</code> |
| `sampleNoise3DBatch` | <code>export declare const sampleNoise3DBatch: (noise: NoiseFn3D, points: ReadonlyArray&lt;NoisePoint3D&gt;) =&gt; Float32Array;</code> | <code>export declare const sampleNoise3DBatch: (noise: NoiseFn3D, points: ReadonlyArray&lt;NoisePoint3D&gt;) =&gt; Result.Result&lt;Float32Array, RangeError&gt;;</code> |
| `sampleNoise3DChunk` | <code>export declare const sampleNoise3DChunk: (noise: NoiseFn3D, chunk: ChunkCoord, height: ChunkHeight, options: NoiseChunk3DSamplingOptions) =&gt; Float32Array;</code> | <code>export declare const sampleNoise3DChunk: (noise: NoiseFn3D, chunk: ChunkCoord, height: ChunkHeight, options: NoiseChunk3DSamplingOptions) =&gt; Result.Result&lt;Float32Array, RangeError&gt;;</code> |
| `sampleNoise3DGrid` | <code>export declare const sampleNoise3DGrid: (noise: NoiseFn3D, options: NoiseGrid3DOptions) =&gt; Float32Array;</code> | <code>export declare const sampleNoise3DGrid: (noise: NoiseFn3D, options: NoiseGrid3DOptions) =&gt; Result.Result&lt;Float32Array, RangeError&gt;;</code> |
| `sampleNoise3DInterpolatedGrid` | <code>export declare const sampleNoise3DInterpolatedGrid: (noise: NoiseFn3D, options: NoiseInterpolatedGrid3DOptions) =&gt; Float32Array;</code> | <code>export declare const sampleNoise3DInterpolatedGrid: (noise: NoiseFn3D, options: NoiseInterpolatedGrid3DOptions) =&gt; Result.Result&lt;Float32Array, RangeError&gt;;</code> |
| `unquantizeCoord` | <code>export declare const unquantizeCoord: (value: number) =&gt; number;</code> | <code>export declare const unquantizeCoord: (value: QuantizedClimateValue) =&gt; Result.Result&lt;ClimateValue, TypeError &#124; RangeError&gt;;</code> |

</details>
<details>
<summary>Other signature changes (109)</summary>

| Export | Before | After |
| --- | --- | --- |
| `BlendingOutput` | <code>export type BlendingOutput = Readonly&lt;{ readonly alpha: number; readonly blendingOffset: number; }&gt;;</code> | <code>export type BlendingOutput = Readonly&lt;{ readonly alpha: DensityValue; readonly blendingOffset: DensityValue; }&gt;;</code> |
| `clampSigned` | <code>export declare const clampSigned: (value: number) =&gt; number;</code> | <code>export declare const clampSigned: (value: NoiseAccumulator) =&gt; BoundedNoise;</code> |
| `classifyMinecraftBiome` | <code>export declare const classifyMinecraftBiome: (temperature: number, humidity: number) =&gt; MinecraftBiome;</code> | <code>export declare const classifyMinecraftBiome: (temperature: MinecraftClimateValue, humidity: MinecraftClimateValue) =&gt; MinecraftBiome;</code> |
| `ClimateParameter` | <code>export type ClimateParameter = Readonly&lt;{ readonly min: number; readonly max: number; }&gt;;</code> | <code>export type ClimateParameter = Readonly&lt;{ readonly min: QuantizedClimateValue; readonly max: QuantizedClimateValue; }&gt;;</code> |
| `ClimateParameterPoint` | <code>export type ClimateParameterPoint = ClimateParameterSpace &amp; Readonly&lt;{ readonly offset: number; }&gt;;</code> | <code>export type ClimateParameterPoint = ClimateParameterSpace &amp; Readonly&lt;{ readonly offset: QuantizedClimateValue; }&gt;;</code> |
| `ClimateSpawnSearchOptions` | <code>export type ClimateSpawnSearchOptions = Readonly&lt;{ readonly origin?: Position; readonly radius?: number; readonly verticalRadius?: number; readonly step?: number; readonly context?: DensityEvaluationContext &#124; DensityEvaluationSession; }&gt;;</code> | <code>export type ClimateSpawnSearchOptions = Readonly&lt;{ readonly context?: DensityEvaluationContext &#124; DensityEvaluationSession; readonly origin?: BlockPosition; readonly radius?: ClimateSearchRadius; readonly verticalRadius?: ClimateSearchRadius; readonly step?: ClimateSearchStep; }&gt;;</code> |
| `ClimateTargetPoint` | <code>export type ClimateTargetPoint = Readonly&lt;{ readonly temperature: number; readonly humidity: number; readonly continentalness: number; readonly erosion: number; readonly depth: number; readonly weirdness: number; }&gt;;</code> | <code>export type ClimateTargetPoint = Readonly&lt;{ readonly temperature: QuantizedClimateValue; readonly humidity: QuantizedClimateValue; readonly continentalness: QuantizedClimateValue; readonly erosion: QuantizedClimateValue; readonly depth: QuantizedClimateValue; readonly weirdness: QuantizedClimateValue; }&gt;;</code> |
| `computeDensityFunction` | <code>export declare const computeDensityFunction: (densityValue: DensityFunction, context: DensityFunctionContext, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; number;</code> | <code>export declare const computeDensityFunction: (densityValue: DensityFunction, context: DensityFunctionContext, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; DensityFunctionResult&lt;DensityValueType&gt;;</code> |
| `ControlPoint` | <code>export type ControlPoint = readonly [ input: number, value: number ];</code> | <code>export type ControlPoint = readonly [ input: SplineInput, value: SplineValue ];</code> |
| `createBlender` | <code>export declare const createBlender: (options?: BlenderOptions) =&gt; Blender;</code> | <code>export declare const createBlender: (options?: BlenderOptions) =&gt; DensityFunctionResult&lt;Blender&gt;;</code> |
| `createDensityEvaluationContext` | <code>export declare const createDensityEvaluationContext: (options?: DensityEvaluationContextOptions) =&gt; DensityEvaluationContext;</code> | <code>export declare const createDensityEvaluationContext: (options?: DensityEvaluationContextOptions) =&gt; DensityFunctionResult&lt;DensityEvaluationContext&gt;;</code> |
| `createDensityEvaluationContextFromBlender` | <code>export declare const createDensityEvaluationContextFromBlender: (blender?: Blender, options?: DensityEvaluationContextOptions) =&gt; DensityEvaluationContext;</code> | <code>export declare const createDensityEvaluationContextFromBlender: (blender?: Blender, options?: DensityEvaluationContextOptions) =&gt; DensityFunctionResult&lt;DensityEvaluationContext&gt;;</code> |
| `createDensityEvaluationSession` | <code>export declare const createDensityEvaluationSession: (context: DensityEvaluationContext) =&gt; DensityEvaluationSession;</code> | <code>export declare const createDensityEvaluationSession: (context: DensityEvaluationContext) =&gt; DensityFunctionResult&lt;DensityEvaluationSession&gt;;</code> |
| `createDensityFunctionContextProvider` | <code>export declare const createDensityFunctionContextProvider: (contextSource: DensityFunctionIndexContextProvider, blender?: Blender, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; DensityFunctionContextProvider;</code> | <code>export declare const createDensityFunctionContextProvider: (contextSource: DensityFunctionIndexContextProvider, blender?: Blender, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; DensityFunctionResult&lt;DensityFunctionContextProvider&gt;;</code> |
| `createDensityFunctionFunctionContext` | <code>export declare const createDensityFunctionFunctionContext: (position: DensityPosition, blender?: Blender) =&gt; DensityFunctionFunctionContext;</code> | <code>export declare const createDensityFunctionFunctionContext: (position: DensityPosition, blender?: Blender) =&gt; DensityFunctionResult&lt;DensityFunctionFunctionContext&gt;;</code> |
| `createDensityFunctionNode` | <code>export declare const createDensityFunctionNode: (densityValue: DensityFunction, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; DensityFunctionNode;</code> | <code>export declare const createDensityFunctionNode: (densityValue: unknown, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;;</code> |
| `createDensityFunctionRuntime` | <code>export declare const createDensityFunctionRuntime: (densityValue: DensityFunction, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; DensityFunctionRuntime;</code> | <code>export declare const createDensityFunctionRuntime: (densityValue: DensityFunction, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; DensityFunctionResult&lt;DensityFunctionRuntime&gt;;</code> |
| `createDensityNoiseSource` | <code>export declare const createDensityNoiseSource: (sample: NoiseFn3D, bounds: DensityBounds) =&gt; DensityNoiseSource;</code> | <code>export declare const createDensityNoiseSource: (sample: NoiseFn3D, bounds: DensityBounds) =&gt; DensityFunctionResult&lt;DensityNoiseSource&gt;;</code> |
| `createDensityOldBlendedNoiseSource` | <code>export declare const createDensityOldBlendedNoiseSource: (source: Pick&lt;DensityOldBlendedNoiseSource, 'mainNoise' &#124; 'minLimitNoise' &#124; 'maxLimitNoise'&gt;, bounds: DensityBounds) =&gt; DensityOldBlendedNoiseSource;</code> | <code>export declare const createDensityOldBlendedNoiseSource: (source: Pick&lt;DensityOldBlendedNoiseSource, 'mainNoise' &#124; 'minLimitNoise' &#124; 'maxLimitNoise'&gt;, bounds: DensityBounds) =&gt; DensityFunctionResult&lt;DensityOldBlendedNoiseSource&gt;;</code> |
| `createDensitySpline` | <code>export declare const createDensitySpline: (coordinate: DensityFunction, spline: DensitySplineDefinition) =&gt; DensitySplineInput;</code> | <code>export declare const createDensitySpline: (coordinate: DensityFunction, spline: DensitySplineDefinition) =&gt; DensityFunctionResult&lt;DensitySplineInput&gt;;</code> |
| `createNoiseRouter` | <code>export declare const createNoiseRouter: (router: NoiseRouter) =&gt; NoiseRouter;</code> | <code>export declare const createNoiseRouter: (router: NoiseRouter) =&gt; DensityFunctionResult&lt;NoiseRouter&gt;;</code> |
| `createNoiseRouterRuntime` | <code>export declare const createNoiseRouterRuntime: (routerValue: NoiseRouter) =&gt; NoiseRouterRuntime;</code> | <code>export declare const createNoiseRouterRuntime: (routerValue: NoiseRouter) =&gt; DensityFunctionResult&lt;NoiseRouterRuntime&gt;;</code> |
| `decodeDensityFunction` | <code>export declare const decodeDensityFunction: (value: unknown, options?: DensityFunctionCodecOptions) =&gt; DensityFunction;</code> | <code>export declare const decodeDensityFunction: (value: unknown, options?: DensityFunctionCodecOptions) =&gt; DensityFunctionCodecResult&lt;DensityFunction&gt;;</code> |
| `densityAbs` | <code>export declare const densityAbs: (input: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityAbs: (input: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityAdd` | <code>export declare const densityAdd: (left: DensityFunction, right: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityAdd: (left: DensityFunction, right: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityBinary` | <code>export declare const densityBinary: (operation: DensityBinaryOperation, left: DensityFunction, right: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityBinary: (operation: DensityBinaryOperation, left: DensityFunction, right: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityBounds` | <code>export type DensityBounds = Readonly&lt;{ readonly minValue: number; readonly maxValue: number; }&gt;;</code> | <code>export type DensityBounds = Readonly&lt;{ readonly minValue: DensityBound; readonly maxValue: DensityBound; }&gt;;</code> |
| `densityClamp` | <code>export declare const densityClamp: (input: DensityFunction, min: number, max: number) =&gt; DensityFunction;</code> | <code>export declare const densityClamp: (input: DensityFunction, min: DensityValue, max: DensityValue) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityClamp` | <code>export type DensityClamp = DensityBounds &amp; Readonly&lt;{ readonly kind: 'clamp'; readonly input: DensityFunction; readonly min: number; readonly max: number; }&gt;;</code> | <code>export type DensityClamp = DensityBounds &amp; Readonly&lt;{ readonly kind: 'clamp'; readonly input: DensityFunction; readonly min: DensityValue; readonly max: DensityValue; }&gt;;</code> |
| `densityConstant` | <code>export declare const densityConstant: (value: number) =&gt; DensityFunction;</code> | <code>export declare const densityConstant: (value: DensityValueType) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityConstant` | <code>export type DensityConstant = DensityBounds &amp; Readonly&lt;{ readonly kind: 'constant'; readonly value: number; }&gt;;</code> | <code>export type DensityConstant = DensityBounds &amp; Readonly&lt;{ readonly kind: 'constant'; readonly value: DensityValue; }&gt;;</code> |
| `densityCube` | <code>export declare const densityCube: (input: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityCube: (input: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityEndIslands` | <code>export declare const densityEndIslands: (seed: bigint) =&gt; DensityFunction;</code> | <code>export declare const densityEndIslands: (seed: bigint) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityEvaluationSession` | <code>export type DensityEvaluationSession = Readonly&lt;{ readonly context: DensityEvaluationContext; readonly evaluate: (density: DensityFunction, position: DensityPosition) =&gt; number; readonly clear: () =&gt; void; }&gt;;</code> | <code>export type DensityEvaluationSession = Readonly&lt;{ readonly context: DensityEvaluationContext; readonly evaluate: (density: DensityFunction, position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;; readonly clear: () =&gt; void; }&gt;;</code> |
| `DensityFunctionContextProvider` | <code>export type DensityFunctionContextProvider = Readonly&lt;{ readonly forIndex: (index: number) =&gt; DensityFunctionFunctionContext; readonly fillAllDirectly: (array: number[] &#124; Float64Array, density: DensityFunction) =&gt; void; }&gt;;</code> | <code>export type DensityFunctionContextProvider = Readonly&lt;{ readonly forIndex: (index: DensityArrayIndex) =&gt; DensityFunctionResult&lt;DensityFunctionFunctionContext&gt;; readonly fillAllDirectly: (array: number[] &#124; Float64Array, density: DensityFunction) =&gt; DensityFunctionResult&lt;void&gt;; }&gt;;</code> |
| `DensityFunctionIndexContextProvider` | <code>export type DensityFunctionIndexContextProvider = (index: number) =&gt; DensityFunctionContext;</code> | <code>export type DensityFunctionIndexContextProvider = (index: DensityArrayIndex) =&gt; DensityFunctionContext;</code> |
| `densityFunctionMaxValue` | <code>export declare const densityFunctionMaxValue: (densityValue: DensityFunction) =&gt; number;</code> | <code>export declare const densityFunctionMaxValue: (densityValue: DensityFunction) =&gt; DensityFunctionResult&lt;DensityBound&gt;;</code> |
| `densityFunctionMinValue` | <code>export declare const densityFunctionMinValue: (densityValue: DensityFunction) =&gt; number;</code> | <code>export declare const densityFunctionMinValue: (densityValue: DensityFunction) =&gt; DensityFunctionResult&lt;DensityBound&gt;;</code> |
| `DensityFunctionNode` | <code>export type DensityFunctionNode = Readonly&lt;{ readonly compute: (context: DensityFunctionContext) =&gt; number; readonly fillArray: (array: number[] &#124; Float64Array, contextProvider: DensityFunctionArrayContextProvider) =&gt; void; readonly mapAll: (visitor: DensityFunctionVisitor) =&gt; DensityFunctionNode; readonly minValue: () =&gt; number; readonly maxValue: () =&gt; number; readonly abs: () =&gt; DensityFunctionNode; readonly clamp: (min: number, max: number) =&gt; DensityFunctionNode; readonly cube: () =&gt; DensityFunctionNode; readonly halfNegative: () =&gt; DensityFunctionNode; readonly invert: () =&gt; DensityFunctionNode; readonly quarterNegative: () =&gt; DensityFunctionNode; readonly square: () =&gt; DensityFunctionNode; readonly squeeze: () =&gt; DensityFunctionNode; }&gt;;</code> | <code>export type DensityFunctionNode = Readonly&lt;{ readonly compute: (context: DensityFunctionContext) =&gt; DensityFunctionResult&lt;DensityValue&gt;; readonly fillArray: (array: number[] &#124; Float64Array, contextProvider: DensityFunctionArrayContextProvider) =&gt; DensityFunctionResult&lt;void&gt;; readonly mapAll: (visitor: DensityFunctionVisitor) =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;; readonly minValue: () =&gt; DensityBound; readonly maxValue: () =&gt; DensityBound; readonly abs: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;; readonly clamp: (min: DensityValue, max: DensityValue) =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;; readonly cube: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;; readonly halfNegative: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;; readonly invert: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;; readonly quarterNegative: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;; readonly square: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;; readonly squeeze: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;; }&gt;;</code> |
| `DensityFunctionRuntime` | <code>export type DensityFunctionRuntime = Readonly&lt;{ readonly compute: (context: DensityFunctionContext) =&gt; number; readonly fillArray: (array: number[] &#124; Float64Array, contextProvider: DensityFunctionArrayContextProvider) =&gt; void; readonly mapAll: (visitor: DensityFunctionVisitor) =&gt; DensityFunction; readonly minValue: number; readonly maxValue: number; }&gt;;</code> | <code>export type DensityFunctionRuntime = Readonly&lt;{ readonly compute: (context: DensityFunctionContext) =&gt; DensityFunctionResult&lt;DensityValueType&gt;; readonly fillArray: (array: number[] &#124; Float64Array, contextProvider: DensityFunctionArrayContextProvider) =&gt; DensityFunctionResult&lt;void&gt;; readonly mapAll: (visitor: DensityFunctionVisitor) =&gt; DensityFunctionResult&lt;DensityFunction&gt;; readonly minValue: DensityBound; readonly maxValue: DensityBound; }&gt;;</code> |
| `DensityFunctionValue` | <code>export type DensityFunctionValue = DensityFunction &#124; number;</code> | <code>export type DensityFunctionValue = DensityFunction &#124; DensityValue;</code> |
| `densityHalfNegative` | <code>export declare const densityHalfNegative: (input: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityHalfNegative: (input: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityInvert` | <code>export declare const densityInvert: (input: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityInvert: (input: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityLerp` | <code>export declare const densityLerp: (delta: DensityFunction, min: DensityFunctionValue, max: DensityFunctionValue) =&gt; DensityFunction;</code> | <code>export declare const densityLerp: (delta: DensityFunction, min: DensityFunctionValue, max: DensityFunctionValue) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityLinearOperation` | <code>export declare const densityLinearOperation: (operation: DensityLinearOperationType, input: DensityFunction, argument: number) =&gt; DensityFunction;</code> | <code>export declare const densityLinearOperation: (operation: DensityLinearOperationType, input: DensityFunction, argument: DensityValueType) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityLinearOperation` | <code>export type DensityLinearOperation = DensityBounds &amp; Readonly&lt;{ readonly kind: 'linear-operation'; readonly operation: DensityLinearOperationType; readonly input: DensityFunction; readonly argument: number; }&gt;;</code> | <code>export type DensityLinearOperation = DensityBounds &amp; Readonly&lt;{ readonly kind: 'linear-operation'; readonly operation: DensityLinearOperationType; readonly input: DensityFunction; readonly argument: DensityValue; }&gt;;</code> |
| `densityMap` | <code>export declare const densityMap: (input: DensityFunction, operation: DensityMappedOperation) =&gt; DensityFunction;</code> | <code>export declare const densityMap: (input: DensityFunction, operation: DensityMappedOperation) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityMappedNoise` | <code>export declare const densityMappedNoise: (source: DensityNoiseSource, ...parameters: DensityMappedNoiseArguments) =&gt; DensityFunction;</code> | <code>export declare const densityMappedNoise: (source: DensityNoiseSource, ...parameters: DensityMappedNoiseArguments) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityMapRange` | <code>export declare const densityMapRange: (input: DensityFunction, min: number, max: number) =&gt; DensityFunction;</code> | <code>export declare const densityMapRange: (input: DensityFunction, min: DensityValueType, max: DensityValueType) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityMax` | <code>export declare const densityMax: (left: DensityFunction, right: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityMax: (left: DensityFunction, right: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityMin` | <code>export declare const densityMin: (left: DensityFunction, right: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityMin: (left: DensityFunction, right: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityMul` | <code>export declare const densityMul: (left: DensityFunction, right: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityMul: (left: DensityFunction, right: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityNoise` | <code>export declare const densityNoise: (source: DensityNoiseSource, options?: DensityNoiseOptions) =&gt; DensityFunction;</code> | <code>export declare const densityNoise: (source: DensityNoiseSource, options?: DensityNoiseOptions) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityNoise` | <code>export type DensityNoise = DensityBounds &amp; Readonly&lt;{ readonly kind: 'noise'; readonly source: DensityNoiseSource; readonly xzScale: number; readonly yScale: number; }&gt;;</code> | <code>export type DensityNoise = DensityBounds &amp; Readonly&lt;{ readonly kind: 'noise'; readonly source: DensityNoiseSource; readonly xzScale: DensityScale; readonly yScale: DensityScale; }&gt;;</code> |
| `densityNoiseInRange` | <code>export declare const densityNoiseInRange: (source: DensityNoiseSource, options: DensityNoiseInRangeOptions) =&gt; DensityFunction;</code> | <code>export declare const densityNoiseInRange: (source: DensityNoiseSource, options: DensityNoiseInRangeOptions) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityNoiseInRangeOptions` | <code>export type DensityNoiseInRangeOptions = DensityNoiseOptions &amp; Readonly&lt;{ readonly min: number; readonly max: number; }&gt;;</code> | <code>export type DensityNoiseInRangeOptions = DensityNoiseOptions &amp; Readonly&lt;{ readonly min: DensityValue; readonly max: DensityValue; }&gt;;</code> |
| `DensityNoiseOptions` | <code>export type DensityNoiseOptions = Readonly&lt;{ readonly xzScale?: number; readonly yScale?: number; }&gt;;</code> | <code>export type DensityNoiseOptions = Readonly&lt;{ readonly xzScale?: DensityScale; readonly yScale?: DensityScale; }&gt;;</code> |
| `densityOldBlendedNoise` | <code>export declare const densityOldBlendedNoise: (source: DensityOldBlendedNoiseSource, options: DensityOldBlendedNoiseOptions) =&gt; DensityFunction;</code> | <code>export declare const densityOldBlendedNoise: (source: DensityOldBlendedNoiseSource, options: DensityOldBlendedNoiseOptions) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityOldBlendedNoise` | <code>export type DensityOldBlendedNoise = DensityBounds &amp; Readonly&lt;{ readonly kind: 'old-blended-noise'; readonly source: DensityOldBlendedNoiseSource; readonly xzScale: number; readonly yScale: number; readonly xzFactor: number; readonly yFactor: number; readonly smearScaleMultiplier: number; }&gt;;</code> | <code>export type DensityOldBlendedNoise = DensityBounds &amp; Readonly&lt;{ readonly kind: 'old-blended-noise'; readonly source: DensityOldBlendedNoiseSource; readonly xzScale: DensityScale; readonly yScale: DensityScale; readonly xzFactor: DensityScale; readonly yFactor: DensityScale; readonly smearScaleMultiplier: DensityScale; }&gt;;</code> |
| `DensityOldBlendedNoiseOctave` | <code>export type DensityOldBlendedNoiseOctave = Readonly&lt;{ readonly sample: (...coordinates: DensityOldBlendedNoiseSample) =&gt; number; }&gt;;</code> | <code>export type DensityOldBlendedNoiseOctave = Readonly&lt;{ readonly sample: (...coordinates: DensityOldBlendedNoiseSample) =&gt; DensityValue; }&gt;;</code> |
| `DensityOldBlendedNoiseOctaveSource` | <code>export type DensityOldBlendedNoiseOctaveSource = (octave: number) =&gt; DensityOldBlendedNoiseOctave &#124; undefined;</code> | <code>export type DensityOldBlendedNoiseOctaveSource = (octave: DensityOctaveIndex) =&gt; DensityOldBlendedNoiseOctave &#124; undefined;</code> |
| `DensityOldBlendedNoiseOptions` | <code>export type DensityOldBlendedNoiseOptions = Readonly&lt;{ readonly xzScale: number; readonly yScale: number; readonly xzFactor: number; readonly yFactor: number; readonly smearScaleMultiplier: number; }&gt;;</code> | <code>export type DensityOldBlendedNoiseOptions = Readonly&lt;{ readonly xzScale: DensityScale; readonly yScale: DensityScale; readonly xzFactor: DensityScale; readonly yFactor: DensityScale; readonly smearScaleMultiplier: DensityScale; }&gt;;</code> |
| `densityQuarterNegative` | <code>export declare const densityQuarterNegative: (input: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityQuarterNegative: (input: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityRangeChoice` | <code>export declare const densityRangeChoice: (input: DensityFunction, options: DensityRangeChoiceOptions, inRange: DensityFunction, outOfRange: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityRangeChoice: (input: DensityFunction, options: DensityRangeChoiceOptions, inRange: DensityFunction, outOfRange: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityRangeChoice` | <code>export type DensityRangeChoice = DensityBounds &amp; Readonly&lt;{ readonly kind: 'range-choice'; readonly input: DensityFunction; readonly minInclusive: number; readonly maxExclusive: number; readonly inRange: DensityFunction; readonly outOfRange: DensityFunction; }&gt;;</code> | <code>export type DensityRangeChoice = DensityBounds &amp; Readonly&lt;{ readonly kind: 'range-choice'; readonly input: DensityFunction; readonly minInclusive: DensityValue; readonly maxExclusive: DensityValue; readonly inRange: DensityFunction; readonly outOfRange: DensityFunction; }&gt;;</code> |
| `DensityRangeChoiceOptions` | <code>export type DensityRangeChoiceOptions = Readonly&lt;{ readonly minInclusive: number; readonly maxExclusive: number; }&gt;;</code> | <code>export type DensityRangeChoiceOptions = Readonly&lt;{ readonly minInclusive: DensityValue; readonly maxExclusive: DensityValue; }&gt;;</code> |
| `densityShift` | <code>export declare const densityShift: (source: DensityNoiseSource) =&gt; DensityFunction;</code> | <code>export declare const densityShift: (source: DensityNoiseSource) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityShiftA` | <code>export declare const densityShiftA: (source: DensityNoiseSource) =&gt; DensityFunction;</code> | <code>export declare const densityShiftA: (source: DensityNoiseSource) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityShiftB` | <code>export declare const densityShiftB: (source: DensityNoiseSource) =&gt; DensityFunction;</code> | <code>export declare const densityShiftB: (source: DensityNoiseSource) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityShiftedNoise` | <code>export declare const densityShiftedNoise: (source: DensityNoiseSource, shifts: DensityShiftedNoiseShifts, options?: DensityNoiseOptions) =&gt; DensityFunction;</code> | <code>export declare const densityShiftedNoise: (source: DensityNoiseSource, shifts: DensityShiftedNoiseShifts, options?: DensityNoiseOptions) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityShiftedNoise` | <code>export type DensityShiftedNoise = DensityBounds &amp; Readonly&lt;{ readonly kind: 'shifted-noise'; readonly source: DensityNoiseSource; readonly shiftX: DensityFunction; readonly shiftY: DensityFunction; readonly shiftZ: DensityFunction; readonly xzScale: number; readonly yScale: number; }&gt;;</code> | <code>export type DensityShiftedNoise = DensityBounds &amp; Readonly&lt;{ readonly kind: 'shifted-noise'; readonly source: DensityNoiseSource; readonly shiftX: DensityFunction; readonly shiftY: DensityFunction; readonly shiftZ: DensityFunction; readonly xzScale: DensityScale; readonly yScale: DensityScale; }&gt;;</code> |
| `densityShiftedNoise2D` | <code>export declare const densityShiftedNoise2D: (source: DensityNoiseSource, shifts: DensityShiftedNoise2DShifts, options?: DensityShiftedNoise2DOptions) =&gt; DensityFunction;</code> | <code>export declare const densityShiftedNoise2D: (source: DensityNoiseSource, shifts: DensityShiftedNoise2DShifts, options?: DensityShiftedNoise2DOptions) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `DensityShiftedNoise2DOptions` | <code>export type DensityShiftedNoise2DOptions = Readonly&lt;{ readonly xzScale?: number; }&gt;;</code> | <code>export type DensityShiftedNoise2DOptions = Readonly&lt;{ readonly xzScale?: DensityScale; }&gt;;</code> |
| `densitySpline` | <code>export declare const densitySpline: (input: DensityFunction, spline: Spline) =&gt; DensityFunction;</code> | <code>export declare const densitySpline: (input: DensityFunction, spline: Spline) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densitySquare` | <code>export declare const densitySquare: (input: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densitySquare: (input: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densitySqueeze` | <code>export declare const densitySqueeze: (input: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densitySqueeze: (input: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityUnary` | <code>export declare const densityUnary: (operation: DensityUnaryOperation, input: DensityFunction) =&gt; DensityFunction;</code> | <code>export declare const densityUnary: (operation: DensityUnaryOperation, input: DensityFunction) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `densityWeirdScaledSampler` | <code>export declare const densityWeirdScaledSampler: (input: DensityFunction, source: DensityNoiseSource, rarityValueMapper: DensityRarityValueMapper) =&gt; DensityFunction;</code> | <code>export declare const densityWeirdScaledSampler: (input: DensityFunction, source: DensityNoiseSource, rarityValueMapper: DensityRarityValueMapper) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `encodeDensityFunction` | <code>export declare const encodeDensityFunction: (density: DensityFunction, options?: DensityFunctionCodecOptions) =&gt; DensityFunctionEncoded;</code> | <code>export declare const encodeDensityFunction: (density: DensityFunction, options?: DensityFunctionCodecOptions) =&gt; DensityFunctionCodecResult&lt;DensityFunctionEncoded&gt;;</code> |
| `evaluateDensityFunction` | <code>export declare const evaluateDensityFunction: (density: DensityFunction, position: DensityPosition, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; number;</code> | <code>export declare const evaluateDensityFunction: (density: DensityFunction, position: DensityPosition, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; DensityFunctionResult&lt;DensityValueType&gt;;</code> |
| `evaluateNoiseRouter` | <code>export declare const evaluateNoiseRouter: (router: NoiseRouter, position: DensityPosition, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; NoiseRouterValues;</code> | <code>export declare const evaluateNoiseRouter: (router: NoiseRouter, position: DensityPosition, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; DensityFunctionResult&lt;NoiseRouterValues&gt;;</code> |
| `fillDensityFunctionArray` | <code>export declare const fillDensityFunctionArray: (densityValue: DensityFunction, array: number[] &#124; Float64Array, contextProvider: DensityFunctionArrayContextProvider, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; void;</code> | <code>export declare const fillDensityFunctionArray: (densityValue: DensityFunction, array: number[] &#124; Float64Array, contextProvider: DensityFunctionArrayContextProvider, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; DensityFunctionResult&lt;void&gt;;</code> |
| `map` | <code>export declare const map: (input: DensityFunction, operation: DensityMappedType) =&gt; DensityFunction;</code> | <code>export declare const map: (input: DensityFunction, operation: DensityMappedType) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `mapDensityFunction` | <code>export declare const mapDensityFunction: (densityValue: DensityFunction, visitor: DensityFunctionVisitor) =&gt; DensityFunction;</code> | <code>export declare const mapDensityFunction: (densityValue: DensityFunction, visitor: DensityFunctionVisitor) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `mapNoiseRouter` | <code>export declare const mapNoiseRouter: (router: NoiseRouter, visitor: NoiseRouterVisitor) =&gt; NoiseRouter;</code> | <code>export declare const mapNoiseRouter: (router: NoiseRouter, visitor: NoiseRouterVisitor) =&gt; DensityFunctionResult&lt;NoiseRouter&gt;;</code> |
| `MINECRAFT_BLOCK` | <code>export declare const MINECRAFT_BLOCK: Readonly&lt;Record&lt;'AIR' &#124; 'BEDROCK' &#124; 'DEEPSLATE' &#124; 'DIRT' &#124; 'GRASS' &#124; 'GRAVEL' &#124; 'ICE' &#124; 'LAVA' &#124; 'LEAVES' &#124; 'LOG' &#124; 'OBSIDIAN' &#124; 'SAND' &#124; 'SNOW' &#124; 'STONE' &#124; 'WATER', BlockId&gt;&gt;;</code> | <code>export declare const MINECRAFT_BLOCK: Readonly&lt;Record&lt;'AIR' &#124; 'BEDROCK' &#124; 'DEEPSLATE' &#124; 'DIRT' &#124; 'GRASS' &#124; 'GRAVEL' &#124; 'ICE' &#124; 'LAVA' &#124; 'LEAVES' &#124; 'LOG' &#124; 'OBSIDIAN' &#124; 'SAND' &#124; 'SNOW' &#124; 'STONE' &#124; 'WATER', Option.Option&lt;BlockId&gt;&gt;&gt;;</code> |
| `MinecraftBiomeSurface` | <code>export type MinecraftBiomeSurface = Readonly&lt;{ top: BlockId; filler: BlockId; underwaterTop: BlockId; }&gt;;</code> | <code>export type MinecraftBiomeSurface = Readonly&lt;{ top: Option.Option&lt;BlockId&gt;; filler: Option.Option&lt;BlockId&gt;; underwaterTop: Option.Option&lt;BlockId&gt;; }&gt;;</code> |
| `MinecraftClimateSample` | <code>export type MinecraftClimateSample = Readonly&lt;{ temperature: number; humidity: number; continentalness: number; erosion: number; pv: number; riverNoise: number; }&gt;;</code> | <code>export type MinecraftClimateSample = Readonly&lt;{ temperature: MinecraftClimateValue; humidity: MinecraftClimateValue; continentalness: BoundedNoise; erosion: BoundedNoise; pv: BoundedNoise; riverNoise: MinecraftClimateValue; }&gt;;</code> |
| `minecraftPeaksAndValleysFromWeirdness` | <code>export declare const minecraftPeaksAndValleysFromWeirdness: (weirdness: number) =&gt; number;</code> | <code>export declare const minecraftPeaksAndValleysFromWeirdness: (weirdness: BoundedNoise) =&gt; BoundedNoise;</code> |
| `MinecraftResolvedSurfaceMaterial` | <code>export type MinecraftResolvedSurfaceMaterial = Readonly&lt;{ filler: BlockId; fillerDepth: number; submerged: boolean; top: BlockId; }&gt;;</code> | <code>export type MinecraftResolvedSurfaceMaterial = Readonly&lt;{ filler: Option.Option&lt;BlockId&gt;; fillerDepth: MinecraftSurfaceFillerDepth; submerged: boolean; top: Option.Option&lt;BlockId&gt;; }&gt;;</code> |
| `minecraftShouldFreezeWaterSurface` | <code>export declare const minecraftShouldFreezeWaterSurface: (biome: MinecraftBiome, temperature: number) =&gt; boolean;</code> | <code>export declare const minecraftShouldFreezeWaterSurface: (biome: MinecraftBiome, temperature: MinecraftClimateValue) =&gt; boolean;</code> |
| `noise` | <code>export declare function noise(source: DensityNoiseSource): DensityFunction;</code><br><code>export declare function noise(source: DensityNoiseSource, xzScale: number, yScale: number): DensityFunction;</code><br><code>export declare function noise(source: DensityNoiseSource, yScale: number): DensityFunction;</code> | <code>export declare function noise(source: DensityNoiseSource): DensityFunctionResult&lt;DensityFunction&gt;;</code><br><code>export declare function noise(source: DensityNoiseSource, xzScale: DensityScaleValue, yScale: DensityScaleValue): DensityFunctionResult&lt;DensityFunction&gt;;</code><br><code>export declare function noise(source: DensityNoiseSource, yScale: DensityScaleValue): DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `NoiseRouterRuntime` | <code>export type NoiseRouterRuntime = NoiseRouter &amp; Readonly&lt;{ readonly mapAll: (visitor: NoiseRouterVisitor) =&gt; NoiseRouter; }&gt;;</code> | <code>export type NoiseRouterRuntime = NoiseRouter &amp; Readonly&lt;{ readonly mapAll: (visitor: NoiseRouterVisitor) =&gt; DensityFunctionResult&lt;NoiseRouter&gt;; }&gt;;</code> |
| `NoiseRouterValues` | <code>export type NoiseRouterValues = Readonly&lt;{ readonly [channel in NoiseRouterChannel]: number; }&gt;;</code> | <code>export type NoiseRouterValues = Readonly&lt;{ readonly [channel in NoiseRouterChannel]: DensityValue; }&gt;;</code> |
| `normalizeNoise` | <code>export declare const normalizeNoise: (value: number) =&gt; number;</code> | <code>export declare const normalizeNoise: (value: BoundedNoise) =&gt; NormalizedNoise;</code> |
| `OctaveParameters` | <code>export type OctaveParameters = readonly [ octaves: number, persistence: number, lacunarity: number ];</code> | <code>export type OctaveParameters = readonly [ octaves: OctaveCount, persistence: OctaveAmplitude, lacunarity: OctaveFrequency ];</code> |
| `OctaveParams` | <code>export type OctaveParams = { readonly octaves: number; readonly persistence: number; readonly lacunarity: number; };</code> | <code>export type OctaveParams = { readonly octaves: OctaveCount; readonly persistence: OctaveAmplitude; readonly lacunarity: OctaveFrequency; };</code> |
| `parseDensityFunction` | <code>export declare const parseDensityFunction: (serialized: string, options?: DensityFunctionCodecOptions) =&gt; DensityFunction;</code> | <code>export declare const parseDensityFunction: (serialized: string, options?: DensityFunctionCodecOptions) =&gt; DensityFunctionCodecResult&lt;DensityFunction&gt;;</code> |
| `peaksAndValleysFromWeirdness` | <code>export declare const peaksAndValleysFromWeirdness: (weirdness: number) =&gt; number;</code> | <code>export declare const peaksAndValleysFromWeirdness: (weirdness: BoundedNoise) =&gt; BoundedNoise;</code> |
| `rangeChoice` | <code>export declare const rangeChoice: (input: DensityFunction, minInclusive: number, maxExclusive: number, ...[inRange, outOfRange]: [ DensityFunction, DensityFunction ]) =&gt; DensityFunction;</code> | <code>export declare const rangeChoice: (input: DensityFunction, minInclusive: DensityValueType, maxExclusive: DensityValueType, ...[inRange, outOfRange]: [ DensityFunction, DensityFunction ]) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `refineMinecraftBeachBiome` | <code>export declare const refineMinecraftBeachBiome: (biome: MinecraftBiome, neighboringBiomes: ReadonlyArray&lt;MinecraftBiome&gt;, continentalness: number) =&gt; MinecraftBiome;</code> | <code>export declare const refineMinecraftBeachBiome: (biome: MinecraftBiome, neighboringBiomes: ReadonlyArray&lt;MinecraftBiome&gt;, continentalness: MinecraftClimateValue) =&gt; MinecraftBiome;</code> |
| `requireBlender` | <code>export declare const requireBlender: (value: unknown) =&gt; Blender;</code> | <code>export declare const requireBlender: (value: unknown) =&gt; DensityFunctionResult&lt;Blender&gt;;</code> |
| `requireDensityFunction` | <code>export declare const requireDensityFunction: (name: string, value: unknown) =&gt; DensityFunction;</code> | <code>export declare const requireDensityFunction: (name: DensityFunctionFieldNameValue, value: unknown) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `requireNoiseRouter` | <code>export declare const requireNoiseRouter: (router: unknown) =&gt; NoiseRouter;</code> | <code>export declare const requireNoiseRouter: (router: unknown) =&gt; DensityFunctionResult&lt;NoiseRouter&gt;;</code> |
| `shiftedNoise2d` | <code>export declare const shiftedNoise2d: (shiftX: DensityFunction, shiftZ: DensityFunction, xzScale: number, noiseData: DensityNoiseSource) =&gt; DensityFunction;</code> | <code>export declare const shiftedNoise2d: (shiftX: DensityFunction, shiftZ: DensityFunction, xzScale: DensityScaleValue, noiseData: DensityNoiseSource) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `signedFbm2D` | <code>export declare const signedFbm2D: (noiseFn: NoiseFn2D, params: OctaveParams, boost?: number) =&gt; NoiseFn2D;</code> | <code>export declare const signedFbm2D: (noiseFn: NoiseFn2D, params: OctaveParams, boost?: OctaveAmplitude) =&gt; NoiseFn2D;</code> |
| `spline` | <code>export declare const spline: (definition: DensitySplineInput) =&gt; DensityFunction;</code> | <code>export declare const spline: (definition: DensitySplineInput) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> |
| `stringifyDensityFunction` | <code>export declare const stringifyDensityFunction: (density: DensityFunction, options?: DensityFunctionCodecOptions) =&gt; string;</code> | <code>export declare const stringifyDensityFunction: (density: DensityFunction, options?: DensityFunctionCodecOptions) =&gt; DensityFunctionCodecResult&lt;string&gt;;</code> |
| `ValueNoiseFbmOptions` | <code>export type ValueNoiseFbmOptions = Readonly&lt;{ octaves: number; frequency: number; persistence: number; }&gt;;</code> | <code>export type ValueNoiseFbmOptions = Readonly&lt;{ octaves: OctaveCountValue; frequency: NoiseFrequency; persistence: OctaveAmplitudeValue; }&gt;;</code> |

</details>
<details>
<summary>Added exports (37)</summary>

| Export | Before | After |
| --- | --- | --- |
| `BoundedNoise` | Not exported | <code>export declare const BoundedNoise: Brand.Constructor&lt;BoundedNoise&gt;;</code><br><code>export type BoundedNoise = number &amp; Brand.Brand&lt;'BoundedNoise'&gt;;</code> |
| `ClimateDistance` | Not exported | <code>export declare const ClimateDistance: Brand.Constructor&lt;ClimateDistance&gt;;</code><br><code>export type ClimateDistance = number &amp; Brand.Brand&lt;'ClimateDistance'&gt;;</code> |
| `ClimateFieldName` | Not exported | <code>export declare const ClimateFieldName: Brand.Constructor&lt;ClimateFieldName&gt;;</code><br><code>export type ClimateFieldName = string &amp; Brand.Brand&lt;'ClimateFieldName'&gt;;</code> |
| `ClimateFitness` | Not exported | <code>export declare const ClimateFitness: Brand.Constructor&lt;ClimateFitness&gt;;</code><br><code>export type ClimateFitness = number &amp; Brand.Brand&lt;'ClimateFitness'&gt;;</code> |
| `ClimateListIndex` | Not exported | <code>export declare const ClimateListIndex: Brand.Constructor&lt;ClimateListIndex&gt;;</code><br><code>export type ClimateListIndex = number &amp; Brand.Brand&lt;'ClimateListIndex'&gt;;</code> |
| `ClimateSearchRadius` | Not exported | <code>export declare const ClimateSearchRadius: Brand.Constructor&lt;ClimateSearchRadius&gt;;</code><br><code>export type ClimateSearchRadius = number &amp; Brand.Brand&lt;'ClimateSearchRadius'&gt;;</code> |
| `ClimateSearchStep` | Not exported | <code>export declare const ClimateSearchStep: Brand.Constructor&lt;ClimateSearchStep&gt;;</code><br><code>export type ClimateSearchStep = number &amp; Brand.Brand&lt;'ClimateSearchStep'&gt;;</code> |
| `ClimateSpawnCandidate` | Not exported | <code>export type ClimateSpawnCandidate = Readonly&lt;{ readonly position: BlockPosition; readonly fitness: ClimateFitness; }&gt;;</code> |
| `ClimateValue` | Not exported | <code>export declare const ClimateValue: Brand.Constructor&lt;ClimateValue&gt;;</code><br><code>export type ClimateValue = number &amp; Brand.Brand&lt;'ClimateValue'&gt;;</code> |
| `DensityArrayIndex` | Not exported | <code>export declare const DensityArrayIndex: Brand.Constructor&lt;DensityArrayIndex&gt;;</code><br><code>export type DensityArrayIndex = number &amp; Brand.Brand&lt;'DensityArrayIndex'&gt;;</code> |
| `DensityBound` | Not exported | <code>export declare const DensityBound: Brand.Constructor&lt;DensityBound&gt;;</code><br><code>export type DensityBound = number &amp; Brand.Brand&lt;'DensityBound'&gt;;</code> |
| `DensityCellSize` | Not exported | <code>export declare const DensityCellSize: Brand.Constructor&lt;DensityCellSize&gt;;</code><br><code>export type DensityCellSize = number &amp; Brand.Brand&lt;'DensityCellSize'&gt;;</code> |
| `DensityFunctionCodecError` | Not exported | <code>export type DensityFunctionCodecError = SchemaError &#124; TypeError &#124; RangeError;</code> |
| `DensityFunctionCodecResult` | Not exported | <code>export type DensityFunctionCodecResult&lt;Value&gt; = Result.Result&lt;Value, DensityFunctionCodecError&gt;;</code> |
| `DensityFunctionError` | Not exported | <code>export type DensityFunctionError = TypeError &#124; RangeError;</code> |
| `DensityFunctionFieldName` | Not exported | <code>export declare const DensityFunctionFieldName: Brand.Constructor&lt;DensityFunctionFieldName&gt;;</code><br><code>export type DensityFunctionFieldName = string &amp; Brand.Brand&lt;'DensityFunctionFieldName'&gt;;</code> |
| `DensityFunctionResult` | Not exported | <code>export type DensityFunctionResult&lt;Value&gt; = Result.Result&lt;Value, DensityFunctionError&gt;;</code> |
| `DensityOctaveIndex` | Not exported | <code>export declare const DensityOctaveIndex: Brand.Constructor&lt;DensityOctaveIndex&gt;;</code><br><code>export type DensityOctaveIndex = number &amp; Brand.Brand&lt;'DensityOctaveIndex'&gt;;</code> |
| `DensityScale` | Not exported | <code>export declare const DensityScale: Brand.Constructor&lt;DensityScale&gt;;</code><br><code>export type DensityScale = number &amp; Brand.Brand&lt;'DensityScale'&gt;;</code> |
| `DensityValue` | Not exported | <code>export declare const DensityValue: Brand.Constructor&lt;DensityValue&gt;;</code><br><code>export type DensityValue = number &amp; Brand.Brand&lt;'DensityValue'&gt;;</code> |
| `GridDimension` | Not exported | <code>export declare const GridDimension: Brand.Constructor&lt;GridDimension&gt;;</code><br><code>export type GridDimension = number &amp; Brand.Brand&lt;'GridDimension'&gt;;</code> |
| `GridStep` | Not exported | <code>export declare const GridStep: Brand.Constructor&lt;GridStep&gt;;</code><br><code>export type GridStep = number &amp; Brand.Brand&lt;'GridStep'&gt;;</code> |
| `LatticeCoordinate` | Not exported | <code>export declare const LatticeCoordinate: Brand.Constructor&lt;LatticeCoordinate&gt;;</code><br><code>export type LatticeCoordinate = number &amp; Brand.Brand&lt;'LatticeCoordinate'&gt;;</code> |
| `MinecraftClimateValue` | Not exported | <code>export declare const MinecraftClimateValue: Brand.Constructor&lt;MinecraftClimateValue&gt;;</code><br><code>export type MinecraftClimateValue = number &amp; Brand.Brand&lt;'MinecraftClimateValue'&gt;;</code> |
| `MinecraftSurfaceFillerDepth` | Not exported | <code>export declare const MinecraftSurfaceFillerDepth: Brand.Constructor&lt;MinecraftSurfaceFillerDepth&gt;;</code><br><code>export type MinecraftSurfaceFillerDepth = number &amp; Brand.Brand&lt;'MinecraftSurfaceFillerDepth'&gt;;</code> |
| `NoiseAccumulator` | Not exported | <code>export declare const NoiseAccumulator: Brand.Constructor&lt;NoiseAccumulator&gt;;</code><br><code>export type NoiseAccumulator = number &amp; Brand.Brand&lt;'NoiseAccumulator'&gt;;</code> |
| `NoiseChannelLabel` | Not exported | <code>export declare const NoiseChannelLabel: Brand.Constructor&lt;NoiseChannelLabel&gt;;</code><br><code>export type NoiseChannelLabel = string &amp; Brand.Brand&lt;'NoiseChannelLabel'&gt;;</code> |
| `NoiseFrequency` | Not exported | <code>export declare const NoiseFrequency: Brand.Constructor&lt;NoiseFrequency&gt;;</code><br><code>export type NoiseFrequency = number &amp; Brand.Brand&lt;'NoiseFrequency'&gt;;</code> |
| `NormalizedNoise` | Not exported | <code>export declare const NormalizedNoise: Brand.Constructor&lt;NormalizedNoise&gt;;</code><br><code>export type NormalizedNoise = number &amp; Brand.Brand&lt;'NormalizedNoise'&gt;;</code> |
| `OctaveAmplitude` | Not exported | <code>export declare const OctaveAmplitude: Brand.Constructor&lt;OctaveAmplitude&gt;;</code><br><code>export type OctaveAmplitude = number &amp; Brand.Brand&lt;'OctaveAmplitude'&gt;;</code> |
| `OctaveCount` | Not exported | <code>export declare const OctaveCount: Brand.Constructor&lt;OctaveCount&gt;;</code><br><code>export type OctaveCount = number &amp; Brand.Brand&lt;'OctaveCount'&gt;;</code> |
| `OctaveFrequency` | Not exported | <code>export declare const OctaveFrequency: Brand.Constructor&lt;OctaveFrequency&gt;;</code><br><code>export type OctaveFrequency = number &amp; Brand.Brand&lt;'OctaveFrequency'&gt;;</code> |
| `QuantizedClimateValue` | Not exported | <code>export declare const QuantizedClimateValue: Brand.Constructor&lt;QuantizedClimateValue&gt;;</code><br><code>export type QuantizedClimateValue = number &amp; Brand.Brand&lt;'QuantizedClimateValue'&gt;;</code> |
| `SampleStride` | Not exported | <code>export declare const SampleStride: Brand.Constructor&lt;SampleStride&gt;;</code><br><code>export type SampleStride = number &amp; Brand.Brand&lt;'SampleStride'&gt;;</code> |
| `SplineInput` | Not exported | <code>export declare const SplineInput: Brand.Constructor&lt;SplineInput&gt;;</code><br><code>export type SplineInput = number &amp; Brand.Brand&lt;'SplineInput'&gt;;</code> |
| `SplineValue` | Not exported | <code>export declare const SplineValue: Brand.Constructor&lt;SplineValue&gt;;</code><br><code>export type SplineValue = number &amp; Brand.Brand&lt;'SplineValue'&gt;;</code> |
| `ValueNoiseFbmSample` | Not exported | <code>export declare const ValueNoiseFbmSample: Brand.Constructor&lt;ValueNoiseFbmSample&gt;;</code><br><code>export type ValueNoiseFbmSample = number &amp; Brand.Brand&lt;'ValueNoiseFbmSample'&gt;;</code> |

</details>
<details>
<summary>Removed exports</summary>

No removed exports.

</details>
<details>
<summary>Public type and interface field changes (439)</summary>

| Provider | Type | Variant | Field before | Field after |
| --- | --- | --- | --- | --- |
| `@nerima-games/mc-kernel` | `Position` | All variants | <code>readonly x: number;</code> (required) | <code>readonly x: PositionAxis;</code> (required) |
| `@nerima-games/mc-kernel` | `Position` | All variants | <code>readonly y: number;</code> (required) | <code>readonly y: PositionAxis;</code> (required) |
| `@nerima-games/mc-kernel` | `Position` | All variants | <code>readonly z: number;</code> (required) | <code>readonly z: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `BlendingOutput` | All variants | <code>readonly alpha: number;</code> (required) | <code>readonly alpha: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `BlendingOutput` | All variants | <code>readonly blendingOffset: number;</code> (required) | <code>readonly blendingOffset: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateParameter` | All variants | <code>readonly max: number;</code> (required) | <code>readonly max: QuantizedClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateParameter` | All variants | <code>readonly min: number;</code> (required) | <code>readonly min: QuantizedClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateParameterPoint` | All variants | <code>readonly offset: number;</code> (required) | <code>readonly offset: QuantizedClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateSamplerRuntime` | All variants | <code>readonly findSpawnPosition: (options?: ClimateSpawnSearchOptions) =&gt; BlockPosition &#124; undefined;</code> (required) | <code>readonly findSpawnPosition: (options?: ClimateSpawnSearchOptions) =&gt; Result.Result&lt;Option.Option&lt;BlockPosition&gt;, TypeError &#124; RangeError&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateSamplerRuntime` | All variants | <code>readonly sample: (x: number, y: number, z: number, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; ClimateTargetPoint;</code> (required) | <code>readonly sample: (position: Position, contextOrSession?: DensityEvaluationContext &#124; DensityEvaluationSession) =&gt; Result.Result&lt;ClimateTargetPoint, TypeError &#124; RangeError&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateSpawnCandidate` | All variants | Not present | <code>readonly fitness: ClimateFitness;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateSpawnCandidate` | All variants | Not present | <code>readonly position: BlockPosition;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateSpawnSearchOptions` | All variants | <code>readonly origin?: Position;</code> (optional) | <code>readonly origin?: BlockPosition;</code> (optional) |
| `@nerima-games/mc-noise` | `ClimateSpawnSearchOptions` | All variants | <code>readonly radius?: number;</code> (optional) | <code>readonly radius?: ClimateSearchRadius;</code> (optional) |
| `@nerima-games/mc-noise` | `ClimateSpawnSearchOptions` | All variants | <code>readonly step?: number;</code> (optional) | <code>readonly step?: ClimateSearchStep;</code> (optional) |
| `@nerima-games/mc-noise` | `ClimateSpawnSearchOptions` | All variants | <code>readonly verticalRadius?: number;</code> (optional) | <code>readonly verticalRadius?: ClimateSearchRadius;</code> (optional) |
| `@nerima-games/mc-noise` | `ClimateTargetPoint` | All variants | <code>readonly continentalness: number;</code> (required) | <code>readonly continentalness: QuantizedClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateTargetPoint` | All variants | <code>readonly depth: number;</code> (required) | <code>readonly depth: QuantizedClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateTargetPoint` | All variants | <code>readonly erosion: number;</code> (required) | <code>readonly erosion: QuantizedClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateTargetPoint` | All variants | <code>readonly humidity: number;</code> (required) | <code>readonly humidity: QuantizedClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateTargetPoint` | All variants | <code>readonly temperature: number;</code> (required) | <code>readonly temperature: QuantizedClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `ClimateTargetPoint` | All variants | <code>readonly weirdness: number;</code> (required) | <code>readonly weirdness: QuantizedClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBeardifier` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBeardifier` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBinary` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBinary` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBlendAlpha` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBlendAlpha` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBlendDensity` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBlendDensity` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBlendOffset` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBlendOffset` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBounds` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityBounds` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCache2D` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCache2D` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCacheAllInCell` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCacheAllInCell` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCacheOnce` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCacheOnce` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityClamp` | All variants | <code>readonly max: number;</code> (required) | <code>readonly max: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityClamp` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityClamp` | All variants | <code>readonly min: number;</code> (required) | <code>readonly min: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityClamp` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityConstant` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityConstant` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityConstant` | All variants | <code>readonly value: number;</code> (required) | <code>readonly value: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCoordinate` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCoordinate` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCoordinate` | All variants | <code>readonly offset: number;</code> (required) | <code>readonly offset: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCoordinate` | All variants | <code>readonly scale: number;</code> (required) | <code>readonly scale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityCoordinateOptions` | All variants | <code>readonly offset?: number;</code> (optional) | <code>readonly offset?: PositionAxis;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityCoordinateOptions` | All variants | <code>readonly scale?: number;</code> (optional) | <code>readonly scale?: DensityScale;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEndIslands` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityEndIslands` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityEvaluationContext` | All variants | <code>readonly beardifier?: (position: DensityPosition) =&gt; number;</code> (optional) | <code>readonly beardifier?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEvaluationContext` | All variants | <code>readonly blendAlpha?: (position: DensityPosition) =&gt; number;</code> (optional) | <code>readonly blendAlpha?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEvaluationContext` | All variants | <code>readonly blendDensity?: (inputValue: number, position: DensityPosition) =&gt; number;</code> (optional) | <code>readonly blendDensity?: (inputValue: DensityValue, position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEvaluationContext` | All variants | <code>readonly blendOffset?: (position: DensityPosition) =&gt; number;</code> (optional) | <code>readonly blendOffset?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEvaluationContext` | All variants | <code>readonly cellHeight: number;</code> (required) | <code>readonly cellHeight: DensityCellSize;</code> (required) |
| `@nerima-games/mc-noise` | `DensityEvaluationContext` | All variants | <code>readonly cellWidth: number;</code> (required) | <code>readonly cellWidth: DensityCellSize;</code> (required) |
| `@nerima-games/mc-noise` | `DensityEvaluationContextOptions` | All variants | <code>readonly beardifier?: (position: DensityPosition) =&gt; number;</code> (optional) | <code>readonly beardifier?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEvaluationContextOptions` | All variants | <code>readonly blendAlpha?: (position: DensityPosition) =&gt; number;</code> (optional) | <code>readonly blendAlpha?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEvaluationContextOptions` | All variants | <code>readonly blendDensity?: (inputValue: number, position: DensityPosition) =&gt; number;</code> (optional) | <code>readonly blendDensity?: (inputValue: DensityValue, position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEvaluationContextOptions` | All variants | <code>readonly blendOffset?: (position: DensityPosition) =&gt; number;</code> (optional) | <code>readonly blendOffset?: (position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEvaluationContextOptions` | All variants | <code>readonly cellHeight?: number;</code> (optional) | <code>readonly cellHeight?: DensityCellSize;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEvaluationContextOptions` | All variants | <code>readonly cellWidth?: number;</code> (optional) | <code>readonly cellWidth?: DensityCellSize;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityEvaluationSession` | All variants | <code>readonly evaluate: (density: DensityFunction, position: DensityPosition) =&gt; number;</code> (required) | <code>readonly evaluate: (density: DensityFunction, position: DensityPosition) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFindTopSurface` | All variants | <code>readonly cellHeight: number;</code> (required) | <code>readonly cellHeight: DensityCellSize;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFindTopSurface` | All variants | <code>readonly lowerBound: number;</code> (required) | <code>readonly lowerBound: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFindTopSurface` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFindTopSurface` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFlatCache` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFlatCache` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="beardifier"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="beardifier"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="binary"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="binary"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="blend-alpha"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="blend-alpha"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="blend-density"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="blend-density"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="blend-offset"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="blend-offset"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="cache-2d"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="cache-2d"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="cache-all-in-cell"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="cache-all-in-cell"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="cache-once"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="cache-once"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="clamp"</code> | <code>readonly max: number;</code> (required) | <code>readonly max: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="clamp"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="clamp"</code> | <code>readonly min: number;</code> (required) | <code>readonly min: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="clamp"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="constant"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="constant"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="constant"</code> | <code>readonly value: number;</code> (required) | <code>readonly value: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="coordinate"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="coordinate"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="coordinate"</code> | <code>readonly offset: number;</code> (required) | <code>readonly offset: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="coordinate"</code> | <code>readonly scale: number;</code> (required) | <code>readonly scale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="end-islands"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="end-islands"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="find-top-surface"</code> | <code>readonly cellHeight: number;</code> (required) | <code>readonly cellHeight: DensityCellSize;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="find-top-surface"</code> | <code>readonly lowerBound: number;</code> (required) | <code>readonly lowerBound: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="find-top-surface"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="find-top-surface"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="flat-cache"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="flat-cache"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="interpolated"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="interpolated"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="linear-operation"</code> | <code>readonly argument: number;</code> (required) | <code>readonly argument: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="linear-operation"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="linear-operation"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="noise"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="noise"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="noise"</code> | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="noise"</code> | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="old-blended-noise"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="old-blended-noise"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="old-blended-noise"</code> | <code>readonly smearScaleMultiplier: number;</code> (required) | <code>readonly smearScaleMultiplier: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="old-blended-noise"</code> | <code>readonly xzFactor: number;</code> (required) | <code>readonly xzFactor: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="old-blended-noise"</code> | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="old-blended-noise"</code> | <code>readonly yFactor: number;</code> (required) | <code>readonly yFactor: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="old-blended-noise"</code> | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="range-choice"</code> | <code>readonly maxExclusive: number;</code> (required) | <code>readonly maxExclusive: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="range-choice"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="range-choice"</code> | <code>readonly minInclusive: number;</code> (required) | <code>readonly minInclusive: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="range-choice"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="shift-a"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="shift-a"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="shift-b"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="shift-b"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="shift"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="shift"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="shifted-noise"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="shifted-noise"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="shifted-noise"</code> | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="shifted-noise"</code> | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="spline"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="spline"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="unary"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="unary"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="weird-scaled-sampler"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="weird-scaled-sampler"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="y-clamped-gradient"</code> | <code>readonly fromValue: number;</code> (required) | <code>readonly fromValue: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="y-clamped-gradient"</code> | <code>readonly fromY: number;</code> (required) | <code>readonly fromY: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="y-clamped-gradient"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="y-clamped-gradient"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="y-clamped-gradient"</code> | <code>readonly toValue: number;</code> (required) | <code>readonly toValue: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunction` | <code>kind="y-clamped-gradient"</code> | <code>readonly toY: number;</code> (required) | <code>readonly toY: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionArrayContextProvider` | <code>variant 2</code> | <code>readonly fillAllDirectly: (array: number[] &#124; Float64Array, density: DensityFunction) =&gt; void;</code> (required) | <code>readonly fillAllDirectly: (array: number[] &#124; Float64Array, density: DensityFunction) =&gt; DensityFunctionResult&lt;void&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionArrayContextProvider` | <code>variant 2</code> | <code>readonly forIndex: (index: number) =&gt; DensityFunctionFunctionContext;</code> (required) | <code>readonly forIndex: (index: DensityArrayIndex) =&gt; DensityFunctionResult&lt;DensityFunctionFunctionContext&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecError` | <code>variant 2</code> | Not present | <code>readonly _tag: "SchemaError";</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecError` | <code>variant 2</code> | Not present | <code>readonly issue: SchemaIssue.Issue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecError` | <code>variant 2</code> | Not present | <code>get message(): string;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecError` | <code>variant 2</code> | Not present | <code>pipe&lt;A&gt;(this: A): A;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecError` | <code>variant 2</code> | Not present | <code>toJSON(): { _tag: "SchemaError"; message: string; };</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecError` | <code>variant 2</code> | Not present | <code>toString(): string;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 1</code> | Not present | <code>readonly _op: "Failure";</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 1</code> | Not present | <code>readonly _tag: "Failure";</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 1</code> | Not present | <code>readonly failure: E;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 1</code> | Not present | <code>pipe&lt;A&gt;(this: A): A;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 1</code> | Not present | <code>toJSON(): unknown;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 1</code> | Not present | <code>toString(): string;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 2</code> | Not present | <code>readonly _op: "Success";</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 2</code> | Not present | <code>readonly _tag: "Success";</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 2</code> | Not present | <code>pipe&lt;A&gt;(this: A): A;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 2</code> | Not present | <code>readonly success: A;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 2</code> | Not present | <code>toJSON(): unknown;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionCodecResult` | <code>variant 2</code> | Not present | <code>toString(): string;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionContext` | <code>variant 1</code> | <code>readonly x: number;</code> (required) | <code>readonly x: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionContext` | <code>variant 1</code> | <code>readonly y: number;</code> (required) | <code>readonly y: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionContext` | <code>variant 1</code> | <code>readonly z: number;</code> (required) | <code>readonly z: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionContext` | <code>variant 2</code> | <code>readonly blockX: () =&gt; number;</code> (required) | <code>readonly blockX: () =&gt; PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionContext` | <code>variant 2</code> | <code>readonly blockY: () =&gt; number;</code> (required) | <code>readonly blockY: () =&gt; PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionContext` | <code>variant 2</code> | <code>readonly blockZ: () =&gt; number;</code> (required) | <code>readonly blockZ: () =&gt; PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionContextProvider` | All variants | <code>readonly fillAllDirectly: (array: number[] &#124; Float64Array, density: DensityFunction) =&gt; void;</code> (required) | <code>readonly fillAllDirectly: (array: number[] &#124; Float64Array, density: DensityFunction) =&gt; DensityFunctionResult&lt;void&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionContextProvider` | All variants | <code>readonly forIndex: (index: number) =&gt; DensityFunctionFunctionContext;</code> (required) | <code>readonly forIndex: (index: DensityArrayIndex) =&gt; DensityFunctionResult&lt;DensityFunctionFunctionContext&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="clamp"</code> | <code>readonly max: number;</code> (required) | <code>readonly max: DensityValueType;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="clamp"</code> | <code>readonly min: number;</code> (required) | <code>readonly min: DensityValueType;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="constant"</code> | <code>readonly value: number;</code> (required) | <code>readonly value: DensityValueType;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="coordinate"</code> | <code>readonly offset: number;</code> (required) | <code>readonly offset: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="coordinate"</code> | <code>readonly scale: number;</code> (required) | <code>readonly scale: DensityScaleValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="find-top-surface"</code> | <code>readonly cellHeight: number;</code> (required) | <code>readonly cellHeight: DensityCellSizeValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="find-top-surface"</code> | <code>readonly lowerBound: number;</code> (required) | <code>readonly lowerBound: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="linear-operation"</code> | <code>readonly argument: number;</code> (required) | <code>readonly argument: DensityValueType;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="noise"</code> | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScaleValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="noise"</code> | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScaleValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="old-blended-noise"</code> | <code>readonly smearScaleMultiplier: number;</code> (required) | <code>readonly smearScaleMultiplier: DensityScaleValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="old-blended-noise"</code> | <code>readonly xzFactor: number;</code> (required) | <code>readonly xzFactor: DensityScaleValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="old-blended-noise"</code> | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScaleValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="old-blended-noise"</code> | <code>readonly yFactor: number;</code> (required) | <code>readonly yFactor: DensityScaleValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="old-blended-noise"</code> | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScaleValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="range-choice"</code> | <code>readonly maxExclusive: number;</code> (required) | <code>readonly maxExclusive: DensityValueType;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="range-choice"</code> | <code>readonly minInclusive: number;</code> (required) | <code>readonly minInclusive: DensityValueType;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="shifted-noise"</code> | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScaleValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="shifted-noise"</code> | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScaleValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="y-clamped-gradient"</code> | <code>readonly fromValue: number;</code> (required) | <code>readonly fromValue: DensityValueType;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="y-clamped-gradient"</code> | <code>readonly fromY: number;</code> (required) | <code>readonly fromY: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="y-clamped-gradient"</code> | <code>readonly toValue: number;</code> (required) | <code>readonly toValue: DensityValueType;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionEncoded` | <code>kind="y-clamped-gradient"</code> | <code>readonly toY: number;</code> (required) | <code>readonly toY: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionFunctionContext` | All variants | <code>readonly blockX: () =&gt; number;</code> (required) | <code>readonly blockX: () =&gt; PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionFunctionContext` | All variants | <code>readonly blockY: () =&gt; number;</code> (required) | <code>readonly blockY: () =&gt; PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionFunctionContext` | All variants | <code>readonly blockZ: () =&gt; number;</code> (required) | <code>readonly blockZ: () =&gt; PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly abs: () =&gt; DensityFunctionNode;</code> (required) | <code>readonly abs: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly clamp: (min: number, max: number) =&gt; DensityFunctionNode;</code> (required) | <code>readonly clamp: (min: DensityValue, max: DensityValue) =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly compute: (context: DensityFunctionContext) =&gt; number;</code> (required) | <code>readonly compute: (context: DensityFunctionContext) =&gt; DensityFunctionResult&lt;DensityValue&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly cube: () =&gt; DensityFunctionNode;</code> (required) | <code>readonly cube: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly fillArray: (array: number[] &#124; Float64Array, contextProvider: DensityFunctionArrayContextProvider) =&gt; void;</code> (required) | <code>readonly fillArray: (array: number[] &#124; Float64Array, contextProvider: DensityFunctionArrayContextProvider) =&gt; DensityFunctionResult&lt;void&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly halfNegative: () =&gt; DensityFunctionNode;</code> (required) | <code>readonly halfNegative: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly invert: () =&gt; DensityFunctionNode;</code> (required) | <code>readonly invert: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly mapAll: (visitor: DensityFunctionVisitor) =&gt; DensityFunctionNode;</code> (required) | <code>readonly mapAll: (visitor: DensityFunctionVisitor) =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly maxValue: () =&gt; number;</code> (required) | <code>readonly maxValue: () =&gt; DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly minValue: () =&gt; number;</code> (required) | <code>readonly minValue: () =&gt; DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly quarterNegative: () =&gt; DensityFunctionNode;</code> (required) | <code>readonly quarterNegative: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly square: () =&gt; DensityFunctionNode;</code> (required) | <code>readonly square: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionNode` | All variants | <code>readonly squeeze: () =&gt; DensityFunctionNode;</code> (required) | <code>readonly squeeze: () =&gt; DensityFunctionResult&lt;DensityFunctionNode&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 1</code> | Not present | <code>readonly _op: "Failure";</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 1</code> | Not present | <code>readonly _tag: "Failure";</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 1</code> | Not present | <code>readonly failure: E;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 1</code> | Not present | <code>pipe&lt;A&gt;(this: A): A;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 1</code> | Not present | <code>toJSON(): unknown;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 1</code> | Not present | <code>toString(): string;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 2</code> | Not present | <code>readonly _op: "Success";</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 2</code> | Not present | <code>readonly _tag: "Success";</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 2</code> | Not present | <code>pipe&lt;A&gt;(this: A): A;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 2</code> | Not present | <code>readonly success: A;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 2</code> | Not present | <code>toJSON(): unknown;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionResult` | <code>variant 2</code> | Not present | <code>toString(): string;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionRuntime` | All variants | <code>readonly compute: (context: DensityFunctionContext) =&gt; number;</code> (required) | <code>readonly compute: (context: DensityFunctionContext) =&gt; DensityFunctionResult&lt;DensityValueType&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionRuntime` | All variants | <code>readonly fillArray: (array: number[] &#124; Float64Array, contextProvider: DensityFunctionArrayContextProvider) =&gt; void;</code> (required) | <code>readonly fillArray: (array: number[] &#124; Float64Array, contextProvider: DensityFunctionArrayContextProvider) =&gt; DensityFunctionResult&lt;void&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionRuntime` | All variants | <code>readonly mapAll: (visitor: DensityFunctionVisitor) =&gt; DensityFunction;</code> (required) | <code>readonly mapAll: (visitor: DensityFunctionVisitor) =&gt; DensityFunctionResult&lt;DensityFunction&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionRuntime` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionRuntime` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="beardifier"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="beardifier"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="binary"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="binary"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="blend-alpha"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="blend-alpha"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="blend-density"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="blend-density"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="blend-offset"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="blend-offset"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="cache-2d"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="cache-2d"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="cache-all-in-cell"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="cache-all-in-cell"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="cache-once"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="cache-once"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="clamp"</code> | <code>readonly max: number;</code> (required) | <code>readonly max: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="clamp"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="clamp"</code> | <code>readonly min: number;</code> (required) | <code>readonly min: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="clamp"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="constant"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="constant"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="constant"</code> | <code>readonly value: number;</code> (required) | <code>readonly value: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="coordinate"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="coordinate"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="coordinate"</code> | <code>readonly offset: number;</code> (required) | <code>readonly offset: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="coordinate"</code> | <code>readonly scale: number;</code> (required) | <code>readonly scale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="end-islands"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="end-islands"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="find-top-surface"</code> | <code>readonly cellHeight: number;</code> (required) | <code>readonly cellHeight: DensityCellSize;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="find-top-surface"</code> | <code>readonly lowerBound: number;</code> (required) | <code>readonly lowerBound: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="find-top-surface"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="find-top-surface"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="flat-cache"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="flat-cache"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="interpolated"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="interpolated"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="linear-operation"</code> | <code>readonly argument: number;</code> (required) | <code>readonly argument: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="linear-operation"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="linear-operation"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="noise"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="noise"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="noise"</code> | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="noise"</code> | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="old-blended-noise"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="old-blended-noise"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="old-blended-noise"</code> | <code>readonly smearScaleMultiplier: number;</code> (required) | <code>readonly smearScaleMultiplier: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="old-blended-noise"</code> | <code>readonly xzFactor: number;</code> (required) | <code>readonly xzFactor: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="old-blended-noise"</code> | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="old-blended-noise"</code> | <code>readonly yFactor: number;</code> (required) | <code>readonly yFactor: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="old-blended-noise"</code> | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="range-choice"</code> | <code>readonly maxExclusive: number;</code> (required) | <code>readonly maxExclusive: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="range-choice"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="range-choice"</code> | <code>readonly minInclusive: number;</code> (required) | <code>readonly minInclusive: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="range-choice"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="shift-a"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="shift-a"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="shift-b"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="shift-b"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="shift"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="shift"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="shifted-noise"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="shifted-noise"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="shifted-noise"</code> | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="shifted-noise"</code> | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="spline"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="spline"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="unary"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="unary"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="weird-scaled-sampler"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="weird-scaled-sampler"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="y-clamped-gradient"</code> | <code>readonly fromValue: number;</code> (required) | <code>readonly fromValue: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="y-clamped-gradient"</code> | <code>readonly fromY: number;</code> (required) | <code>readonly fromY: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="y-clamped-gradient"</code> | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="y-clamped-gradient"</code> | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="y-clamped-gradient"</code> | <code>readonly toValue: number;</code> (required) | <code>readonly toValue: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityFunctionValue` | <code>kind="y-clamped-gradient"</code> | <code>readonly toY: number;</code> (required) | <code>readonly toY: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityInterpolated` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityInterpolated` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityLinearOperation` | All variants | <code>readonly argument: number;</code> (required) | <code>readonly argument: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityLinearOperation` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityLinearOperation` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityNoise` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityNoise` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityNoise` | All variants | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityNoise` | All variants | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityNoiseInRangeOptions` | All variants | <code>readonly max: number;</code> (required) | <code>readonly max: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityNoiseInRangeOptions` | All variants | <code>readonly min: number;</code> (required) | <code>readonly min: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityNoiseInRangeOptions` | All variants | <code>readonly xzScale?: number;</code> (optional) | <code>readonly xzScale?: DensityScale;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityNoiseInRangeOptions` | All variants | <code>readonly yScale?: number;</code> (optional) | <code>readonly yScale?: DensityScale;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityNoiseOptions` | All variants | <code>readonly xzScale?: number;</code> (optional) | <code>readonly xzScale?: DensityScale;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityNoiseOptions` | All variants | <code>readonly yScale?: number;</code> (optional) | <code>readonly yScale?: DensityScale;</code> (optional) |
| `@nerima-games/mc-noise` | `DensityNoiseSource` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityNoiseSource` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoise` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoise` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoise` | All variants | <code>readonly smearScaleMultiplier: number;</code> (required) | <code>readonly smearScaleMultiplier: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoise` | All variants | <code>readonly xzFactor: number;</code> (required) | <code>readonly xzFactor: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoise` | All variants | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoise` | All variants | <code>readonly yFactor: number;</code> (required) | <code>readonly yFactor: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoise` | All variants | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoiseOctave` | All variants | <code>readonly sample: (...coordinates: DensityOldBlendedNoiseSample) =&gt; number;</code> (required) | <code>readonly sample: (...coordinates: DensityOldBlendedNoiseSample) =&gt; DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoiseOptions` | All variants | <code>readonly smearScaleMultiplier: number;</code> (required) | <code>readonly smearScaleMultiplier: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoiseOptions` | All variants | <code>readonly xzFactor: number;</code> (required) | <code>readonly xzFactor: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoiseOptions` | All variants | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoiseOptions` | All variants | <code>readonly yFactor: number;</code> (required) | <code>readonly yFactor: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoiseOptions` | All variants | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoiseSource` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityOldBlendedNoiseSource` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityPosition` | All variants | <code>readonly x: number;</code> (required) | <code>readonly x: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityPosition` | All variants | <code>readonly y: number;</code> (required) | <code>readonly y: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityPosition` | All variants | <code>readonly z: number;</code> (required) | <code>readonly z: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityRangeChoice` | All variants | <code>readonly maxExclusive: number;</code> (required) | <code>readonly maxExclusive: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityRangeChoice` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityRangeChoice` | All variants | <code>readonly minInclusive: number;</code> (required) | <code>readonly minInclusive: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityRangeChoice` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityRangeChoiceOptions` | All variants | <code>readonly maxExclusive: number;</code> (required) | <code>readonly maxExclusive: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityRangeChoiceOptions` | All variants | <code>readonly minInclusive: number;</code> (required) | <code>readonly minInclusive: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShift` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShift` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShiftA` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShiftA` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShiftB` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShiftB` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShiftedNoise` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShiftedNoise` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShiftedNoise` | All variants | <code>readonly xzScale: number;</code> (required) | <code>readonly xzScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShiftedNoise` | All variants | <code>readonly yScale: number;</code> (required) | <code>readonly yScale: DensityScale;</code> (required) |
| `@nerima-games/mc-noise` | `DensityShiftedNoise2DOptions` | All variants | <code>readonly xzScale?: number;</code> (optional) | <code>readonly xzScale?: DensityScale;</code> (optional) |
| `@nerima-games/mc-noise` | `DensitySpline` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensitySpline` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityUnary` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityUnary` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityWeirdScaledSampler` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityWeirdScaledSampler` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityYClampedGradient` | All variants | <code>readonly fromValue: number;</code> (required) | <code>readonly fromValue: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityYClampedGradient` | All variants | <code>readonly fromY: number;</code> (required) | <code>readonly fromY: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `DensityYClampedGradient` | All variants | <code>readonly maxValue: number;</code> (required) | <code>readonly maxValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityYClampedGradient` | All variants | <code>readonly minValue: number;</code> (required) | <code>readonly minValue: DensityBound;</code> (required) |
| `@nerima-games/mc-noise` | `DensityYClampedGradient` | All variants | <code>readonly toValue: number;</code> (required) | <code>readonly toValue: DensityValue;</code> (required) |
| `@nerima-games/mc-noise` | `DensityYClampedGradient` | All variants | <code>readonly toY: number;</code> (required) | <code>readonly toY: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftBiomeQuery` | All variants | <code>seed: number;</code> (required) | <code>seed: NoiseSeed;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftBiomeQuery` | All variants | <code>surfaceY: number;</code> (required) | <code>surfaceY: BlockAxisValue;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftBiomeQuery` | All variants | <code>wx: number;</code> (required) | <code>wx: BlockAxisValue;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftBiomeQuery` | All variants | <code>wz: number;</code> (required) | <code>wz: BlockAxisValue;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftBiomeSurface` | All variants | <code>filler: BlockId;</code> (required) | <code>filler: Option.Option&lt;BlockId&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftBiomeSurface` | All variants | <code>top: BlockId;</code> (required) | <code>top: Option.Option&lt;BlockId&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftBiomeSurface` | All variants | <code>underwaterTop: BlockId;</code> (required) | <code>underwaterTop: Option.Option&lt;BlockId&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftClimateSample` | All variants | <code>continentalness: number;</code> (required) | <code>continentalness: BoundedNoise;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftClimateSample` | All variants | <code>erosion: number;</code> (required) | <code>erosion: BoundedNoise;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftClimateSample` | All variants | <code>humidity: number;</code> (required) | <code>humidity: MinecraftClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftClimateSample` | All variants | <code>pv: number;</code> (required) | <code>pv: BoundedNoise;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftClimateSample` | All variants | <code>riverNoise: number;</code> (required) | <code>riverNoise: MinecraftClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftClimateSample` | All variants | <code>temperature: number;</code> (required) | <code>temperature: MinecraftClimateValue;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftResolvedSurfaceMaterial` | All variants | <code>filler: BlockId;</code> (required) | <code>filler: Option.Option&lt;BlockId&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftResolvedSurfaceMaterial` | All variants | <code>fillerDepth: number;</code> (required) | <code>fillerDepth: MinecraftSurfaceFillerDepth;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftResolvedSurfaceMaterial` | All variants | <code>top: BlockId;</code> (required) | <code>top: Option.Option&lt;BlockId&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftSurfaceBiome` | All variants | <code>surfaceY: number;</code> (required) | <code>surfaceY: BlockAxisValue;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftTerrainColumn` | All variants | <code>initialSurfaceY: number;</code> (required) | <code>initialSurfaceY: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftTerrainColumn` | All variants | <code>lakeBasinY: number &#124; undefined;</code> (required) | <code>lakeBasinY: Option.Option&lt;BlockAxis&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftTerrainColumn` | All variants | <code>surfaceY: number;</code> (required) | <code>surfaceY: BlockAxis;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftTerrainColumn` | All variants | <code>temperature: number;</code> (required) | <code>temperature: MinecraftClimateValueType;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftTerrainColumn` | All variants | <code>waterLevel: number &#124; undefined;</code> (required) | <code>waterLevel: Option.Option&lt;BlockAxis&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftTerrainLevels` | All variants | <code>lakeLevel: number;</code> (required) | <code>lakeLevel: BlockAxisValue;</code> (required) |
| `@nerima-games/mc-noise` | `MinecraftTerrainLevels` | All variants | <code>seaLevel: number;</code> (required) | <code>seaLevel: BlockAxisValue;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseChunk3DSamplingOptions` | All variants | <code>readonly originY: number;</code> (required) | <code>readonly originY: PositionAxis;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseChunk3DSamplingOptions` | All variants | <code>readonly stepX?: number;</code> (optional) | <code>readonly stepX?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseChunk3DSamplingOptions` | All variants | <code>readonly stepY?: number;</code> (optional) | <code>readonly stepY?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseChunk3DSamplingOptions` | All variants | <code>readonly stepZ?: number;</code> (optional) | <code>readonly stepZ?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseChunkSamplingOptions` | All variants | <code>readonly sampleStride?: number;</code> (optional) | <code>readonly sampleStride?: SampleStride;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseField` | All variants | <code>readonly octave2d: (x: number, z: number, params?: OctaveParams) =&gt; number;</code> (required) | <code>readonly octave2d: (x: PositionAxis, z: PositionAxis, params?: OctaveParams) =&gt; Result.Result&lt;NormalizedNoise, RangeError&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseGrid2DOptions` | All variants | <code>readonly depth: number;</code> (required) | <code>readonly depth: GridDimension;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseGrid2DOptions` | All variants | <code>readonly stepX?: number;</code> (optional) | <code>readonly stepX?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseGrid2DOptions` | All variants | <code>readonly stepZ?: number;</code> (optional) | <code>readonly stepZ?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseGrid2DOptions` | All variants | <code>readonly width: number;</code> (required) | <code>readonly width: GridDimension;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseGrid3DOptions` | All variants | <code>readonly depth: number;</code> (required) | <code>readonly depth: GridDimension;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseGrid3DOptions` | All variants | <code>readonly height: number;</code> (required) | <code>readonly height: GridDimension;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseGrid3DOptions` | All variants | <code>readonly stepX?: number;</code> (optional) | <code>readonly stepX?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseGrid3DOptions` | All variants | <code>readonly stepY?: number;</code> (optional) | <code>readonly stepY?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseGrid3DOptions` | All variants | <code>readonly stepZ?: number;</code> (optional) | <code>readonly stepZ?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseGrid3DOptions` | All variants | <code>readonly width: number;</code> (required) | <code>readonly width: GridDimension;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGrid3DOptions` | All variants | <code>readonly depth: number;</code> (required) | <code>readonly depth: GridDimension;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGrid3DOptions` | All variants | <code>readonly height: number;</code> (required) | <code>readonly height: GridDimension;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGrid3DOptions` | All variants | <code>readonly sampleStrideX?: number;</code> (optional) | <code>readonly sampleStrideX?: SampleStride;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGrid3DOptions` | All variants | <code>readonly sampleStrideY?: number;</code> (optional) | <code>readonly sampleStrideY?: SampleStride;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGrid3DOptions` | All variants | <code>readonly sampleStrideZ?: number;</code> (optional) | <code>readonly sampleStrideZ?: SampleStride;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGrid3DOptions` | All variants | <code>readonly stepX?: number;</code> (optional) | <code>readonly stepX?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGrid3DOptions` | All variants | <code>readonly stepY?: number;</code> (optional) | <code>readonly stepY?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGrid3DOptions` | All variants | <code>readonly stepZ?: number;</code> (optional) | <code>readonly stepZ?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGrid3DOptions` | All variants | <code>readonly width: number;</code> (required) | <code>readonly width: GridDimension;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGridOptions` | All variants | <code>readonly depth: number;</code> (required) | <code>readonly depth: GridDimension;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGridOptions` | All variants | <code>readonly sampleStride?: number;</code> (optional) | <code>readonly sampleStride?: SampleStride;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGridOptions` | All variants | <code>readonly stepX?: number;</code> (optional) | <code>readonly stepX?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGridOptions` | All variants | <code>readonly stepZ?: number;</code> (optional) | <code>readonly stepZ?: GridStep;</code> (optional) |
| `@nerima-games/mc-noise` | `NoiseInterpolatedGridOptions` | All variants | <code>readonly width: number;</code> (required) | <code>readonly width: GridDimension;</code> (required) |
| `@nerima-games/mc-noise` | `NoisePrimitives` | All variants | <code>octaveNoise2D: (...args: OctaveNoiseArguments) =&gt; number;</code> (required) | <code>octaveNoise2D: (...args: OctaveNoiseArguments) =&gt; Result.Result&lt;NormalizedNoise, RangeError&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `NoisePrimitives` | All variants | <code>sampleTerrainChannels: (xStart: number, zStart: number) =&gt; TerrainChannelSamples;</code> (required) | <code>sampleTerrainChannels: (xStart: BlockAxis, zStart: BlockAxis) =&gt; Result.Result&lt;TerrainChannelSamples, RangeError&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `NoiseRouterRuntime` | All variants | <code>readonly mapAll: (visitor: NoiseRouterVisitor) =&gt; NoiseRouter;</code> (required) | <code>readonly mapAll: (visitor: NoiseRouterVisitor) =&gt; DensityFunctionResult&lt;NoiseRouter&gt;;</code> (required) |
| `@nerima-games/mc-noise` | `OctaveParams` | All variants | <code>readonly lacunarity: number;</code> (required) | <code>readonly lacunarity: OctaveFrequency;</code> (required) |
| `@nerima-games/mc-noise` | `OctaveParams` | All variants | <code>readonly octaves: number;</code> (required) | <code>readonly octaves: OctaveCount;</code> (required) |
| `@nerima-games/mc-noise` | `OctaveParams` | All variants | <code>readonly persistence: number;</code> (required) | <code>readonly persistence: OctaveAmplitude;</code> (required) |
| `@nerima-games/mc-noise` | `ValueNoiseFbmOptions` | All variants | <code>frequency: number;</code> (required) | <code>frequency: NoiseFrequency;</code> (required) |
| `@nerima-games/mc-noise` | `ValueNoiseFbmOptions` | All variants | <code>octaves: number;</code> (required) | <code>octaves: OctaveCountValue;</code> (required) |
| `@nerima-games/mc-noise` | `ValueNoiseFbmOptions` | All variants | <code>persistence: number;</code> (required) | <code>persistence: OctaveAmplitudeValue;</code> (required) |

</details>
<details>
<summary>New brand value constructors (34)</summary>

Call the listed constructor `.result(value)` method and handle its `Result` before using the branded value.

| Constructor | Branded type | Package | Checked construction |
| --- | --- | --- | --- |
| `BlockAxis` | `BlockAxis` | `@nerima-games/mc-kernel` | <code>BlockAxis.result(value)</code> |
| `BoundedNoise` | `BoundedNoise` | `@nerima-games/mc-noise` | <code>BoundedNoise.result(value)</code> |
| `ClimateDistance` | `ClimateDistance` | `@nerima-games/mc-noise` | <code>ClimateDistance.result(value)</code> |
| `ClimateFieldName` | `ClimateFieldName` | `@nerima-games/mc-noise` | <code>ClimateFieldName.result(value)</code> |
| `ClimateFitness` | `ClimateFitness` | `@nerima-games/mc-noise` | <code>ClimateFitness.result(value)</code> |
| `ClimateListIndex` | `ClimateListIndex` | `@nerima-games/mc-noise` | <code>ClimateListIndex.result(value)</code> |
| `ClimateSearchRadius` | `ClimateSearchRadius` | `@nerima-games/mc-noise` | <code>ClimateSearchRadius.result(value)</code> |
| `ClimateSearchStep` | `ClimateSearchStep` | `@nerima-games/mc-noise` | <code>ClimateSearchStep.result(value)</code> |
| `ClimateValue` | `ClimateValue` | `@nerima-games/mc-noise` | <code>ClimateValue.result(value)</code> |
| `DensityArrayIndex` | `DensityArrayIndex` | `@nerima-games/mc-noise` | <code>DensityArrayIndex.result(value)</code> |
| `DensityBound` | `DensityBound` | `@nerima-games/mc-noise` | <code>DensityBound.result(value)</code> |
| `DensityCellSize` | `DensityCellSize` | `@nerima-games/mc-noise` | <code>DensityCellSize.result(value)</code> |
| `DensityFunctionFieldName` | `DensityFunctionFieldName` | `@nerima-games/mc-noise` | <code>DensityFunctionFieldName.result(value)</code> |
| `DensityOctaveIndex` | `DensityOctaveIndex` | `@nerima-games/mc-noise` | <code>DensityOctaveIndex.result(value)</code> |
| `DensityScale` | `DensityScale` | `@nerima-games/mc-noise` | <code>DensityScale.result(value)</code> |
| `DensityValue` | `DensityValue` | `@nerima-games/mc-noise` | <code>DensityValue.result(value)</code> |
| `GridDimension` | `GridDimension` | `@nerima-games/mc-noise` | <code>GridDimension.result(value)</code> |
| `GridStep` | `GridStep` | `@nerima-games/mc-noise` | <code>GridStep.result(value)</code> |
| `LatticeCoordinate` | `LatticeCoordinate` | `@nerima-games/mc-noise` | <code>LatticeCoordinate.result(value)</code> |
| `MinecraftClimateValue` | `MinecraftClimateValue` | `@nerima-games/mc-noise` | <code>MinecraftClimateValue.result(value)</code> |
| `MinecraftSurfaceFillerDepth` | `MinecraftSurfaceFillerDepth` | `@nerima-games/mc-noise` | <code>MinecraftSurfaceFillerDepth.result(value)</code> |
| `NoiseAccumulator` | `NoiseAccumulator` | `@nerima-games/mc-noise` | <code>NoiseAccumulator.result(value)</code> |
| `NoiseChannelLabel` | `NoiseChannelLabel` | `@nerima-games/mc-noise` | <code>NoiseChannelLabel.result(value)</code> |
| `NoiseFrequency` | `NoiseFrequency` | `@nerima-games/mc-noise` | <code>NoiseFrequency.result(value)</code> |
| `NormalizedNoise` | `NormalizedNoise` | `@nerima-games/mc-noise` | <code>NormalizedNoise.result(value)</code> |
| `OctaveAmplitude` | `OctaveAmplitude` | `@nerima-games/mc-noise` | <code>OctaveAmplitude.result(value)</code> |
| `OctaveCount` | `OctaveCount` | `@nerima-games/mc-noise` | <code>OctaveCount.result(value)</code> |
| `OctaveFrequency` | `OctaveFrequency` | `@nerima-games/mc-noise` | <code>OctaveFrequency.result(value)</code> |
| `PositionAxis` | `PositionAxis` | `@nerima-games/mc-kernel` | <code>PositionAxis.result(value)</code> |
| `QuantizedClimateValue` | `QuantizedClimateValue` | `@nerima-games/mc-noise` | <code>QuantizedClimateValue.result(value)</code> |
| `SampleStride` | `SampleStride` | `@nerima-games/mc-noise` | <code>SampleStride.result(value)</code> |
| `SplineInput` | `SplineInput` | `@nerima-games/mc-noise` | <code>SplineInput.result(value)</code> |
| `SplineValue` | `SplineValue` | `@nerima-games/mc-noise` | <code>SplineValue.result(value)</code> |
| `ValueNoiseFbmSample` | `ValueNoiseFbmSample` | `@nerima-games/mc-noise` | <code>ValueNoiseFbmSample.result(value)</code> |

</details>

<!-- END GENERATED SIGNATURE TABLES -->

## Maintaining the generated tables

This section is for maintainers; it is not a consumer migration step.

Prepare separate worktrees for the base and candidate revisions. The commands
below assume both worktrees already exist. The `Before` column uses the base
worktree; the `After` column uses the candidate worktree. In each worktree,
install dependencies with its lockfile and build the declarations:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

Run the generator from the candidate worktree, passing both emitted declaration
entrypoints:

```sh
node scripts/generate-consumer-migration.mjs \
  --base-ref <base-revision> \
  --head-ref <candidate-revision> \
  --base-dts <base-worktree>/dist/index.d.ts \
  --head-dts <candidate-worktree>/dist/index.d.ts
```

The generator extracts declarations and public type fields with the TypeScript
checker, follows type references from mc-noise's public declarations, and reads
matching dependency fields from declared public entrypoints. It checks that each
input's declaration build files match its Git revision. It updates the section
between the markers and the pinned API model in
`test/fixtures/consumer-migration/api-model.json`. Keep the markers in place.
Run `pnpm verify:consumer-migration` to emit declarations from current source
into a temporary directory and compare them with the pinned candidate API model
and the generated section. This check does not modify the guide; `pnpm verify`
runs it as part of CI.

During generation, the base `.d.ts` and its declaration build inputs are checked
against the base Git ref before its API model is pinned. `--check` validates the
pinned model metadata and candidate API, but does not rebuild or reread the base
`.d.ts`.

See [public-api.md](./public-api.md) for the full API contract and
[responsibility.md](./responsibility.md) for dependency boundaries.
