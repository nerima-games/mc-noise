import {
  GRID_LOOP_STEP,
  type NoiseGrid3DOptions,
  type NormalizedNoiseGrid3DOptions,
  normalizeNoiseGrid3DOptions,
} from './sampling-3d-grid.js'
import type { NoiseFn3D } from './perlin.js'
import { requirePositiveInteger } from './number-validation.js'

const DEFAULT_SAMPLE_STRIDE = 1
const POSITIVE_BOUNDARY = 0

export type NoiseInterpolatedGrid3DOptions = Readonly<
  NoiseGrid3DOptions & {
    readonly sampleStrideX?: number
    readonly sampleStrideY?: number
    readonly sampleStrideZ?: number
  }
>

type InterpolationAxis = Readonly<{
  readonly lowerIndex: number
  readonly upperIndex: number
  readonly amount: number
}>

type NormalizedInterpolationStrides = Readonly<{
  readonly sampleStrideX: number
  readonly sampleStrideY: number
  readonly sampleStrideZ: number
}>

type CoarseNoiseGrid3D = Readonly<{
  readonly depth: number
  readonly height: number
  readonly samples: Float32Array
  readonly width: number
}>

const normalizeInterpolationStrides = (
  options: NoiseInterpolatedGrid3DOptions,
): NormalizedInterpolationStrides => ({
  sampleStrideX: requirePositiveInteger('sampleStrideX', options.sampleStrideX ?? DEFAULT_SAMPLE_STRIDE),
  sampleStrideY: requirePositiveInteger('sampleStrideY', options.sampleStrideY ?? DEFAULT_SAMPLE_STRIDE),
  sampleStrideZ: requirePositiveInteger('sampleStrideZ', options.sampleStrideZ ?? DEFAULT_SAMPLE_STRIDE),
})

const coarseGridLength = (length: number, stride: number): number =>
  Math.ceil((length - GRID_LOOP_STEP) / stride) + GRID_LOOP_STEP

type GridDimensions = Readonly<{
  readonly depth: number
  readonly height: number
}>

const coarseSampleIndex = (
  xIndex: number,
  zIndex: number,
  yIndex: number,
  dimensions: GridDimensions,
): number => (xIndex * dimensions.depth + zIndex) * dimensions.height + yIndex

type CoarseSamplingContext = Readonly<{
  readonly depth: number
  readonly dimensions: GridDimensions
  readonly height: number
  readonly noise: NoiseFn3D
  readonly options: NormalizedNoiseGrid3DOptions
  readonly strides: NormalizedInterpolationStrides
  readonly width: number
}>

type CoarseSample = Readonly<{
  readonly index: number
  readonly value: number
}>

const sampleCoarseNoiseAt = (
  context: CoarseSamplingContext,
  xIndex: number,
  zIndex: number,
  yIndex: number,
): CoarseSample => {
  const sourceXIndex = Math.min(xIndex * context.strides.sampleStrideX, context.options.width - GRID_LOOP_STEP)
  const x = context.options.originX + sourceXIndex * context.options.stepX
  const sourceZIndex = Math.min(zIndex * context.strides.sampleStrideZ, context.options.depth - GRID_LOOP_STEP)
  const z = context.options.originZ + sourceZIndex * context.options.stepZ
  const sourceYIndex = Math.min(yIndex * context.strides.sampleStrideY, context.options.height - GRID_LOOP_STEP)
  const y = context.options.originY + sourceYIndex * context.options.stepY
  const index = coarseSampleIndex(xIndex, zIndex, yIndex, context.dimensions)

  return { index, value: context.noise(x, y, z) }
}

const fillCoarseNoiseGrid = (samples: Float32Array, context: CoarseSamplingContext): void => {
  for (let xIndex = 0; xIndex < context.width; xIndex += GRID_LOOP_STEP) {
    for (let zIndex = 0; zIndex < context.depth; zIndex += GRID_LOOP_STEP) {
      for (let yIndex = 0; yIndex < context.height; yIndex += GRID_LOOP_STEP) {
        const sample = sampleCoarseNoiseAt(context, xIndex, zIndex, yIndex)
        samples[sample.index] = sample.value
      }
    }
  }
}

const sampleCoarseNoiseGrid3D = (
  noise: NoiseFn3D,
  options: NormalizedNoiseGrid3DOptions,
  strides: NormalizedInterpolationStrides,
): CoarseNoiseGrid3D => {
  const width = coarseGridLength(options.width, strides.sampleStrideX)
  const depth = coarseGridLength(options.depth, strides.sampleStrideZ)
  const height = coarseGridLength(options.height, strides.sampleStrideY)
  const samples = new Float32Array(width * depth * height)
  const context = {
    depth,
    dimensions: { depth, height },
    height,
    noise,
    options,
    strides,
    width,
  }

  fillCoarseNoiseGrid(samples, context)
  return { depth, height, samples, width }
}

