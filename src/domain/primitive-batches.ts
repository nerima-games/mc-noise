import type { NoisePrimitives } from './noise-primitives.js'
import type { OctaveParameters } from './octaves.js'

export type Point2D = readonly [x: number, z: number]

const MISSING_COORDINATE = Number.NaN
const MISSING_POINT: Point2D = [MISSING_COORDINATE, MISSING_COORDINATE]
const BATCH_INDEX_STEP = 1

type OctaveBatchArguments = readonly [
  primitives: NoisePrimitives,
  xs: readonly number[],
  zs: readonly number[],
  ...octaveArguments: OctaveParameters,
]

type OctavePointBatchArguments = readonly [
  primitives: NoisePrimitives,
  points: readonly Point2D[],
  ...octaveArguments: OctaveParameters,
]

const coordinateAt = (values: readonly number[], index: number): number => values[index] ?? MISSING_COORDINATE

const pointAt = (points: readonly Point2D[], index: number): Point2D => points[index] ?? MISSING_POINT

export const noise2DBatchXY = (
  primitives: NoisePrimitives,
  xs: readonly number[],
  zs: readonly number[],
): ReadonlyArray<number> => {
  const output = new Array<number>(xs.length)
  for (let index = 0; index < xs.length; index += BATCH_INDEX_STEP) {
    output[index] = primitives.noise2D(coordinateAt(xs, index), coordinateAt(zs, index))
  }
  return output
}

export const octaveNoise2DBatchXY = (...args: OctaveBatchArguments): ReadonlyArray<number> => {
  const [primitives, xs, zs, octaves, persistence, lacunarity] = args
  const output = new Array<number>(xs.length)
  for (let index = 0; index < xs.length; index += BATCH_INDEX_STEP) {
    output[index] = primitives.octaveNoise2D(
      coordinateAt(xs, index),
      coordinateAt(zs, index),
      octaves,
      persistence,
      lacunarity,
    )
  }
  return output
}

export const noise3DBatchXYZ = (
  primitives: NoisePrimitives,
  xs: readonly number[],
  ys: readonly number[],
  zs: readonly number[],
): ReadonlyArray<number> => {
  const output = new Array<number>(xs.length)
  for (let index = 0; index < xs.length; index += BATCH_INDEX_STEP) {
    output[index] = primitives.noise3D(
      coordinateAt(xs, index),
      coordinateAt(ys, index),
      coordinateAt(zs, index),
    )
  }
  return output
}

export const noise2DBatch = (primitives: NoisePrimitives, points: readonly Point2D[]): ReadonlyArray<number> => {
  const output = new Array<number>(points.length)
  for (let index = 0; index < points.length; index += BATCH_INDEX_STEP) {
    const [x, z] = pointAt(points, index)
    output[index] = primitives.noise2D(x, z)
  }
  return output
}

export const octaveNoise2DBatch = (...args: OctavePointBatchArguments): ReadonlyArray<number> => {
  const [primitives, points, octaves, persistence, lacunarity] = args
  const output = new Array<number>(points.length)
  for (let index = 0; index < points.length; index += BATCH_INDEX_STEP) {
    const [x, z] = pointAt(points, index)
    output[index] = primitives.octaveNoise2D(x, z, octaves, persistence, lacunarity)
  }
  return output
}
