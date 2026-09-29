export const requireDefined = <Value>(value: Value | undefined, name: string): Value => {
  if (typeof value === 'undefined') {
    throw new RangeError(`${name} is out of bounds`)
  }
  return value
}
