/* oxlint-disable new-cap -- Kernel brands use uppercase constructors by contract. */

import {
  BlockAxis,
  ChunkAxis,
  LocalAxis,
  PositionAxis,
  chunkCoord,
  type ChunkCoord,
} from '@nerima-games/mc-kernel/domain/coordinates'
import { ChunkHeight } from '@nerima-games/mc-kernel/domain/chunk'
import { Result } from 'effect'
import {
  ClimateFieldName,
  NoiseFrequency,
  NoiseSeed,
  OctaveAmplitude,
  OctaveCount,
  createNoiseField,
  fbm2D,
  requireClimateParameter,
  sampleNoise2DChunk,
  sampleNoise3DChunk,
  type ValueNoiseFbmSample,
} from '../src/index.js'

const noise2D = (x: number, z: number): number => x + z
const noise3D = (x: number, y: number, z: number): number => x + y + z

const chunk: ChunkCoord = chunkCoord(ChunkAxis(0), ChunkAxis(0))
const height = Result.getOrThrow(ChunkHeight(1))

sampleNoise2DChunk(noise2D, chunk)
sampleNoise3DChunk(noise3D, chunk, height, { originY: PositionAxis(0) })

createNoiseField(NoiseSeed(1))
requireClimateParameter(ClimateFieldName('temperature'), {})

export const fbmResult: Result.Result<ValueNoiseFbmSample, RangeError> = fbm2D(
  NoiseSeed(1),
  0,
  0,
  {
    octaves: OctaveCount(2),
    frequency: NoiseFrequency(1),
    persistence: OctaveAmplitude(0.5),
  },
)

// @ts-expect-error The fBm success value must carry the finite sample brand.
export const rawFbmResult: ReturnType<typeof fbm2D> = Result.succeed(1)

// @ts-expect-error Public seed-taking APIs require the NoiseSeed brand.
createNoiseField(1)

// @ts-expect-error Climate validation diagnostics use a dedicated label brand.
requireClimateParameter('temperature', {})

const chunkAxis = ChunkAxis(0)
const blockAxis = BlockAxis(0)
const localAxis = LocalAxis(0)

// @ts-expect-error ChunkAxis and BlockAxis are distinct kernel brands.
sampleNoise2DChunk(noise2D, { cx: blockAxis, cz: chunkAxis })

// @ts-expect-error ChunkAxis and LocalAxis are distinct kernel brands.
sampleNoise2DChunk(noise2D, { cx: localAxis, cz: chunkAxis })

// @ts-expect-error ChunkHeight is not interchangeable with a coordinate brand.
sampleNoise3DChunk(noise3D, chunk, chunkAxis, { originY: PositionAxis(0) })

// @ts-expect-error BlockAxis is not interchangeable with PositionAxis.
sampleNoise3DChunk(noise3D, chunk, height, { originY: BlockAxis(0) })
