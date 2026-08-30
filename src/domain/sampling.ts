import { requireFinite, requirePositiveFinite, requirePositiveInteger } from './number-validation.js'
import type { NoiseFn2D } from './perlin.js'

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

export type NoiseInterpolatedGridOptions = Readonly<
  NoiseGrid2DOptions & {
    readonly sampleStride?: number
  }
>

type CoarseNoiseGrid = Readonly<{
  readonly samples: Float32Array
  readonly width: number
}>

type InterpolationAxis = Readonly<{
  readonly cellIndex: number
  readonly nextCellIndex: number
  readonly weight: number
}>

type CoarseRowSamplingOptions = Readonly<{
  readonly noise: NoiseFn2D
  readonly options: NormalizedNoiseGrid2DOptions
  readonly sampleStride: number
  readonly coarseWidth: number
  readonly rowIndex: number
  readonly samples: Float32Array
}>

const sampleCoarseRow = ({
  noise,
  options,
  sampleStride,
  coarseWidth,
  rowIndex,
  samples,
}: CoarseRowSamplingOptions): void => {
  const zIndex = Math.min(rowIndex * sampleStride, options.depth - LOOP_STEP)
  const z = options.originZ + zIndex * options.stepZ

  for (let xIndex = POSITIVE_BOUNDARY; xIndex < coarseWidth; xIndex += LOOP_STEP) {
    const sampleXIndex = Math.min(xIndex * sampleStride, options.width - LOOP_STEP)
    const x = options.originX + sampleXIndex * options.stepX
    samples[rowIndex * coarseWidth + xIndex] = noise(x, z)
  }
}

const createCoarseGrid = (
  noise: NoiseFn2D,
  options: NormalizedNoiseGrid2DOptions,
  sampleStride: number,
): CoarseNoiseGrid => {
  const width = Math.ceil((options.width - LOOP_STEP) / sampleStride) + LOOP_STEP
  const depth = Math.ceil((options.depth - LOOP_STEP) / sampleStride) + LOOP_STEP
  const samples = new Float32Array(width * depth)

  for (let rowIndex = POSITIVE_BOUNDARY; rowIndex < depth; rowIndex += LOOP_STEP) {
    sampleCoarseRow({
      coarseWidth: width,
      noise,
      options,
      rowIndex,
      sampleStride,
      samples,
    })
  }
  return { samples, width }
}

const createInterpolationAxis = (
  index: number,
  maxIndex: number,
  sampleStride: number,
): InterpolationAxis => {
  const cellIndex = Math.floor(index / sampleStride)
  const firstIndex = cellIndex * sampleStride
  const lastIndex = Math.min(firstIndex + sampleStride, maxIndex)
  let weight = POSITIVE_BOUNDARY
  if (lastIndex !== firstIndex) {
    weight = (index - firstIndex) / (lastIndex - firstIndex)
  }
  return {
    cellIndex,
    nextCellIndex: Math.min(
      cellIndex + LOOP_STEP,
      Math.ceil(maxIndex / sampleStride),
    ),
    weight,
  }
}

const interpolateLinear = (start: number, end: number, weight: number): number =>
  start + (end - start) * weight

const interpolateCoarseCell = (
  coarseGrid: CoarseNoiseGrid,
  xAxis: InterpolationAxis,
  zAxis: InterpolationAxis,
): number => {
  const topLeft =
    coarseGrid.samples[zAxis.cellIndex * coarseGrid.width + xAxis.cellIndex]!
  const topRight =
    coarseGrid.samples[zAxis.cellIndex * coarseGrid.width + xAxis.nextCellIndex]!
  const bottomLeft =
    coarseGrid.samples[zAxis.nextCellIndex * coarseGrid.width + xAxis.cellIndex]!
  const bottomRight =
    coarseGrid.samples[
      zAxis.nextCellIndex * coarseGrid.width + xAxis.nextCellIndex
    ]!
  const top = interpolateLinear(topLeft, topRight, xAxis.weight)
  const bottom = interpolateLinear(bottomLeft, bottomRight, xAxis.weight)
  return interpolateLinear(top, bottom, zAxis.weight)
}

const interpolateGrid = (
  coarseGrid: CoarseNoiseGrid,
  options: NormalizedNoiseGrid2DOptions,
  sampleStride: number,
): Float32Array => {
  const samples = new Float32Array(options.width * options.depth)

  for (let zIndex = POSITIVE_BOUNDARY; zIndex < options.depth; zIndex += LOOP_STEP) {
    const zAxis = createInterpolationAxis(
      zIndex,
      options.depth - LOOP_STEP,
      sampleStride,
    )
    for (let xIndex = POSITIVE_BOUNDARY; xIndex < options.width; xIndex += LOOP_STEP) {
      const xAxis = createInterpolationAxis(
        xIndex,
        options.width - LOOP_STEP,
        sampleStride,
      )
      samples[zIndex * options.width + xIndex] = interpolateCoarseCell(
        coarseGrid,
        xAxis,
        zAxis,
      )
    }
  }
  return samples
}

export const sampleNoise2DInterpolatedGrid = (
  noise: NoiseFn2D,
  options: NoiseInterpolatedGridOptions,
): Float32Array => {
  const normalizedOptions = normalizeGridOptions(options)
  const sampleStride = requirePositiveInteger(
    'sampleStride',
    options.sampleStride ?? DEFAULT_GRID_STEP,
  )
  const coarseGrid = createCoarseGrid(noise, normalizedOptions, sampleStride)
  return interpolateGrid(coarseGrid, normalizedOptions, sampleStride)
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
