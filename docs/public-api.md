# Public API

This document describes the package entrypoint in `src/index.ts`. For migration
examples, see [consumer-migration.md](./consumer-migration.md). The generated
noise mapping is versioned: changing the PRNG, salts, kernel, or octave tuning
can change existing worlds.

## Effect 4 and `mc-kernel` 0.9

Import `Result` and `Option` from `effect`. Public operations that can reject
runtime input return `Result.Result<Success, Failure>`; optional search results
use `Option.Option<Value>` inside the `Result` where validation can also fail.
Propagate or inspect failures before using the success value.

Chunk sampling uses the coordinate brands from
`@nerima-games/mc-kernel/domain/coordinates` and `ChunkHeight` from
`@nerima-games/mc-kernel/domain/chunk`. `ChunkAxis`, `LocalAxis`, `BlockAxis`,
and `PositionAxis` are separate coordinate domains. Import `BlockType` from
`@nerima-games/mc-kernel/domain/block-type`; `blockIdOf` accepts it and returns
`Option.Option<BlockId>` from
`@nerima-games/mc-kernel/domain/block-registry`.

For untrusted numeric input, use a brand constructor's `.result` method and
check its failure before passing the branded value onward. `ChunkHeight` is a
kernel function that already returns `Result`. Calling a brand constructor
directly throws when its input is invalid, so call it only when the input is
already known to satisfy its domain.

```ts
import { Option, Result } from 'effect'
import { ChunkAxis, PositionAxis, chunkCoord } from '@nerima-games/mc-kernel/domain/coordinates'
import { ChunkHeight } from '@nerima-games/mc-kernel/domain/chunk'
import { blockIdOf } from '@nerima-games/mc-kernel/domain/block-registry'
import type { BlockType } from '@nerima-games/mc-kernel/domain/block-type'
import { sampleNoise3DChunk } from '@nerima-games/mc-noise'
import type { NoiseFn3D } from '@nerima-games/mc-noise'

const sampleChunk = (
  noise: NoiseFn3D,
  rawChunkX: number,
  rawChunkZ: number,
  rawHeight: number,
  rawOriginY: number,
) => {
  const chunkX = ChunkAxis.result(rawChunkX)
  const chunkZ = ChunkAxis.result(rawChunkZ)
  const height = ChunkHeight(rawHeight)
  const originY = PositionAxis.result(rawOriginY)
  if (Result.isFailure(chunkX)) return Result.fail(chunkX.failure)
  if (Result.isFailure(chunkZ)) return Result.fail(chunkZ.failure)
  if (Result.isFailure(height)) return Result.fail(height.failure)
  if (Result.isFailure(originY)) return Result.fail(originY.failure)

  const chunk = chunkCoord(chunkX.success, chunkZ.success)
  return sampleNoise3DChunk(noise, chunk, height.success, {
    originY: originY.success,
  })
}

const blockType = 'stone' satisfies BlockType
const hasBlockId = (value: BlockType): boolean => Option.isSome(blockIdOf(value))
const isRegistered = hasBlockId(blockType)
```

## Seeds and samplers

`NoiseSeed` accepts safe integers, including negative integers. PRNG and
derived-seed boundaries normalize the value to uint32, so `-1`, `4294967295`,
and `0xFFFFFFFF` produce the same bit pattern. Use `NoiseSeed.result(value)` for
untrusted input; it returns a typed failure instead of throwing.

```ts
export type NoiseSeed = number & Brand.Brand<'NoiseSeed'>
export const NoiseSeed: Brand.Constructor<NoiseSeed>
export const toUint32 = (seed: NoiseSeed): NoiseSeed
export const deriveSeed = (seed: NoiseSeed, channel: NoiseChannel): NoiseSeed
export const mulberry32 = (seed: NoiseSeed): RandFn
```

`createNoiseField(seed)` builds the samplers once per world. `NoiseFn2D` and
`NoiseFn3D` remain ordinary numeric callbacks because they are called in the
sampling hot path. The `NoiseField.octave2d` method uses `PositionAxis` and
returns `Result`.

`NoiseChannel` is the closed set of named channels accepted by
`NoiseField.channel`. `NoiseChannelLabel` is an open string brand for deriving
independent seeds with `channelSeed`; it does not add names to the field's
published channel set.

World-seed APIs use `NoiseSeed`, including `createNoiseField`,
`createNoisePrimitives`, `toUint32`, `deriveSeed`, `mulberry32`, `channelSeed`,
`latticeValue`, `valueNoise2D`, `fbm2D`, and the Minecraft terrain helpers
`minecraftContinentalnessAt`, `minecraftSurfaceHeightAt`, `minecraftClimateAt`,
`minecraftSurfaceBiomeAt`, `minecraftBiomeFor`, and `minecraftTerrainColumnAt`.
Calling `NoiseSeed(value)` directly throws for invalid input, so use it only for
values already known to be safe integers. Use `NoiseSeed.result(value)` for
untrusted input.

