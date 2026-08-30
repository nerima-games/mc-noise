import { type JavaRandom, createJavaRandom } from './java-random.js'
import { requireSafeInteger } from './number-validation.js'

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
const SIMPLEX_GRADIENTS: readonly (readonly [number, number])[] = [
  [SIMPLEX_ONE, SIMPLEX_ONE],
  [SIMPLEX_NEGATIVE_ONE, SIMPLEX_ONE],
  [SIMPLEX_ONE, SIMPLEX_NEGATIVE_ONE],
  [SIMPLEX_NEGATIVE_ONE, SIMPLEX_NEGATIVE_ONE],
  [SIMPLEX_ONE, SIMPLEX_ZERO],
  [SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO],
  [SIMPLEX_ONE, SIMPLEX_ZERO],
  [SIMPLEX_NEGATIVE_ONE, SIMPLEX_ZERO],
  [SIMPLEX_ZERO, SIMPLEX_ONE],
  [SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE],
  [SIMPLEX_ZERO, SIMPLEX_ONE],
  [SIMPLEX_ZERO, SIMPLEX_NEGATIVE_ONE],
]
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
const JAVA_INT_MIN = -2147483648
const JAVA_INT_MAX = 2147483647

export const END_ISLANDS_MIN_VALUE = -0.84375
export const END_ISLANDS_MAX_VALUE = 0.5625

export type EndIslandsSampler = Readonly<{
  readonly sample: (x: number, z: number) => number
}>

type Simplex2D = (x: number, y: number) => number

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

const shufflePermutation = (permutation: Uint8Array, random: JavaRandom): void => {
  for (let index = SIMPLEX_ZERO; index < permutation.length; index += SIMPLEX_ONE) {
    const swapOffset = random.nextInt(permutation.length - index)
    const swapIndex = index + swapOffset
    const current = permutation[index]!
    permutation[index] = permutation[swapIndex]!
    permutation[swapIndex] = current
  }
}

const createPermutation = (random: JavaRandom): Uint8Array => {
  random.nextDouble()
  random.nextDouble()
  random.nextDouble()
  const permutation = initializePermutation()
  shufflePermutation(permutation, random)
  return permutation
}

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

const createSimplex2D = (random: JavaRandom): Simplex2D => {
  const permutation = createPermutation(random)
  const permutationAt = (index: number): number =>
    permutation[index & SIMPLEX_PERMUTATION_MASK]!
  const gradientIndex = (x: number, y: number): number =>
    permutationAt((x & SIMPLEX_PERMUTATION_MASK) + permutationAt(y & SIMPLEX_PERMUTATION_MASK)) %
    SIMPLEX_GRADIENTS.length

  const contribution = (index: number, x: number, y: number): number => {
    let attenuation =
      SIMPLEX_ATTENUATION_START - x * x - y * y
    if (attenuation < SIMPLEX_ZERO) {
      return SIMPLEX_ZERO
    }
    attenuation *= attenuation
    const gradient = SIMPLEX_GRADIENTS[index]!
    return (
      attenuation *
      attenuation *
      (gradient[SIMPLEX_ZERO] * x + gradient[SIMPLEX_ONE] * y)
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
}

const requireJavaInt = (name: string, value: number): number => {
  requireSafeInteger(name, value)
  if (value < JAVA_INT_MIN || value > JAVA_INT_MAX) {
    throw new RangeError(`${name} must be a signed 32-bit integer, received ${value}`)
  }
  return value
}

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

export const createEndIslandsSampler = (seed: bigint): EndIslandsSampler => {
  const random = createJavaRandom(seed)
  random.skip(END_ISLANDS_SKIP_COUNT)
  const simplex = createSimplex2D(random)

  const sample = (x: number, z: number): number => {
    requireJavaInt('x', x)
    requireJavaInt('z', z)
    return floatDivide(
      floatSubtract(sampleIslands(simplex, x, z), END_ISLANDS_NORMALIZATION_OFFSET),
      END_ISLANDS_NORMALIZATION_SCALE,
    )
  }

  return Object.freeze({ sample })
}
