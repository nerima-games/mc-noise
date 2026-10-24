import { Brand, Result } from 'effect'

export type DefinedValueName = string & Brand.Brand<'DefinedValueName'>
export const DefinedValueName: Brand.Constructor<DefinedValueName> = Brand.nominal<DefinedValueName>()

export const requireDefined = <Value>(
  value: Value | undefined,
  name: DefinedValueName,
): Result.Result<Value, RangeError> => {
  if (typeof value === 'undefined') {
    return Result.fail(new RangeError(`${name} is out of bounds`))
  }
  return Result.succeed(value)
}
