import { Brand, Result } from 'effect'
import { requireFinite, requirePositiveFinite, requirePositiveInteger } from './number-validation.js'
import type { NoiseFn2D } from './perlin.js'

/** The boundary a value must exceed to count positive in `requirePositiveInteger`/`requirePositiveFinite`. */
const POSITIVE_BOUNDARY = 0
/** Default grid origin when `originX`/`originZ` is omitted: the coordinate space's zero point. */
const DEFAULT_GRID_ORIGIN = 0
/** The amount each loop index advances per iteration. */
const LOOP_STEP = 1
const FLOAT32_BYTES = Float32Array.BYTES_PER_ELEMENT
const FLOAT32_LITTLE_ENDIAN = true

const withDefault = <Value>(value: Value | undefined, fallback: Value): Value => {
  if (typeof value === 'undefined') {
    return fallback
  }
  return value
}

export type NoisePoint2D = Readonly<{
  readonly x: number
  readonly z: number
}>

export type GridDimension = number & Brand.Brand<'GridDimension'>
export const GridDimension: Brand.Constructor<GridDimension> = Brand.make<GridDimension>(
  (value) => (Number.isSafeInteger(value) && value > POSITIVE_BOUNDARY) || 'grid dimension must be a positive safe integer',
)

export type GridStep = number & Brand.Brand<'GridStep'>
export const GridStep: Brand.Constructor<GridStep> = Brand.make<GridStep>(
  (value) => (Number.isFinite(value) && value > POSITIVE_BOUNDARY) || 'grid step must be positive and finite',
)

/** Default grid step when `stepX`/`stepZ` is omitted: one noise sample per grid cell. */
const DEFAULT_GRID_STEP: GridStep = GridStep(LOOP_STEP)

export type SampleStride = number & Brand.Brand<'SampleStride'>
export const SampleStride: Brand.Constructor<SampleStride> = Brand.make<SampleStride>(
  (value) => (Number.isSafeInteger(value) && value > POSITIVE_BOUNDARY) || 'sample stride must be a positive safe integer',
)

const DEFAULT_SAMPLE_STRIDE: SampleStride = SampleStride(LOOP_STEP)

export type NoiseGrid2DOptions = Readonly<{
  readonly width: GridDimension
  readonly depth: GridDimension
  readonly originX?: number
  readonly originZ?: number
  readonly stepX?: GridStep
  readonly stepZ?: GridStep
}>

type NormalizedNoiseGrid2DOptions = Readonly<{
  readonly width: GridDimension
  readonly depth: GridDimension
  readonly originX: number
  readonly originZ: number
  readonly stepX: GridStep
  readonly stepZ: GridStep
}>

const requireGridDimension = (value: GridDimension, name: string): Result.Result<GridDimension, RangeError> =>
  Result.map(
    requirePositiveInteger(value, () => `${name} must be a positive safe integer, received ${String(value)}`),
    GridDimension,
  )

const requireGridOrigin = (value: number | undefined, name: string): Result.Result<number, RangeError> => {
  const origin = withDefault(value, DEFAULT_GRID_ORIGIN)
  return requireFinite(origin, () => `${name} must be finite, received ${String(origin)}`)
}

const requireGridStep = (value: GridStep | undefined, name: string): Result.Result<GridStep, RangeError> => {
  const step = withDefault(value, DEFAULT_GRID_STEP)
  return Result.map(
    requirePositiveFinite(step, () => `${name} must be positive and finite, received ${String(step)}`),
    GridStep,
  )
}

const normalizeGridOptions = (
  options: NoiseGrid2DOptions,
): Result.Result<NormalizedNoiseGrid2DOptions, RangeError> =>
  Result.gen(function* normalizeGridOptionsResult() {
    const width = yield* requireGridDimension(options.width, 'width')
    const depth = yield* requireGridDimension(options.depth, 'depth')
    const originX = yield* requireGridOrigin(options.originX, 'originX')
    const originZ = yield* requireGridOrigin(options.originZ, 'originZ')
    const stepX = yield* requireGridStep(options.stepX, 'stepX')
    const stepZ = yield* requireGridStep(options.stepZ, 'stepZ')
    return { depth, originX, originZ, stepX, stepZ, width }
  })

