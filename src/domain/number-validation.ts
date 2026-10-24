import { Result } from 'effect'

const POSITIVE_BOUNDARY = 0

export const requireFiniteNumber = <Value extends number>(
  value: Value,
  failure: () => string,
): Result.Result<Value, RangeError> => {
  if (!Number.isFinite(value)) {
    return Result.fail(new RangeError(failure()))
  }
  return Result.succeed(value)
}

export const requireSafeInteger = <Value extends number>(
  value: Value,
  failure: () => string,
): Result.Result<Value, RangeError> => {
  if (!Number.isSafeInteger(value)) {
    return Result.fail(new RangeError(failure()))
  }
  return Result.succeed(value)
}

export const requireFinite: typeof requireFiniteNumber = requireFiniteNumber

export const requirePositiveFinite = <Value extends number>(
  value: Value,
  failure: () => string,
): Result.Result<Value, RangeError> => {
  if (!Number.isFinite(value) || value <= POSITIVE_BOUNDARY) {
    return Result.fail(new RangeError(failure()))
  }
  return Result.succeed(value)
}

export const requirePositiveInteger = <Value extends number>(
  value: Value,
  failure: () => string,
): Result.Result<Value, RangeError> => {
  if (!Number.isSafeInteger(value) || value <= POSITIVE_BOUNDARY) {
    return Result.fail(new RangeError(failure()))
  }
  return Result.succeed(value)
}
