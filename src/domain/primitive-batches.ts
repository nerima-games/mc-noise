import { DefinedValueName, requireDefined } from './defined.js'
import type { NoisePrimitives } from './noise-primitives.js'
import type { OctaveParameters } from './octaves.js'
import { PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { Result } from 'effect'
import { requireFiniteNumber } from './number-validation.js'

export type Point2D = readonly [x: PositionAxis, z: PositionAxis]

const BATCH_INDEX_STEP = 1
const NO_RESULT_VALUE: void = globalThis.undefined

type OctaveBatchArguments = readonly [
  primitives: NoisePrimitives,
  xs: readonly PositionAxis[],
  zs: readonly PositionAxis[],
  ...octaveArguments: OctaveParameters,
]

type OctavePointBatchArguments = readonly [
  primitives: NoisePrimitives,
  points: readonly Point2D[],
  ...octaveArguments: OctaveParameters,
]

const requirePositionAxis = (value: number | undefined, name: string): Result.Result<PositionAxis, RangeError> => {
  const defined = requireDefined(value, DefinedValueName(name))
  if (Result.isFailure(defined)) {
    return Result.fail(defined.failure)
  }
  const finite = requireFiniteNumber(defined.success, () => `${name} must be finite, received ${defined.success}`)
  if (Result.isFailure(finite)) {
    return Result.fail(finite.failure)
  }
  return Result.succeed(PositionAxis(finite.success))
}

const requirePoint = (points: readonly Point2D[], index: number): Result.Result<Point2D, RangeError> =>
  Result.gen(function* requirePointResult() {
    const [xValue, zValue] = yield* requireDefined(points[index], DefinedValueName(`points[${index}]`))
    const x = yield* requirePositionAxis(xValue, `points[${index}].x`)
    const z = yield* requirePositionAxis(zValue, `points[${index}].z`)
    return [x, z]
  })

const requireEqualLengths = (
  first: readonly PositionAxis[],
  ...rest: readonly (readonly PositionAxis[])[]
): Result.Result<void, RangeError> => {
  for (const values of rest) {
    if (values.length !== first.length) {
      return Result.fail(
        new RangeError(`coordinate arrays must have equal lengths, received ${first.length} and ${values.length}`),
      )
    }
  }
  return Result.succeed(NO_RESULT_VALUE)
}

export const noise2DBatchXY = (
  primitives: NoisePrimitives,
  xs: readonly PositionAxis[],
  zs: readonly PositionAxis[],
): Result.Result<ReadonlyArray<number>, RangeError> =>
  Result.gen(function* sampleNoise2DBatchXY() {
    yield* requireEqualLengths(xs, zs)
    const output = new Array<number>(xs.length)
    for (let index = 0; index < xs.length; index += BATCH_INDEX_STEP) {
      const x = yield* requirePositionAxis(xs[index], `xs[${index}]`)
      const z = yield* requirePositionAxis(zs[index], `zs[${index}]`)
      output[index] = primitives.noise2D(x, z)
    }
    return output
  })

export const octaveNoise2DBatchXY = (...args: OctaveBatchArguments): Result.Result<ReadonlyArray<number>, RangeError> => {
  const [primitives, xs, zs, octaves, persistence, lacunarity] = args
  return Result.gen(function* sampleOctaveNoise2DBatchXY() {
    yield* requireEqualLengths(xs, zs)
    const output = new Array<number>(xs.length)
    for (let index = 0; index < xs.length; index += BATCH_INDEX_STEP) {
      const x = yield* requirePositionAxis(xs[index], `xs[${index}]`)
      const z = yield* requirePositionAxis(zs[index], `zs[${index}]`)
      output[index] = yield* primitives.octaveNoise2D(
        x,
        z,
        octaves,
        persistence,
        lacunarity,
      )
    }
    return output
  })
}

export const noise3DBatchXYZ = (
  primitives: NoisePrimitives,
  xs: readonly PositionAxis[],
  ys: readonly PositionAxis[],
  zs: readonly PositionAxis[],
): Result.Result<ReadonlyArray<number>, RangeError> =>
  Result.gen(function* sampleNoise3DBatchXYZ() {
    yield* requireEqualLengths(xs, ys, zs)
    const output = new Array<number>(xs.length)
    for (let index = 0; index < xs.length; index += BATCH_INDEX_STEP) {
      const x = yield* requirePositionAxis(xs[index], `xs[${index}]`)
      const y = yield* requirePositionAxis(ys[index], `ys[${index}]`)
      const z = yield* requirePositionAxis(zs[index], `zs[${index}]`)
      output[index] = primitives.noise3D(x, y, z)
    }
    return output
  })

export const noise2DBatch = (
  primitives: NoisePrimitives,
  points: readonly Point2D[],
): Result.Result<ReadonlyArray<number>, RangeError> =>
  Result.gen(function* sampleNoise2DBatch() {
    const output = new Array<number>(points.length)
    for (let index = 0; index < points.length; index += BATCH_INDEX_STEP) {
      const [x, z] = yield* requirePoint(points, index)
      output[index] = primitives.noise2D(x, z)
    }
    return output
  })

export const octaveNoise2DBatch = (...args: OctavePointBatchArguments): Result.Result<ReadonlyArray<number>, RangeError> => {
  const [primitives, points, octaves, persistence, lacunarity] = args
  return Result.gen(function* sampleOctaveNoise2DBatch() {
    const output = new Array<number>(points.length)
    for (let index = 0; index < points.length; index += BATCH_INDEX_STEP) {
      const [x, z] = yield* requirePoint(points, index)
      output[index] = yield* primitives.octaveNoise2D(
        x,
        z,
        octaves,
        persistence,
        lacunarity,
      )
    }
    return output
  })
}