```ts
export type RandFn = () => number
export type NoiseFn2D = (x: number, z: number) => number
export type NoiseFn3D = (x: number, y: number, z: number) => number

export type NoiseField = {
  readonly seed: NoiseSeed
  readonly raw2d: NoiseFn2D
  readonly raw3d: NoiseFn3D
  readonly noise2d: NoiseFn2D
  readonly noise3d: NoiseFn3D
  readonly octave2d: (
    x: PositionAxis,
    z: PositionAxis,
    params?: OctaveParams,
  ) => Result.Result<NormalizedNoise, RangeError>
  readonly channel: (name: NoiseChannel) => NoiseFn2D
}
export const createNoiseField = (seed: NoiseSeed): NoiseField
```

`raw2d` and `raw3d` return signed noise. `noise2d` and `noise3d` map their
outputs into `[0, 1]`. Channel samplers remain signed for terrain splines.

`createPerlinNoise2D` and `createPerlinNoise3D` require an explicit `RandFn`;
there is no `Math.random` fallback. `deriveSeed` applies the published channel
salt table. Changing a sampler's algorithm or salt is a world-compatibility
change.

## Octaves and value noise

Octave counts, amplitudes, and frequencies have separate brands. The
position-based APIs take `PositionAxis`; invalid samples or non-finite
accumulations are returned as `RangeError` failures.

```ts
export type OctaveCount = number & Brand.Brand<'OctaveCount'>
export type OctaveAmplitude = number & Brand.Brand<'OctaveAmplitude'>
export type OctaveFrequency = number & Brand.Brand<'OctaveFrequency'>
export type OctaveParams = Readonly<{
  octaves: OctaveCount
  persistence: OctaveAmplitude
  lacunarity: OctaveFrequency
}>

export const normalizeNoise = (value: BoundedNoise): NormalizedNoise
export const clampSigned = (value: NoiseAccumulator): BoundedNoise
export const octaveNoise2D = (
  noise: NoiseFn2D,
  x: PositionAxis,
  z: PositionAxis,
  params: OctaveParams,
): Result.Result<NormalizedNoise, RangeError>
export const computeOctaveNoise = (
  noise: NoiseFn2D,
  x: PositionAxis,
  z: PositionAxis,
  octaves: OctaveCount,
  persistence: OctaveAmplitude,
  lacunarity: OctaveFrequency,
): Result.Result<NormalizedNoise, RangeError>
export const signedFbm2D = (
  noise: NoiseFn2D,
  params: OctaveParams,
  boost?: OctaveAmplitude,
): NoiseFn2D
```

`octaveNoise2D` returns the normalized midpoint `0.5` when `octaves < 1`.
`computeOctaveNoise` retains its positional primitive API and returns `0` for
that degenerate case.

Value-noise sample coordinates remain continuous numeric inputs. Frequency,
octave count, channel label, lattice coordinate, and seed use their own domain
types. Runtime validation failures are returned in `Result`.
Create these brands from untrusted values with `.result`, for example
`NoiseFrequency.result(rawFrequency)`, and propagate its failure before use.

The continuous coordinates in `NoisePoint2D`, `NoisePoint3D`,
`NoiseGrid2DOptions`, `NoiseGrid3DOptions`, and `SimplexNoise2DOptions` /
`SimplexNoise3DOptions` also remain numeric inputs. These sample coordinates
are intentionally distinct from the discrete block and chunk coordinate brands.

```ts
export type NoiseChannelLabel = string & Brand.Brand<'NoiseChannelLabel'>
export type NoiseFrequency = number & Brand.Brand<'NoiseFrequency'>
export type LatticeCoordinate = number & Brand.Brand<'LatticeCoordinate'>
export type ValueNoiseFbmSample = number & Brand.Brand<'ValueNoiseFbmSample'>
export type ValueNoiseFbmOptions = Readonly<{
  octaves: OctaveCount
  frequency: NoiseFrequency
  persistence: OctaveAmplitude
}>

export const channelSeed = (seed: NoiseSeed, channel: NoiseChannelLabel): NoiseSeed
export const latticeValue = (
  seed: NoiseSeed,
  x: LatticeCoordinate,
  z: LatticeCoordinate,
): BoundedNoise
export const valueNoise2D = (
  seed: NoiseSeed,
  x: number,
  z: number,
  frequency: NoiseFrequency,
): Result.Result<BoundedNoise, RangeError>
export const fbm2D = (
  seed: NoiseSeed,
  x: number,
  z: number,
  options: ValueNoiseFbmOptions,
): Result.Result<ValueNoiseFbmSample, RangeError>
```

`ValueNoiseFbmSample` is finite but is not restricted to `[0, 1]`, because
negative persistence can produce a weighted result outside that range.

## Sampling and splines

Grid dimensions, steps, strides, and chunk coordinates are branded. The
continuous origins accepted by grid samplers remain numeric coordinates at
that API boundary. Batch, grid, interpolation, and chunk sampling operations
return `Result.Result<Float32Array, RangeError>`.

`sampleNoise2DChunk` takes `ChunkCoord`. `sampleNoise3DChunk` also takes a
`ChunkHeight` and a `PositionAxis` vertical origin. Both preserve the kernel
brands and validate their sample configuration.

