import type { NoiseFn2D } from './perlin'

/** The boundary a value must exceed to count as positive in `requirePositiveInteger`/`requirePositiveFinite`. */
const POSITIVE_BOUNDARY = 0
/** Default grid origin when `originX`/`originZ` is omitted: the coordinate space's zero point. */
const DEFAULT_GRID_ORIGIN = 0
/** Default grid step when `stepX`/`stepZ` is omitted: one noise sample per grid cell. */
const DEFAULT_GRID_STEP = 1
/** The amount each loop index advances per iteration. */
const LOOP_STEP = 1

export type NoisePoint2D = Readonly<{
  readonly x: number
  readonly z: number
}>

export type NoiseGrid2DOptions = Readonly<{
  readonly width: number
  readonly depth: number
  readonly originX?: number
  readonly originZ?: number
  readonly stepX?: number
  readonly stepZ?: number
}>

type NormalizedNoiseGrid2DOptions = Readonly<{
  readonly width: number
  readonly depth: number
  readonly originX: number
  readonly originZ: number
  readonly stepX: number
  readonly stepZ: number
}>

const requirePositiveInteger = (name: string, value: number): number => {
  if (!Number.isInteger(value) || value <= POSITIVE_BOUNDARY) {
    throw new RangeError(`${name} must be a positive integer, received ${value}`)
  }
  return value
}

const requireFinite = (name: string, value: number): number => {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite, received ${value}`)
  }
  return value
}

const requirePositiveFinite = (name: string, value: number): number => {
  requireFinite(name, value)
  if (value <= POSITIVE_BOUNDARY) {
    throw new RangeError(`${name} must be positive, received ${value}`)
  }
  return value
}

const normalizeGridOptions = (options: NoiseGrid2DOptions): NormalizedNoiseGrid2DOptions => {
  const width = requirePositiveInteger('width', options.width)
  const depth = requirePositiveInteger('depth', options.depth)
  const originX = options.originX ?? DEFAULT_GRID_ORIGIN
  const originZ = options.originZ ?? DEFAULT_GRID_ORIGIN
  const stepX = options.stepX ?? DEFAULT_GRID_STEP
  const stepZ = options.stepZ ?? DEFAULT_GRID_STEP
  return {
    depth,
    originX: requireFinite('originX', originX),
    originZ: requireFinite('originZ', originZ),
    stepX: requirePositiveFinite('stepX', stepX),
    stepZ: requirePositiveFinite('stepZ', stepZ),
    width,
  }
}

export const sampleNoise2DBatch = (
  noise: NoiseFn2D,
  points: ReadonlyArray<NoisePoint2D>,
): Float32Array => {
  const samples = new Float32Array(points.length)
  for (let index = 0; index < points.length; index += LOOP_STEP) {
    const point = points[index]
    if (!point) {
      throw new RangeError(`points[${index}] is missing`)
    }
    samples[index] = noise(requireFinite('point.x', point.x), requireFinite('point.z', point.z))
  }
  return samples
}

export const sampleNoise2DGrid = (noise: NoiseFn2D, options: NoiseGrid2DOptions): Float32Array => {
  const { depth, originX, originZ, stepX, stepZ, width } = normalizeGridOptions(options)

  const samples = new Float32Array(width * depth)
  for (let zIndex = 0; zIndex < depth; zIndex += LOOP_STEP) {
    const z = originZ + zIndex * stepZ
    for (let xIndex = 0; xIndex < width; xIndex += LOOP_STEP) {
      const x = originX + xIndex * stepX
      samples[zIndex * width + xIndex] = noise(x, z)
    }
  }
  return samples
}
