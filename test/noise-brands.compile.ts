/* oxlint-disable new-cap -- Kernel brands use uppercase constructors by contract. */

import {
  BlockAxis,
  ChunkAxis,
  ChunkHeight,
  LocalAxis,
  chunkCoord,
  type ChunkCoord,
} from '@nerima-games/mc-kernel'
import { sampleNoise2DChunk, sampleNoise3DChunk } from '../src/index.js'

const noise2D = (x: number, z: number): number => x + z
const noise3D = (x: number, y: number, z: number): number => x + y + z

const chunk: ChunkCoord = chunkCoord(0, 0)
const height = ChunkHeight(1)

sampleNoise2DChunk(noise2D, chunk)
sampleNoise3DChunk(noise3D, chunk, height, { originY: 0 })

const chunkAxis = ChunkAxis(0)
const blockAxis = BlockAxis(0)
const localAxis = LocalAxis(0)

// @ts-expect-error ChunkAxis and BlockAxis are distinct kernel brands.
sampleNoise2DChunk(noise2D, { cx: blockAxis, cz: chunkAxis })

// @ts-expect-error ChunkAxis and LocalAxis are distinct kernel brands.
sampleNoise2DChunk(noise2D, { cx: localAxis, cz: chunkAxis })

// @ts-expect-error ChunkHeight is not interchangeable with a coordinate brand.
sampleNoise3DChunk(noise3D, chunk, chunkAxis, { originY: 0 })