export const sampleNoise2DBatch = (
  noise: NoiseFn2D,
  points: ReadonlyArray<NoisePoint2D>,
): Result.Result<Float32Array, RangeError> =>
  Result.gen(function* sampleNoise2DBatchResult() {
    const samples = new Float32Array(points.length)
    for (let index = 0; index < points.length; index += LOOP_STEP) {
      const point = points[index]
      if (!point) {
        return yield* Result.fail(new RangeError(`points[${index}] is missing`))
      }
      const x = yield* requireFinite(point.x, () => `point.x must be finite, received ${point.x}`)
      const z = yield* requireFinite(point.z, () => `point.z must be finite, received ${point.z}`)
      samples[index] = noise(x, z)
    }
    return samples
  })

export type NoiseInterpolatedGridOptions = Readonly<
  NoiseGrid2DOptions & {
    readonly sampleStride?: SampleStride
  }
>

type CoarseNoiseGrid = Readonly<{
  readonly samples: DataView
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
  readonly sampleStride: SampleStride
  readonly coarseWidth: number
  readonly rowIndex: number
  readonly samples: DataView
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
    samples.setFloat32((rowIndex * coarseWidth + xIndex) * FLOAT32_BYTES, noise(x, z), FLOAT32_LITTLE_ENDIAN)
  }
}

const createCoarseGrid = (
  noise: NoiseFn2D,
  options: NormalizedNoiseGrid2DOptions,
  sampleStride: SampleStride,
): CoarseNoiseGrid => {
  const width = Math.ceil((options.width - LOOP_STEP) / sampleStride) + LOOP_STEP
  const depth = Math.ceil((options.depth - LOOP_STEP) / sampleStride) + LOOP_STEP
  const samples = new DataView(new ArrayBuffer(width * depth * FLOAT32_BYTES))

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
  sampleStride: SampleStride,
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
  const topLeft = coarseGrid.samples.getFloat32(
    (zAxis.cellIndex * coarseGrid.width + xAxis.cellIndex) * FLOAT32_BYTES,
    FLOAT32_LITTLE_ENDIAN,
  )
  const topRight = coarseGrid.samples.getFloat32(
    (zAxis.cellIndex * coarseGrid.width + xAxis.nextCellIndex) * FLOAT32_BYTES,
    FLOAT32_LITTLE_ENDIAN,
  )
  const bottomLeft = coarseGrid.samples.getFloat32(
    (zAxis.nextCellIndex * coarseGrid.width + xAxis.cellIndex) * FLOAT32_BYTES,
    FLOAT32_LITTLE_ENDIAN,
  )
  const bottomRight = coarseGrid.samples.getFloat32(
    (zAxis.nextCellIndex * coarseGrid.width + xAxis.nextCellIndex) * FLOAT32_BYTES,
    FLOAT32_LITTLE_ENDIAN,
  )
  const top = interpolateLinear(topLeft, topRight, xAxis.weight)
  const bottom = interpolateLinear(bottomLeft, bottomRight, xAxis.weight)
  return interpolateLinear(top, bottom, zAxis.weight)
}

const interpolateGrid = (
  coarseGrid: CoarseNoiseGrid,
  options: NormalizedNoiseGrid2DOptions,
  sampleStride: SampleStride,
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
      samples[zIndex * options.width + xIndex] = interpolateCoarseCell(coarseGrid, xAxis, zAxis)
    }
  }
  return samples
}

export const sampleNoise2DInterpolatedGrid = (
  noise: NoiseFn2D,
  options: NoiseInterpolatedGridOptions,
): Result.Result<Float32Array, RangeError> => {
  const normalizedOptions = normalizeGridOptions(options)
  if (Result.isFailure(normalizedOptions)) {
    return Result.fail(normalizedOptions.failure)
  }
  const sampleStrideValue = withDefault(options.sampleStride, DEFAULT_SAMPLE_STRIDE)
  const sampleStride = requirePositiveInteger(sampleStrideValue, () =>
    `sampleStride must be a positive safe integer, received ${String(sampleStrideValue)}`,
  )
  if (Result.isFailure(sampleStride)) {
    return Result.fail(sampleStride.failure)
  }
  const normalizedStride = SampleStride(sampleStride.success)
  const coarseGrid = createCoarseGrid(noise, normalizedOptions.success, normalizedStride)
  return Result.succeed(interpolateGrid(coarseGrid, normalizedOptions.success, normalizedStride))
}

const sampleNoiseGrid = (
  noise: NoiseFn2D,
  { depth, originX, originZ, stepX, stepZ, width }: NormalizedNoiseGrid2DOptions,
): Float32Array => {
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

export const sampleNoise2DGrid = (
  noise: NoiseFn2D,
  options: NoiseGrid2DOptions,
): Result.Result<Float32Array, RangeError> =>
  Result.map(normalizeGridOptions(options), (normalizedOptions) =>
    sampleNoiseGrid(noise, normalizedOptions),
  )
