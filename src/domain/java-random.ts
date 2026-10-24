import { Brand, Result } from 'effect'

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
const JAVA_INT_MIN = -2_147_483_648
const JAVA_INT_MAX = 2147483647

export type JavaRandomBound = number & Brand.Brand<'JavaRandomBound'>
export const JavaRandomBound: Brand.Constructor<JavaRandomBound> = Brand.make<JavaRandomBound>(
  (value) =>
    (Number.isSafeInteger(value) && value > INTEGER_ZERO && value <= JAVA_INT_MAX) ||
    'bound must be a positive signed 32-bit integer',
)

export type JavaRandomInteger = number & Brand.Brand<'JavaRandomInteger'>
export const JavaRandomInteger: Brand.Constructor<JavaRandomInteger> = Brand.make<JavaRandomInteger>(
  (value) =>
    (Number.isSafeInteger(value) && value >= JAVA_INT_MIN && value <= JAVA_INT_MAX) ||
    'Java random output must be a signed 32-bit integer',
)

export type JavaRandomDouble = number & Brand.Brand<'JavaRandomDouble'>
export const JavaRandomDouble: Brand.Constructor<JavaRandomDouble> = Brand.make<JavaRandomDouble>(
  (value) => (Number.isFinite(value) && value >= INTEGER_ZERO && value < INTEGER_ONE) || 'Java random output must be in [0, 1)',
)

export type JavaSkipCount = number & Brand.Brand<'JavaSkipCount'>
export const JavaSkipCount: Brand.Constructor<JavaSkipCount> = Brand.make<JavaSkipCount>(
  (value) => Number.isSafeInteger(value) || 'skip count must be a safe integer',
)

export type JavaRandom = Readonly<{
  readonly nextInt: {
    (): JavaRandomInteger
    (bound: JavaRandomBound | undefined): Result.Result<JavaRandomInteger, RangeError | TypeError>
  }
  readonly nextDouble: () => JavaRandomDouble
  readonly skip: (count: JavaSkipCount) => void
}>

type NextBits = (bits: number) => number

const makeJavaRandomInteger = (value: number): Result.Result<JavaRandomInteger, RangeError> => {
  const integer = JavaRandomInteger.result(value)
  if (Result.isFailure(integer)) {
    return Result.fail(new RangeError('Java random output must be a signed 32-bit integer'))
  }
  return Result.succeed(integer.success)
}

export const nextJavaInt = (
  bound: JavaRandomBound,
  nextBits: NextBits,
): Result.Result<JavaRandomInteger, RangeError> => {
  if ((bound & (bound - INTEGER_ONE)) === INTEGER_ZERO) {
    const value = Number(
      (BigInt(bound) * BigInt(nextBits(JAVA_RANDOM_INTEGER_BITS))) >>
        BigInt(JAVA_RANDOM_INTEGER_BITS),
    )
    return makeJavaRandomInteger(value)
  }
  let bits = nextBits(JAVA_RANDOM_INTEGER_BITS)
  let value = bits % bound
  while (
    ((bits - value + bound - INTEGER_ONE) | INTEGER_ZERO) < INTEGER_ZERO
  ) {
    bits = nextBits(JAVA_RANDOM_INTEGER_BITS)
    value = bits % bound
  }
  return makeJavaRandomInteger(value)
}

export const createJavaRandom = (seed: bigint): Result.Result<JavaRandom, TypeError> => {
  if (typeof seed !== 'bigint') {
    return Result.fail(new TypeError('seed must be a bigint'))
  }

  let state = (seed ^ JAVA_RANDOM_MULTIPLIER) & JAVA_RANDOM_MASK

  const nextBits = (bits: number): number => {
    state =
      (state * JAVA_RANDOM_MULTIPLIER + JAVA_RANDOM_INCREMENT) &
      JAVA_RANDOM_MASK
    return Number(state >> BigInt(JAVA_RANDOM_STATE_BITS - bits))
  }

  function nextInt(): JavaRandomInteger
  function nextInt(
    bound: JavaRandomBound | undefined,
  ): Result.Result<JavaRandomInteger, RangeError | TypeError>
  function nextInt(
    bound?: JavaRandomBound,
  ): JavaRandomInteger | Result.Result<JavaRandomInteger, RangeError | TypeError> {
    if (arguments.length > INTEGER_ZERO) {
      if (typeof bound === 'undefined') {
        return Result.fail(new TypeError('bound must be a JavaRandomBound'))
      }
      return nextJavaInt(bound, nextBits)
    }
    return JavaRandomInteger(nextBits(JAVA_RANDOM_UNBOUNDED_BITS) | INTEGER_ZERO)
  }

  const nextDouble = (): JavaRandomDouble =>
    JavaRandomDouble(
      (nextBits(JAVA_RANDOM_DOUBLE_HIGH_BITS) *
        JAVA_RANDOM_DOUBLE_RADIX ** JAVA_RANDOM_DOUBLE_LOW_BITS +
        nextBits(JAVA_RANDOM_DOUBLE_LOW_BITS)) /
        JAVA_RANDOM_DOUBLE_RADIX ** JAVA_RANDOM_DOUBLE_BITS,
    )

  const skip = (count: JavaSkipCount): void => {
    for (let index = INTEGER_ZERO; index < count; index += INTEGER_ONE) {
      nextInt()
    }
  }

  return Result.succeed(Object.freeze({ nextDouble, nextInt, skip }))
}
