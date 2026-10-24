import {
  type JavaRandom,
  JavaRandomBound,
  JavaSkipCount,
  createJavaRandom,
} from './java-random.js'
import { BlockAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { BoundedNoise } from './noise-primitives.js'
import type { DensityFunctionResult } from './density-function-types.js'
import { Result } from 'effect'

const SIMPLEX_ZERO = 0
const SIMPLEX_ONE = 1
const SIMPLEX_TWO = 2
const SIMPLEX_THREE = 3
const SIMPLEX_SIX = 6
const SIMPLEX_HALF = 0.5
const SIMPLEX_NEGATIVE_ONE = -SIMPLEX_ONE
const SIMPLEX_SKEW =
  SIMPLEX_HALF * (Math.sqrt(SIMPLEX_THREE) - SIMPLEX_ONE)
const SIMPLEX_UNSKEW =
  (SIMPLEX_THREE - Math.sqrt(SIMPLEX_THREE)) / SIMPLEX_SIX
const SIMPLEX_PERMUTATION_SIZE = 256
const SIMPLEX_PERMUTATION_MASK =
  SIMPLEX_PERMUTATION_SIZE - SIMPLEX_ONE
const SIMPLEX_ATTENUATION_START = SIMPLEX_HALF
const SIMPLEX_AMPLITUDE = 70
const END_ISLANDS_SKIP_COUNT = 17292
const END_ISLANDS_MIN = -100
const END_ISLANDS_MAX = 80
const END_ISLANDS_NORMALIZATION_OFFSET = 8
const END_ISLANDS_NORMALIZATION_SCALE = 128
const END_ISLANDS_CELL_SIZE = 2
const END_ISLANDS_SEARCH_RADIUS = 12
const END_ISLANDS_ISLAND_THRESHOLD = -0.8999999761581421
const END_ISLANDS_CENTER_RADIUS_SQUARED = 4096
const END_ISLANDS_DISTANCE_BASE = 100
const END_ISLANDS_DISTANCE_SCALE = 8
const END_ISLANDS_RANDOM_X_MULTIPLIER = 3439
const END_ISLANDS_RANDOM_Z_MULTIPLIER = 147
const END_ISLANDS_RANDOM_MODULUS = 13
const END_ISLANDS_RANDOM_OFFSET = 9

const END_ISLANDS_LOWEST_NOISE_VALUE = -0.84375
const END_ISLANDS_HIGHEST_NOISE_VALUE = 0.5625
export const END_ISLANDS_MIN_VALUE: BoundedNoise = BoundedNoise(END_ISLANDS_LOWEST_NOISE_VALUE)
export const END_ISLANDS_MAX_VALUE: BoundedNoise = BoundedNoise(END_ISLANDS_HIGHEST_NOISE_VALUE)

export type EndIslandsSampler = Readonly<{
  readonly sample: (x: BlockAxis, z: BlockAxis) => DensityFunctionResult<BoundedNoise>
}>

type Simplex2D = (x: number, y: number) => number

const SIMPLEX_GRADIENT_COUNT = 12
const SIMPLEX_GRADIENTS = new Int8Array([
  SIMPLEX_ONE, SIMPLEX_ONE,
  SIMPLEX_NEGATIVE_ONE, SIMPLEX_ONE,
  SIMPLEX_ONE, SIMPLEX_NEGATIVE_ONE,
  SIMPLEX_NEGATIVE_ONE, SIMPLEX_NEGATIVE_ONE,
  SIMPLEX_ONE, SIMPLEX_ZERO,
  SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO,
  SIMPLEX_ONE, SIMPLEX_ZERO,
  SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO,
  SIMPLEX_ZERO, SIMPLEX_ONE,
  SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE,
  SIMPLEX_ZERO, SIMPLEX_ONE,
  SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE,
])

const toFloat = (value: number): number => Math.fround(value)

const floatAdd = (left: number, right: number): number =>
  toFloat(toFloat(left) + toFloat(right))

const floatSubtract = (left: number, right: number): number =>
  toFloat(toFloat(left) - toFloat(right))

const floatMultiply = (left: number, right: number): number =>
  toFloat(toFloat(left) * toFloat(right))

const floatDivide = (left: number, right: number): number =>
  toFloat(toFloat(left) / toFloat(right))

const floatAbs = (value: number): number => toFloat(Math.abs(toFloat(value)))

const floatSqrt = (value: number): number => toFloat(Math.sqrt(toFloat(value)))

const floatRemainder = (left: number, right: number): number =>
  toFloat(toFloat(left) % toFloat(right))

const clampFloat = (value: number, min: number, max: number): number =>
  toFloat(Math.min(toFloat(max), Math.max(toFloat(min), toFloat(value))))

type SimplexCoordinates = Readonly<{
  readonly cellX: number
  readonly cellY: number
  readonly localX: number
  readonly localY: number
}>

const initializePermutation = (): Uint8Array => {
  const permutation = new Uint8Array(SIMPLEX_PERMUTATION_SIZE)
  for (let index = SIMPLEX_ZERO; index < permutation.length; index += SIMPLEX_ONE) {
    permutation[index] = index
  }
  return permutation
}

const shufflePermutation = (
  permutation: Uint8Array,
  random: JavaRandom,
): DensityFunctionResult<void> =>
  Result.gen(function* shufflePermutationResult() {
    const bytes = new DataView(permutation.buffer)
    for (let index = SIMPLEX_ZERO; index < permutation.length; index += SIMPLEX_ONE) {
      const swapOffset = yield* random.nextInt(
        JavaRandomBound(permutation.length - index),
      )
      const swapIndex = index + swapOffset
      // The loop index is in range, and nextInt returns an offset below the remaining length.
      const current = bytes.getUint8(index)
      const swapValue = bytes.getUint8(swapIndex)
      bytes.setUint8(index, swapValue)
      bytes.setUint8(swapIndex, current)
    }
  })

const createPermutation = (
  random: JavaRandom,
): DensityFunctionResult<Uint8Array> =>
  Result.gen(function* createPermutationResult() {
    random.nextDouble()
    random.nextDouble()
    random.nextDouble()
    const permutation = initializePermutation()
    yield* shufflePermutation(permutation, random)
    return permutation
  })

const simplexCoordinates = (x: number, y: number): SimplexCoordinates => {
  const skew = (x + y) * SIMPLEX_SKEW
  const cellX = Math.floor(x + skew)
  const cellY = Math.floor(y + skew)
  const unskew = (cellX + cellY) * SIMPLEX_UNSKEW
  return {
    cellX,
    cellY,
    localX: x - (cellX - unskew),
    localY: y - (cellY - unskew),
  }
}

const firstOffsetFor = (
  localX: number,
  localY: number,
): readonly [number, number] => {
  if (localX > localY) {
    return [SIMPLEX_ONE, SIMPLEX_ZERO]
  }
  return [SIMPLEX_ZERO, SIMPLEX_ONE]
}

const createSimplex2D = (random: JavaRandom): DensityFunctionResult<Simplex2D> =>
  Result.map(createPermutation(random), (permutation) => {
    const permutationBytes = new DataView(permutation.buffer)
    const permutationAt = (index: number): number =>
      permutationBytes.getUint8(index & SIMPLEX_PERMUTATION_MASK)
    const gradientIndex = (x: number, y: number): number =>
      (permutationAt(x & SIMPLEX_PERMUTATION_MASK) +
        permutationAt(y & SIMPLEX_PERMUTATION_MASK)) %
      SIMPLEX_GRADIENT_COUNT

    const gradientBytes = new DataView(SIMPLEX_GRADIENTS.buffer)
    const contribution = (
      index: number,
      x: number,
      y: number,
    ): number => {
      let attenuation =
        SIMPLEX_ATTENUATION_START - x * x - y * y
      if (attenuation < SIMPLEX_ZERO) {
        return SIMPLEX_ZERO
      }
      attenuation *= attenuation
      const gradientOffset = Number(index) * SIMPLEX_TWO
      const gradientX = gradientBytes.getInt8(gradientOffset)
      const gradientY = gradientBytes.getInt8(gradientOffset + SIMPLEX_ONE)
      return (
        attenuation *
        attenuation *
        (gradientX * x + gradientY * y)
      )
    }

    const sampleSimplex = (x: number, y: number): number => {
      const { cellX, cellY, localX, localY } = simplexCoordinates(x, y)
      const [firstOffsetX, firstOffsetY] = firstOffsetFor(localX, localY)
      const secondX = localX - firstOffsetX + SIMPLEX_UNSKEW
      const secondY = localY - firstOffsetY + SIMPLEX_UNSKEW
      const thirdX =
        localX - SIMPLEX_ONE + SIMPLEX_TWO * SIMPLEX_UNSKEW
      const thirdY =
        localY - SIMPLEX_ONE + SIMPLEX_TWO * SIMPLEX_UNSKEW
      return (
        SIMPLEX_AMPLITUDE *
        (contribution(gradientIndex(cellX, cellY), localX, localY) +
          contribution(
            gradientIndex(cellX + firstOffsetX, cellY + firstOffsetY),
            secondX,
            secondY,
          ) +
          contribution(
            gradientIndex(cellX + SIMPLEX_ONE, cellY + SIMPLEX_ONE),
            thirdX,
            thirdY,
          ))
      )
    }

    return sampleSimplex
  })

const baseIslandValue = (x: number, z: number): number =>
  clampFloat(
    floatSubtract(
      END_ISLANDS_DISTANCE_BASE,
      floatMultiply(
        floatSqrt(x * x + z * z),
        END_ISLANDS_DISTANCE_SCALE,
      ),
    ),
    END_ISLANDS_MIN,
    END_ISLANDS_MAX,
  )

const islandRandomFactor = (islandX: number, islandZ: number): number =>
  floatAdd(
    floatRemainder(
      floatAdd(
        floatMultiply(
          floatAbs(islandX),
          END_ISLANDS_RANDOM_X_MULTIPLIER,
        ),
        floatMultiply(
          floatAbs(islandZ),
          END_ISLANDS_RANDOM_Z_MULTIPLIER,
        ),
      ),
      END_ISLANDS_RANDOM_MODULUS,
    ),
    END_ISLANDS_RANDOM_OFFSET,
  )

type IslandSampleContext = Readonly<{
  readonly simplex: Simplex2D
  readonly cellX: number
  readonly cellZ: number
  readonly localX: number
  readonly localZ: number
}>

const candidateIslandValue = (
  context: IslandSampleContext,
  offsetX: number,
  offsetZ: number,
): number => {
  const islandX = context.cellX + offsetX
  const islandZ = context.cellZ + offsetZ
  const randomFactor = islandRandomFactor(islandX, islandZ)
  const distanceX = toFloat(
    context.localX - offsetX * END_ISLANDS_CELL_SIZE,
  )
  const distanceZ = toFloat(
    context.localZ - offsetZ * END_ISLANDS_CELL_SIZE,
  )
  return clampFloat(
    floatSubtract(
      END_ISLANDS_DISTANCE_BASE,
      floatMultiply(
        floatSqrt(
          floatAdd(
            floatMultiply(distanceX, distanceX),
            floatMultiply(distanceZ, distanceZ),
          ),
        ),
        randomFactor,
      ),
    ),
    END_ISLANDS_MIN,
    END_ISLANDS_MAX,
  )
}

const isIslandCandidate = (
  context: IslandSampleContext,
  offsetX: number,
  offsetZ: number,
): boolean => {
  const islandX = context.cellX + offsetX
  const islandZ = context.cellZ + offsetZ
  return (
    islandX * islandX + islandZ * islandZ >
      END_ISLANDS_CENTER_RADIUS_SQUARED &&
    context.simplex(islandX, islandZ) < END_ISLANDS_ISLAND_THRESHOLD
  )
}

const considerIsland = (
  value: number,
  context: IslandSampleContext,
  offsetX: number,
  offsetZ: number,
): number => {
  if (!isIslandCandidate(context, offsetX, offsetZ)) {
    return value
  }
  return toFloat(
    Math.max(value, candidateIslandValue(context, offsetX, offsetZ)),
  )
}

const sampleOffsetRange = (
  value: number,
  context: IslandSampleContext,
  offsetX: number,
): number => {
  let sampledValue = value
  for (
    let offsetZ = -END_ISLANDS_SEARCH_RADIUS;
    offsetZ <= END_ISLANDS_SEARCH_RADIUS;
    offsetZ += SIMPLEX_ONE
  ) {
    sampledValue = considerIsland(sampledValue, context, offsetX, offsetZ)
  }
  return sampledValue
}

const sampleIslands = (simplex: Simplex2D, x: number, z: number): number => {
  const cellX = Math.trunc(x / END_ISLANDS_CELL_SIZE)
  const cellZ = Math.trunc(z / END_ISLANDS_CELL_SIZE)
  const localX = x - cellX * END_ISLANDS_CELL_SIZE
  const localZ = z - cellZ * END_ISLANDS_CELL_SIZE
  const context: IslandSampleContext = {
    cellX,
    cellZ,
    localX,
    localZ,
    simplex,
  }
  let value = baseIslandValue(x, z)

  for (
    let offsetX = -END_ISLANDS_SEARCH_RADIUS;
    offsetX <= END_ISLANDS_SEARCH_RADIUS;
    offsetX += SIMPLEX_ONE
  ) {
    value = sampleOffsetRange(value, context, offsetX)
  }

  return value
}

const readBlockAxis = (
  name: string,
  value: unknown,
): DensityFunctionResult<BlockAxis> => {
  if (typeof value !== 'number') {
    return Result.fail(new TypeError(`${name} must be a number`))
  }
  return Result.mapError(
    BlockAxis.result(value),
    (error) => new RangeError(error.message),
  )
}

export const createEndIslandsSampler = (
  seed: bigint,
): DensityFunctionResult<EndIslandsSampler> => {
  if (typeof seed !== 'bigint') {
    return Result.fail(new TypeError('seed must be a bigint'))
  }
  return Result.gen(function* createEndIslandsSamplerResult() {
    const random = yield* createJavaRandom(seed)
    random.skip(JavaSkipCount(END_ISLANDS_SKIP_COUNT))
    const simplex = yield* createSimplex2D(random)

    const sample = (x: BlockAxis, z: BlockAxis): DensityFunctionResult<BoundedNoise> =>
      Result.gen(function* sampleEndIslandsResult() {
        const normalizedX = yield* readBlockAxis('x', x)
        const normalizedZ = yield* readBlockAxis('z', z)
        const value = floatDivide(
          floatSubtract(
            sampleIslands(simplex, normalizedX, normalizedZ),
            END_ISLANDS_NORMALIZATION_OFFSET,
          ),
          END_ISLANDS_NORMALIZATION_SCALE,
        )
        // The clamped island range normalizes to values inside BoundedNoise's bounds.
        return BoundedNoise(value)
      })

    return Object.freeze({ sample })
  })
}
