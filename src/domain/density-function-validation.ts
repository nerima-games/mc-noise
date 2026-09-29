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

const isDensityFunctionRecord = (value: unknown): value is DensityFunctionRecord =>
  value !== null && typeof value === 'object'

const isDensityKind = (value: string): value is DensityFunction['kind'] =>
  Array.from(DENSITY_KINDS).some((kind) => kind === value)

const hasValidDensityBounds = (candidate: DensityFunctionRecord): boolean =>
  typeof candidate.minValue === 'number' &&
  typeof candidate.maxValue === 'number' &&
  !Number.isNaN(candidate.minValue) &&
  !Number.isNaN(candidate.maxValue) &&
  candidate.minValue <= candidate.maxValue

export const isDensityFunction = (
  value: unknown,
): value is DensityFunction => {
  if (!isDensityFunctionRecord(value)) {
    return false
  }
  const candidate = value
  if (
    typeof candidate.kind !== 'string' ||
    !isDensityKind(candidate.kind)
  ) {
    return false
  }
  return hasValidDensityBounds(candidate)
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
