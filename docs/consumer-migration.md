# Consumer migration: mc-noise 0.5

This guide targets the `0.5.0` release created by this migration's minor
changeset. Install it after the release is published.

mc-noise 0.5 moves to Effect 4 and mc-kernel 0.9. Several public inputs now use
domain brands, and APIs that can reject runtime input return typed `Result`
values. Update callers at those boundaries before upgrading.

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
validated. Seed normalization to a uint32 bit pattern remains in the PRNG and
derived-seed paths, so equivalent bit patterns continue to produce the same
field.

## mc-kernel 0.9 coordinate brands

Import coordinate brands from the coordinates subpath and `ChunkHeight` from
the chunk subpath. Keep chunk, block, local, and world-position axes distinct:

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
`Result`. Import `Option` and `Result` from `effect`, and import `BlockType` and
`blockIdOf` from `@nerima-games/mc-kernel/domain/block-type` and
`@nerima-games/mc-kernel/domain/block-registry`, respectively; `blockIdOf`
returns `Option.Option<BlockId>`.

## Typed failures

Density-function constructors, spline construction and evaluation, codec
operations, climate queries, and sampling adapters return `Result` when their
inputs can fail validation. Compose those calls with `Result.flatMap` or inspect
the result explicitly. For example, density encoding and parsing are no longer
exception boundaries:

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
`RangeError`. Absence is represented with `Option`; invalid input and failed
construction are represented with `Result`. Do not rely on exceptions for these
operations.

See [public-api.md](./public-api.md) for the full API contract and
[responsibility.md](./responsibility.md) for dependency boundaries.
