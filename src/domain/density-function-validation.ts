import type { DensityFunction } from './density-function-types.js'

const DENSITY_KINDS: ReadonlySet<DensityFunction['kind']> = new Set([
  'constant',
  'coordinate',
  'noise',
  'old-blended-noise',
  'beardifier',
  'shift',
  'shift-a',
  'shift-b',
  'shifted-noise',
  'linear-operation',
  'weird-scaled-sampler',
  'end-islands',
  'binary',
  'unary',
  'clamp',
  'range-choice',
  'find-top-surface',
  'y-clamped-gradient',
  'spline',
  'interpolated',
  'flat-cache',
  'cache-2d',
  'cache-once',
  'cache-all-in-cell',
  'blend-density',
  'blend-alpha',
  'blend-offset',
])

type DensityFunctionRecord = Readonly<{
  readonly kind?: unknown
  readonly minValue?: unknown
  readonly maxValue?: unknown
}>

export const isDensityFunction = (
  value: unknown,
): value is DensityFunction => {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const candidate = value as DensityFunctionRecord
  if (
    typeof candidate.kind !== 'string' ||
    !DENSITY_KINDS.has(candidate.kind as DensityFunction['kind'])
  ) {
    return false
  }
  if (
    typeof candidate.minValue !== 'number' ||
    typeof candidate.maxValue !== 'number'
  ) {
    return false
  }
  if (
    Number.isNaN(candidate.minValue) ||
    Number.isNaN(candidate.maxValue)
  ) {
    return false
  }
  return candidate.minValue <= candidate.maxValue
}

export const requireDensityFunction = (
  name: string,
  value: unknown,
): DensityFunction => {
  if (!isDensityFunction(value)) {
    throw new TypeError(`${name} must be a DensityFunction`)
  }
  return value
}
