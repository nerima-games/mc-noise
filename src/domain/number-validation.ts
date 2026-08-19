const POSITIVE_BOUNDARY = 0

export const requireFiniteNumber = (name: string, value: number): number => {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`)
  }
  return value
}

export const requireSafeInteger = (name: string, value: number): number => {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer`)
  }
  return value
}

export const requireFinite = (name: string, value: number): number => {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite, received ${value}`)
  }
  return value
}

export const requirePositiveFinite = (name: string, value: number): number => {
  requireFinite(name, value)
  if (value <= POSITIVE_BOUNDARY) {
    throw new RangeError(`${name} must be positive, received ${value}`)
  }
  return value
}

export const requirePositiveInteger = (name: string, value: number): number => {
  if (!Number.isSafeInteger(value) || value <= POSITIVE_BOUNDARY) {
    throw new RangeError(`${name} must be a positive integer, received ${value}`)
  }
  return value
}