```ts
export const sampleNoise2DChunk = (
  noise: NoiseFn2D,
  chunk: ChunkCoord,
  options?: NoiseChunkSamplingOptions,
): Result.Result<Float32Array, RangeError>
export const sampleNoise3DChunk = (
  noise: NoiseFn3D,
  chunk: ChunkCoord,
  height: ChunkHeight,
  options: NoiseChunk3DSamplingOptions,
): Result.Result<Float32Array, RangeError>
```

Spline control points use `SplineInput` and `SplineValue`. Construction checks
that inputs and values are finite and input coordinates increase strictly;
evaluation returns `Result` and clamps to endpoint values outside the control
range.

```ts
export type SplineInput = number & Brand.Brand<'SplineInput'>
export type SplineValue = number & Brand.Brand<'SplineValue'>
export type ControlPoint = readonly [input: SplineInput, value: SplineValue]
export type Spline = ReadonlyArray<ControlPoint>

export const createSpline = (
  controlPoints: Spline,
): Result.Result<Spline, TypeError | RangeError>
export const evaluateSpline = (
  spline: Spline,
  input: SplineInput,
): Result.Result<SplineValue, TypeError | RangeError>
```

## Climate and density functions

Climate scalar values, quantized values, distances, fitness, search radius,
search step, and list indices use dedicated brands. Climate field labels use
`ClimateFieldName`. Climate constructors, queries, and spawn searches return
`Result`; queries that may find no value wrap the value in `Option`.

```ts
export const createClimateSampler = (
  options: ClimateSamplerOptions,
): Result.Result<ClimateSampler, TypeError | RangeError>
export const sampleClimateAt = (
  sampler: ClimateSampler,
  position: Position,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): Result.Result<ClimateTargetPoint, TypeError | RangeError>
export const findClimateSpawnPosition = (
  sampler: ClimateSampler,
  targets?: readonly ClimateParameterPoint[],
  options?: ClimateSpawnSearchOptions,
): Result.Result<Option.Option<BlockPosition>, TypeError | RangeError>
```

Density values, bounds, scales, cell sizes, and field names are branded.
Positions use `PositionAxis`, and discrete block coordinates use `BlockAxis`.
Fallible node construction, evaluation, blender construction, and router
validation return `Result` with `TypeError` or `RangeError` failures.

```ts
export type DensityFunctionResult<Value> = Result.Result<Value, TypeError | RangeError>
export const createBlender = (
  options?: BlenderOptions,
): DensityFunctionResult<Blender>
export const requireBlender = (
  value: unknown,
): DensityFunctionResult<Blender>
export const densityConstant = (
  value: DensityValue,
): DensityFunctionResult<DensityFunction>
export const evaluateDensityFunction = (
  density: DensityFunction,
  position: DensityPosition,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): Result.Result<DensityValue, TypeError | RangeError>
```

`BlenderOptions` callbacks return `DensityFunctionResult`. `createBlender`
checks the options, and the resulting callbacks validate each returned `Result`
when invoked. `requireBlender` accepts an unknown value and returns a validated
`Blender` inside `Result`.

`encodeDensityFunction` and `decodeDensityFunction` convert between density
values and the JSON-shaped `DensityFunctionEncoded` representation.
`stringifyDensityFunction` and `parseDensityFunction` serialize and parse that
representation as text. The codec error union includes `SchemaError` for JSON
schema decoding, plus `TypeError` and `RangeError` for other invalid inputs.
Decoding validates wire data before creating domain values. The encoded `source`
and `seed` fields are serialized strings; they remain wire fields rather than
domain scalar brands.

```ts
import type { SchemaError } from 'effect/Schema'

export type DensityFunctionCodecError = SchemaError | TypeError | RangeError
export type DensityFunctionCodecResult<Value> = Result.Result<Value, DensityFunctionCodecError>
export const encodeDensityFunction = (
  density: DensityFunction,
  options?: DensityFunctionCodecOptions,
): DensityFunctionCodecResult<DensityFunctionEncoded>
export const decodeDensityFunction = (
  value: unknown,
  options?: DensityFunctionCodecOptions,
): DensityFunctionCodecResult<DensityFunction>
export const stringifyDensityFunction = (
  density: DensityFunction,
  options?: DensityFunctionCodecOptions,
): DensityFunctionCodecResult<string>
export const parseDensityFunction = (
  serialized: string,
  options?: DensityFunctionCodecOptions,
): DensityFunctionCodecResult<DensityFunction>
```

`mc-noise` owns portable noise, climate, biome, terrain-column, lake, surface,
and DensityFunction definitions. World-specific terrain equations, control
points, configured `NoiseRouter` values, cache lifecycles, and block placement
remain the responsibility of `mc-worldgen`.

## Versioned behavior

The seed-to-value mapping is part of the saved-world contract. Changes to the
PRNG, channel salts, permutation shuffle, fade curve, gradients, amplitudes, or
channel octave parameters can alter generated terrain and require an explicit
versioning decision. See [versioning.md](./versioning.md) and
[design-notes.md](./design-notes.md).
