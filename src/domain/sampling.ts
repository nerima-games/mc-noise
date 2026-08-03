import type { NoiseFn2D } from './perlin'

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
  if (!Number.isInteger(value) || value <= 0) {
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
  if (value <= 0) {
    throw new RangeError(`${name} must be positive, received ${value}`)
  }
  return value
}

const normalizeGridOptions = (options: NoiseGrid2DOptions): NormalizedNoiseGrid2DOptions => {
  const width = requirePositiveInteger('width', options.width)
  const depth = requirePositiveInteger('depth', options.depth)
  const originX = options.originX ?? 0
  const originZ = options.originZ ?? 0
  const stepX = options.stepX ?? 1
  const stepZ = options.stepZ ?? 1
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
  for (let index = 0; index < points.length; index += 1) {
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
  for (let zIndex = 0; zIndex < depth; zIndex += 1) {
    const z = originZ + zIndex * stepZ
    for (let xIndex = 0; xIndex < width; xIndex += 1) {
      const x = originX + xIndex * stepX
      samples[zIndex * width + xIndex] = noise(x, z)
    }
  }
  return samples
}
