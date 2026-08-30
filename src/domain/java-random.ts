const JAVA_RANDOM_MULTIPLIER = 25214903917n
const JAVA_RANDOM_INCREMENT = 11n
const JAVA_RANDOM_STATE_BITS = 48
const JAVA_RANDOM_INTEGER_BITS = 31
const JAVA_RANDOM_UNBOUNDED_BITS = 32
const JAVA_RANDOM_DOUBLE_HIGH_BITS = 26
const JAVA_RANDOM_DOUBLE_LOW_BITS = 27
const JAVA_RANDOM_DOUBLE_RADIX = 2
const JAVA_RANDOM_DOUBLE_BITS = 53
const INTEGER_ZERO = 0
const INTEGER_ONE = 1
const BIG_INTEGER_ONE = 1n
const JAVA_RANDOM_MASK =
  (BIG_INTEGER_ONE << BigInt(JAVA_RANDOM_STATE_BITS)) - BIG_INTEGER_ONE
const JAVA_INT_MAX = 2147483647

export type JavaRandom = Readonly<{
  readonly nextInt: (bound?: number) => number
  readonly nextDouble: () => number
  readonly skip: (count: number) => void
}>

type NextBits = (bits: number) => number

export const nextJavaInt = (bound: number, nextBits: NextBits): number => {
  if (!Number.isInteger(bound) || bound <= INTEGER_ZERO || bound > JAVA_INT_MAX) {
    throw new RangeError(`bound must be a positive signed 32-bit integer, received ${bound}`)
  }
  if ((bound & (bound - INTEGER_ONE)) === INTEGER_ZERO) {
    return Number(
      (BigInt(bound) * BigInt(nextBits(JAVA_RANDOM_INTEGER_BITS))) >>
        BigInt(JAVA_RANDOM_INTEGER_BITS),
    )
  }
  let bits = nextBits(JAVA_RANDOM_INTEGER_BITS)
  let value = bits % bound
  while (
    ((bits - value + bound - INTEGER_ONE) | INTEGER_ZERO) < INTEGER_ZERO
  ) {
    bits = nextBits(JAVA_RANDOM_INTEGER_BITS)
    value = bits % bound
  }
  return value
}

export const createJavaRandom = (seed: bigint): JavaRandom => {
  if (typeof seed !== 'bigint') {
    throw new TypeError('seed must be a bigint')
  }

  let state = (seed ^ JAVA_RANDOM_MULTIPLIER) & JAVA_RANDOM_MASK

  const nextBits = (bits: number): number => {
    state =
      (state * JAVA_RANDOM_MULTIPLIER + JAVA_RANDOM_INCREMENT) &
      JAVA_RANDOM_MASK
    return Number(state >> BigInt(JAVA_RANDOM_STATE_BITS - bits))
  }

  const nextInt = function nextInt(bound?: number): number {
    if (arguments.length > INTEGER_ZERO) {
      return nextJavaInt(bound as number, nextBits)
    }
    return nextBits(JAVA_RANDOM_UNBOUNDED_BITS) | INTEGER_ZERO
  }

  const nextDouble = (): number =>
    (nextBits(JAVA_RANDOM_DOUBLE_HIGH_BITS) *
      JAVA_RANDOM_DOUBLE_RADIX ** JAVA_RANDOM_DOUBLE_LOW_BITS +
      nextBits(JAVA_RANDOM_DOUBLE_LOW_BITS)) /
    JAVA_RANDOM_DOUBLE_RADIX ** JAVA_RANDOM_DOUBLE_BITS

  const skip = (count: number): void => {
    for (let index = INTEGER_ZERO; index < count; index += INTEGER_ONE) {
      nextInt()
    }
  }

  return Object.freeze({ nextDouble, nextInt, skip })
}