const createInterpolationAxis = (index: number, maxIndex: number, stride: number): InterpolationAxis => {
  const lowerIndex = Math.floor(index / stride)
  const upperIndex = Math.min(lowerIndex + GRID_LOOP_STEP, Math.ceil(maxIndex / stride))
  const lowerSourceIndex = lowerIndex * stride
  const upperSourceIndex = Math.min(upperIndex * stride, maxIndex)
  const sourceSpan = upperSourceIndex - lowerSourceIndex
  let amount = POSITIVE_BOUNDARY

  if (sourceSpan !== POSITIVE_BOUNDARY) {
    amount = (index - lowerSourceIndex) / sourceSpan
  }

  return { amount, lowerIndex, upperIndex }
}

const interpolate = (lower: number, upper: number, amount: number): number =>
  lower + (upper - lower) * amount

const readCoarseSample = (grid: CoarseNoiseGrid3D, xIndex: number, zIndex: number, yIndex: number): number =>
  grid.samples[coarseSampleIndex(xIndex, zIndex, yIndex, { depth: grid.depth, height: grid.height })]!

const interpolateAtY = (
  grid: CoarseNoiseGrid3D,
  xIndex: number,
  zIndex: number,
  yAxis: InterpolationAxis,
): number =>
  interpolate(
    readCoarseSample(grid, xIndex, zIndex, yAxis.lowerIndex),
    readCoarseSample(grid, xIndex, zIndex, yAxis.upperIndex),
    yAxis.amount,
  )

type CellInterpolationContext = Readonly<{
  readonly grid: CoarseNoiseGrid3D
  readonly xAxis: InterpolationAxis
  readonly yAxis: InterpolationAxis
  readonly zAxis: InterpolationAxis
}>

const interpolateAtZ = (context: CellInterpolationContext, xIndex: number): number => {
  const lowerYAtLowerZ = interpolateAtY(
    context.grid,
    xIndex,
    context.zAxis.lowerIndex,
    context.yAxis,
  )
  const lowerYAtUpperZ = interpolateAtY(
    context.grid,
    xIndex,
    context.zAxis.upperIndex,
    context.yAxis,
  )

  return interpolate(lowerYAtLowerZ, lowerYAtUpperZ, context.zAxis.amount)
}

const interpolateNoiseCell3D = (
  grid: CoarseNoiseGrid3D,
  xAxis: InterpolationAxis,
  yAxis: InterpolationAxis,
  zAxis: InterpolationAxis,
): number => {
  const context = { grid, xAxis, yAxis, zAxis }
  const lowerZAtLowerX = interpolateAtZ(context, xAxis.lowerIndex)
  const lowerZAtUpperX = interpolateAtZ(context, xAxis.upperIndex)

  return interpolate(lowerZAtLowerX, lowerZAtUpperX, xAxis.amount)
}

type InterpolatedSamplingContext = Readonly<{
  readonly coarseGrid: CoarseNoiseGrid3D
  readonly dimensions: GridDimensions
  readonly options: NormalizedNoiseGrid3DOptions
  readonly samples: Float32Array
  readonly strides: NormalizedInterpolationStrides
}>

const interpolateNoiseAt = (
  context: InterpolatedSamplingContext,
  xIndex: number,
  zIndex: number,
  yIndex: number,
): number => {
  const xAxis = createInterpolationAxis(xIndex, context.options.width - GRID_LOOP_STEP, context.strides.sampleStrideX)
  const zAxis = createInterpolationAxis(zIndex, context.options.depth - GRID_LOOP_STEP, context.strides.sampleStrideZ)
  const yAxis = createInterpolationAxis(yIndex, context.options.height - GRID_LOOP_STEP, context.strides.sampleStrideY)

  return interpolateNoiseCell3D(context.coarseGrid, xAxis, yAxis, zAxis)
}

const fillInterpolatedNoiseGrid = (context: InterpolatedSamplingContext): void => {
  for (let xIndex = 0; xIndex < context.options.width; xIndex += GRID_LOOP_STEP) {
    for (let zIndex = 0; zIndex < context.options.depth; zIndex += GRID_LOOP_STEP) {
      for (let yIndex = 0; yIndex < context.options.height; yIndex += GRID_LOOP_STEP) {
        const index = coarseSampleIndex(xIndex, zIndex, yIndex, context.dimensions)
        context.samples[index] = interpolateNoiseAt(context, xIndex, zIndex, yIndex)
      }
    }
  }
}

export const sampleNoise3DInterpolatedGrid = (
  noise: NoiseFn3D,
  options: NoiseInterpolatedGrid3DOptions,
): Float32Array => {
  const normalizedOptions = normalizeNoiseGrid3DOptions(options)
  const strides = normalizeInterpolationStrides(options)
  const coarseGrid = sampleCoarseNoiseGrid3D(noise, normalizedOptions, strides)
  const samples = new Float32Array(normalizedOptions.width * normalizedOptions.depth * normalizedOptions.height)
  const context = {
    coarseGrid,
    dimensions: { depth: normalizedOptions.depth, height: normalizedOptions.height },
    options: normalizedOptions,
    samples,
    strides,
  }

  fillInterpolatedNoiseGrid(context)
  return samples
}
