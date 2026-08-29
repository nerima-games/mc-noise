import type {
  DensityBinaryOperation,
  DensityCoordinateAxis,
  DensityFunction,
  DensityNoiseSource,
  DensityOldBlendedNoiseSource,
  DensityRarityValueMapper,
  DensityUnaryOperation,
} from './density-function-types.js'
import { type Spline, createSpline } from './spline.js'
import {
  createDensityNoiseSource,
  createDensityOldBlendedNoiseSource,
  densityBeardifier,
  densityBinary,
  densityBlendAlpha,
  densityBlendDensity,
  densityBlendOffset,
  densityCache2D,
  densityCacheAllInCell,
  densityCacheOnce,
  densityClamp,
  densityConstant,
  densityCoordinate,
  densityEndIslands,
  densityFindTopSurface,
  densityFlatCache,
  densityInterpolated,
  densityLinearOperation,
  densityNoise,
  densityOldBlendedNoise,
  densityRangeChoice,
  densityShift,
  densityShiftA,
  densityShiftB,
  densityShiftedNoise,
  densitySpline,
  densityUnary,
  densityWeirdScaledSampler,
  densityYClampedGradient,
} from './density-function.js'
import { requireDensityFunction } from './density-function-validation.js'
import { requireFiniteNumber } from './number-validation.js'

export type DensityFunctionCodecOptions = Readonly<{
  readonly encodeNoiseSource?: (source: DensityNoiseSource) => string
  readonly decodeNoiseSource?: (id: string) => DensityNoiseSource
  readonly encodeOldBlendedNoiseSource?: (source: DensityOldBlendedNoiseSource) => string
  readonly decodeOldBlendedNoiseSource?: (id: string) => DensityOldBlendedNoiseSource
}>

type EncodedSpline = ReadonlyArray<readonly [number, number]>

const EMPTY_STRING_LENGTH = 0
const SPLINE_POINT_LENGTH = 2
const SPLINE_INPUT_INDEX = 0
const SPLINE_VALUE_INDEX = 1
const DENSITY_COORDINATE_AXES = ['x', 'y', 'z'] as const
const DENSITY_BINARY_OPERATIONS = ['add', 'mul', 'min', 'max'] as const
const DENSITY_UNARY_OPERATIONS = [
  'abs',
  'square',
  'cube',
  'half-negative',
  'quarter-negative',
  'squeeze',
  'invert',
] as const
const DENSITY_LINEAR_OPERATIONS = ['add', 'mul'] as const
const DENSITY_RARITY_VALUE_MAPPERS = ['type-1', 'type-2'] as const

export type DensityFunctionEncoded =
  | Readonly<{ readonly kind: 'constant'; readonly value: number }>
  | Readonly<{
      readonly kind: 'coordinate'
      readonly axis: DensityCoordinateAxis
      readonly scale: number
      readonly offset: number
    }>
  | Readonly<{
      readonly kind: 'noise'
      readonly source: string
      readonly xzScale: number
      readonly yScale: number
    }>
  | Readonly<{
      readonly kind: 'old-blended-noise'
      readonly source: string
      readonly xzScale: number
      readonly yScale: number
      readonly xzFactor: number
      readonly yFactor: number
      readonly smearScaleMultiplier: number
    }>
  | Readonly<{ readonly kind: 'beardifier' }>
  | Readonly<{ readonly kind: 'shift'; readonly source: string }>
  | Readonly<{ readonly kind: 'shift-a'; readonly source: string }>
  | Readonly<{ readonly kind: 'shift-b'; readonly source: string }>
  | Readonly<{
      readonly kind: 'shifted-noise'
      readonly source: string
      readonly shiftX: DensityFunctionEncoded
      readonly shiftY: DensityFunctionEncoded
      readonly shiftZ: DensityFunctionEncoded
      readonly xzScale: number
      readonly yScale: number
    }>
  | Readonly<{
      readonly kind: 'linear-operation'
      readonly operation: 'add' | 'mul'
      readonly input: DensityFunctionEncoded
      readonly argument: number
    }>
  | Readonly<{
      readonly kind: 'weird-scaled-sampler'
      readonly input: DensityFunctionEncoded
      readonly source: string
      readonly rarityValueMapper: DensityRarityValueMapper
    }>
  | Readonly<{ readonly kind: 'end-islands'; readonly seed: string }>
  | Readonly<{
      readonly kind: 'binary'
      readonly operation: DensityBinaryOperation
      readonly left: DensityFunctionEncoded
      readonly right: DensityFunctionEncoded
    }>
  | Readonly<{
      readonly kind: 'unary'
      readonly operation: DensityUnaryOperation
      readonly input: DensityFunctionEncoded
    }>
  | Readonly<{
      readonly kind: 'clamp'
      readonly input: DensityFunctionEncoded
      readonly min: number
      readonly max: number
    }>
  | Readonly<{
      readonly kind: 'range-choice'
      readonly input: DensityFunctionEncoded
      readonly minInclusive: number
      readonly maxExclusive: number
      readonly inRange: DensityFunctionEncoded
      readonly outOfRange: DensityFunctionEncoded
    }>
  | Readonly<{
      readonly kind: 'find-top-surface'
      readonly density: DensityFunctionEncoded
      readonly upperBound: DensityFunctionEncoded
      readonly lowerBound: number
      readonly cellHeight: number
    }>
  | Readonly<{
      readonly kind: 'y-clamped-gradient'
      readonly fromY: number
      readonly toY: number
      readonly fromValue: number
      readonly toValue: number
    }>
  | Readonly<{
      readonly kind: 'spline'
      readonly input: DensityFunctionEncoded
      readonly spline: EncodedSpline
    }>
  | Readonly<{
      readonly kind: 'interpolated'
      readonly input: DensityFunctionEncoded
    }>
  | Readonly<{ readonly kind: 'flat-cache'; readonly input: DensityFunctionEncoded }>
  | Readonly<{ readonly kind: 'cache-2d'; readonly input: DensityFunctionEncoded }>
  | Readonly<{ readonly kind: 'cache-once'; readonly input: DensityFunctionEncoded }>
  | Readonly<{
      readonly kind: 'cache-all-in-cell'
      readonly input: DensityFunctionEncoded
    }>
  | Readonly<{
      readonly kind: 'blend-density'
      readonly input: DensityFunctionEncoded
    }>
  | Readonly<{ readonly kind: 'blend-alpha' }>
  | Readonly<{ readonly kind: 'blend-offset' }>

type EncodedRecord = Readonly<Record<string, unknown>>

const normalizeOptions = (
  options: DensityFunctionCodecOptions,
): DensityFunctionCodecOptions => {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('codec options must be an object')
  }
  return options
}

const readRecord = (name: string, value: unknown): EncodedRecord => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`)
  }
  return value as EncodedRecord
}

const readString = (name: string, value: unknown): string => {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string`)
  }
  return value
}

const readEnum = <Value extends string>(
  name: string,
  value: unknown,
  allowed: readonly Value[],
): Value => {
  const candidate = readString(name, value)
  if (!allowed.includes(candidate as Value)) {
    throw new RangeError(`${name} must be one of ${allowed.join(', ')}, received ${candidate}`)
  }
  return candidate as Value
}

const readIdentifier = (name: string, value: unknown): string => {
  const identifier = readString(name, value)
  if (identifier.length === EMPTY_STRING_LENGTH) {
    throw new RangeError(`${name} must not be empty`)
  }
  return identifier
}

const readFiniteValue = (name: string, value: unknown): number => {
  if (typeof value !== 'number') {
    throw new TypeError(`${name} must be a number`)
  }
  return requireFiniteNumber(name, value)
}

const readFiniteField = (record: EncodedRecord, name: string): number =>
  readFiniteValue(name, record[name])

const encodeSource = (
  source: DensityNoiseSource,
  options: DensityFunctionCodecOptions,
): string => {
  if (typeof options.encodeNoiseSource !== 'function') {
    throw new TypeError('encodeNoiseSource is required for noise functions')
  }
  const identifier = options.encodeNoiseSource(source)
  if (typeof identifier !== 'string' || identifier.length === EMPTY_STRING_LENGTH) {
    throw new TypeError('encodeNoiseSource must return a non-empty string')
  }
  return identifier
}

const decodeSource = (
  record: EncodedRecord,
  options: DensityFunctionCodecOptions,
): DensityNoiseSource => {
  const identifier = readIdentifier('source', record['source'])
  if (typeof options.decodeNoiseSource !== 'function') {
    throw new TypeError('decodeNoiseSource is required for noise functions')
  }
  const value = options.decodeNoiseSource(identifier) as unknown
  if (value === null || typeof value !== 'object') {
    throw new TypeError('decodeNoiseSource must return a noise source')
  }
  const candidate = value as {
    readonly sample?: unknown
    readonly minValue?: unknown
    readonly maxValue?: unknown
  }
  if (typeof candidate.sample !== 'function') {
    throw new TypeError('decoded noise source must provide a sample function')
  }
  return createDensityNoiseSource(
    candidate.sample as DensityNoiseSource['sample'],
    {
      maxValue: readFiniteValue('decoded noise source maxValue', candidate.maxValue),
      minValue: readFiniteValue('decoded noise source minValue', candidate.minValue),
    },
  )
}

const encodeOldBlendedNoiseSource = (
  source: DensityOldBlendedNoiseSource,
  options: DensityFunctionCodecOptions,
): string => {
  if (typeof options.encodeOldBlendedNoiseSource !== 'function') {
    throw new TypeError(
      'encodeOldBlendedNoiseSource is required for old blended noise functions',
    )
  }
  const identifier = options.encodeOldBlendedNoiseSource(source)
  if (typeof identifier !== 'string' || identifier.length === EMPTY_STRING_LENGTH) {
    throw new TypeError('encodeOldBlendedNoiseSource must return a non-empty string')
  }
  return identifier
}

const requireOldBlendedNoiseFunction = (
  field: 'mainNoise' | 'minLimitNoise' | 'maxLimitNoise',
  value: unknown,
): DensityOldBlendedNoiseSource['mainNoise'] => {
  if (typeof value !== 'function') {
    throw new TypeError(`decoded old blended noise source must provide a ${field} function`)
  }
  return value as DensityOldBlendedNoiseSource['mainNoise']
}

const decodeOldBlendedNoiseValue = (value: unknown): DensityOldBlendedNoiseSource => {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(
      'decodeOldBlendedNoiseSource must return an old blended noise source',
    )
  }
  const candidate = value as {
    readonly mainNoise?: unknown
    readonly minLimitNoise?: unknown
    readonly maxLimitNoise?: unknown
    readonly minValue?: unknown
    readonly maxValue?: unknown
  }
  return createDensityOldBlendedNoiseSource(
    {
      mainNoise: requireOldBlendedNoiseFunction('mainNoise', candidate.mainNoise),
      maxLimitNoise: requireOldBlendedNoiseFunction('maxLimitNoise', candidate.maxLimitNoise),
      minLimitNoise: requireOldBlendedNoiseFunction('minLimitNoise', candidate.minLimitNoise),
    },
    {
      maxValue: readFiniteValue(
        'decoded old blended noise source maxValue',
        candidate.maxValue,
      ),
      minValue: readFiniteValue(
        'decoded old blended noise source minValue',
        candidate.minValue,
      ),
    },
  )
}

const decodeOldBlendedNoiseSource = (
  record: EncodedRecord,
  options: DensityFunctionCodecOptions,
): DensityOldBlendedNoiseSource => {
  const identifier = readIdentifier('source', record['source'])
  if (typeof options.decodeOldBlendedNoiseSource !== 'function') {
    throw new TypeError(
      'decodeOldBlendedNoiseSource is required for old blended noise functions',
    )
  }
  return decodeOldBlendedNoiseValue(options.decodeOldBlendedNoiseSource(identifier) as unknown)
}

const encodeSpline = (spline: Spline): EncodedSpline =>
  spline.map(([input, value]) => [input, value] as const)

const decodeSpline = (value: unknown): Spline => {
  if (!Array.isArray(value)) {
    throw new TypeError('spline must be an array')
  }
  return createSpline(
    value.map((point, index) => {
      if (!Array.isArray(point) || point.length !== SPLINE_POINT_LENGTH) {
        throw new TypeError(`spline[${index}] must be a pair`)
      }
      return [
        readFiniteValue(`spline[${index}][0]`, point[SPLINE_INPUT_INDEX]),
        readFiniteValue(`spline[${index}][1]`, point[SPLINE_VALUE_INDEX]),
      ] as const
    }),
  )
}

const readSeed = (value: unknown): bigint => {
  const seed = readString('seed', value)
  if (!/^-?[0-9]+$/.test(seed)) {
    throw new RangeError('seed must be a decimal integer string')
  }
  return BigInt(seed)
}

type EncodeNode = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions,
) => DensityFunctionEncoded

const encodeNodeThird = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions,
  encode: EncodeNode,
): DensityFunctionEncoded => {
  switch (density.kind) {
    case 'interpolated':
      return { input: encode(density.input, options), kind: 'interpolated' }
    case 'flat-cache':
      return { input: encode(density.input, options), kind: 'flat-cache' }
    case 'cache-2d':
      return { input: encode(density.input, options), kind: 'cache-2d' }
    case 'cache-once':
      return { input: encode(density.input, options), kind: 'cache-once' }
    case 'cache-all-in-cell':
      return {
        input: encode(density.input, options),
        kind: 'cache-all-in-cell',
      }
    case 'blend-density':
      return { input: encode(density.input, options), kind: 'blend-density' }
    case 'blend-alpha':
      return { kind: 'blend-alpha' }
    case 'blend-offset':
      return { kind: 'blend-offset' }
    default:
      throw new RangeError('unsupported density function kind')
  }
}

const encodeNodeSecond = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions,
  encode: EncodeNode,
): DensityFunctionEncoded => {
  switch (density.kind) {
    case 'weird-scaled-sampler':
      return {
        input: encode(density.input, options),
        kind: 'weird-scaled-sampler',
        rarityValueMapper: density.rarityValueMapper,
        source: encodeSource(density.source, options),
      }
    case 'end-islands':
      return { kind: 'end-islands', seed: density.seed.toString() }
    case 'binary':
      return {
        kind: 'binary',
        left: encode(density.left, options),
        operation: density.operation,
        right: encode(density.right, options),
      }
    case 'unary':
      return {
        input: encode(density.input, options),
        kind: 'unary',
        operation: density.operation,
      }
    case 'clamp':
      return {
        input: encode(density.input, options),
        kind: 'clamp',
        max: density.max,
        min: density.min,
      }
    case 'range-choice':
      return {
        inRange: encode(density.inRange, options),
        input: encode(density.input, options),
        kind: 'range-choice',
        maxExclusive: density.maxExclusive,
        minInclusive: density.minInclusive,
        outOfRange: encode(density.outOfRange, options),
      }
    case 'find-top-surface':
      return {
        cellHeight: density.cellHeight,
        density: encode(density.density, options),
        kind: 'find-top-surface',
        lowerBound: density.lowerBound,
        upperBound: encode(density.upperBound, options),
      }
    case 'y-clamped-gradient':
      return {
        fromValue: density.fromValue,
        fromY: density.fromY,
        kind: 'y-clamped-gradient',
        toValue: density.toValue,
        toY: density.toY,
      }
    case 'spline':
      return {
        input: encode(density.input, options),
        kind: 'spline',
        spline: encodeSpline(density.spline),
      }
    default:
      return encodeNodeThird(density, options, encode)
  }
}

const encodeNodeFirst = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions,
  encode: EncodeNode,
): DensityFunctionEncoded => {
  const normalized = requireDensityFunction('density', density)
  switch (normalized.kind) {
    case 'constant':
      return { kind: 'constant', value: normalized.value }
    case 'coordinate':
      return {
        axis: normalized.axis,
        kind: 'coordinate',
        offset: normalized.offset,
        scale: normalized.scale,
      }
    case 'noise':
      return {
        kind: 'noise',
        source: encodeSource(normalized.source, options),
        xzScale: normalized.xzScale,
        yScale: normalized.yScale,
      }
    case 'old-blended-noise':
      return {
        kind: 'old-blended-noise',
        smearScaleMultiplier: normalized.smearScaleMultiplier,
        source: encodeOldBlendedNoiseSource(normalized.source, options),
        xzFactor: normalized.xzFactor,
        xzScale: normalized.xzScale,
        yFactor: normalized.yFactor,
        yScale: normalized.yScale,
      }
    case 'beardifier':
      return { kind: 'beardifier' }
    case 'shift':
      return { kind: 'shift', source: encodeSource(normalized.source, options) }
    case 'shift-a':
      return { kind: 'shift-a', source: encodeSource(normalized.source, options) }
    case 'shift-b':
      return { kind: 'shift-b', source: encodeSource(normalized.source, options) }
    case 'shifted-noise':
      return {
        kind: 'shifted-noise',
        shiftX: encode(normalized.shiftX, options),
        shiftY: encode(normalized.shiftY, options),
        shiftZ: encode(normalized.shiftZ, options),
        source: encodeSource(normalized.source, options),
        xzScale: normalized.xzScale,
        yScale: normalized.yScale,
      }
    case 'linear-operation':
      return {
        argument: normalized.argument,
        input: encode(normalized.input, options),
        kind: 'linear-operation',
        operation: normalized.operation,
      }
    default:
      return encodeNodeSecond(normalized, options, encode)
  }
}

const encodeNode: EncodeNode = (density, options) =>
  encodeNodeFirst(density, options, encodeNode)

type DecodeNode = (
  value: unknown,
  options: DensityFunctionCodecOptions,
) => DensityFunction

const decodeNodeThird = (
  record: EncodedRecord,
  kind: string,
  options: DensityFunctionCodecOptions,
  decode: DecodeNode,
): DensityFunction => {
  switch (kind) {
    case 'interpolated':
      return densityInterpolated(decode(record['input'], options))
    case 'flat-cache':
      return densityFlatCache(decode(record['input'], options))
    case 'cache-2d':
      return densityCache2D(decode(record['input'], options))
    case 'cache-once':
      return densityCacheOnce(decode(record['input'], options))
    case 'cache-all-in-cell':
      return densityCacheAllInCell(decode(record['input'], options))
    case 'blend-density':
      return densityBlendDensity(decode(record['input'], options))
    case 'blend-alpha':
      return densityBlendAlpha()
    case 'blend-offset':
      return densityBlendOffset()
    default:
      throw new RangeError(`unsupported density function kind, received ${kind}`)
  }
}

const decodeNodeSecond = (
  record: EncodedRecord,
  kind: string,
  options: DensityFunctionCodecOptions,
  decode: DecodeNode,
): DensityFunction => {
  switch (kind) {
    case 'weird-scaled-sampler':
      return densityWeirdScaledSampler(
        decode(record['input'], options),
        decodeSource(record, options),
        readEnum(
          'rarityValueMapper',
          record['rarityValueMapper'],
          DENSITY_RARITY_VALUE_MAPPERS,
        ) as DensityRarityValueMapper,
      )
    case 'end-islands':
      return densityEndIslands(readSeed(record['seed']))
    case 'binary':
      return densityBinary(
        readEnum('operation', record['operation'], DENSITY_BINARY_OPERATIONS) as DensityBinaryOperation,
        decode(record['left'], options),
        decode(record['right'], options),
      )
    case 'unary':
      return densityUnary(
        readEnum('operation', record['operation'], DENSITY_UNARY_OPERATIONS) as DensityUnaryOperation,
        decode(record['input'], options),
      )
    case 'clamp':
      return densityClamp(
        decode(record['input'], options),
        readFiniteField(record, 'min'),
        readFiniteField(record, 'max'),
      )
    case 'range-choice':
      return densityRangeChoice(
        decode(record['input'], options),
        {
          maxExclusive: readFiniteField(record, 'maxExclusive'),
          minInclusive: readFiniteField(record, 'minInclusive'),
        },
        decode(record['inRange'], options),
        decode(record['outOfRange'], options),
      )
    case 'find-top-surface':
      return densityFindTopSurface(
        decode(record['density'], options),
        decode(record['upperBound'], options),
        readFiniteField(record, 'lowerBound'),
        readFiniteField(record, 'cellHeight'),
      )
    case 'y-clamped-gradient':
      return densityYClampedGradient(
        readFiniteField(record, 'fromY'),
        readFiniteField(record, 'toY'),
        readFiniteField(record, 'fromValue'),
        readFiniteField(record, 'toValue'),
      )
    case 'spline':
      return densitySpline(
        decode(record['input'], options),
        decodeSpline(record['spline']),
      )
    default:
      return decodeNodeThird(record, kind, options, decode)
  }
}

const decodeNodeFirst = (
  record: EncodedRecord,
  kind: string,
  options: DensityFunctionCodecOptions,
  decode: DecodeNode,
): DensityFunction => {
  switch (kind) {
    case 'constant':
      return densityConstant(readFiniteField(record, 'value'))
    case 'coordinate':
      return densityCoordinate(
        readEnum('axis', record['axis'], DENSITY_COORDINATE_AXES) as DensityCoordinateAxis,
        {
          offset: readFiniteField(record, 'offset'),
          scale: readFiniteField(record, 'scale'),
        },
      )
    case 'noise':
      return densityNoise(decodeSource(record, options), {
        xzScale: readFiniteField(record, 'xzScale'),
        yScale: readFiniteField(record, 'yScale'),
      })
    case 'old-blended-noise':
      return densityOldBlendedNoise(decodeOldBlendedNoiseSource(record, options), {
        smearScaleMultiplier: readFiniteField(record, 'smearScaleMultiplier'),
        xzFactor: readFiniteField(record, 'xzFactor'),
        xzScale: readFiniteField(record, 'xzScale'),
        yFactor: readFiniteField(record, 'yFactor'),
        yScale: readFiniteField(record, 'yScale'),
      })
    case 'beardifier':
      return densityBeardifier()
    case 'shift':
      return densityShift(decodeSource(record, options))
    case 'shift-a':
      return densityShiftA(decodeSource(record, options))
    case 'shift-b':
      return densityShiftB(decodeSource(record, options))
    case 'shifted-noise':
      return densityShiftedNoise(
        decodeSource(record, options),
        {
          x: decode(record['shiftX'], options),
          y: decode(record['shiftY'], options),
          z: decode(record['shiftZ'], options),
        },
        {
          xzScale: readFiniteField(record, 'xzScale'),
          yScale: readFiniteField(record, 'yScale'),
        },
      )
    case 'linear-operation':
      return densityLinearOperation(
        readEnum('operation', record['operation'], DENSITY_LINEAR_OPERATIONS),
        decode(record['input'], options),
        readFiniteField(record, 'argument'),
      )
    default:
      return decodeNodeSecond(record, kind, options, decode)
  }
}

const decodeNode: DecodeNode = (value, options) => {
  const record = readRecord('density function', value)
  return decodeNodeFirst(record, readString('kind', record['kind']), options, decodeNode)
}

export const encodeDensityFunction = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions = {},
): DensityFunctionEncoded => encodeNode(density, normalizeOptions(options))

export const decodeDensityFunction = (
  value: unknown,
  options: DensityFunctionCodecOptions = {},
): DensityFunction => decodeNode(value, normalizeOptions(options))

export const stringifyDensityFunction = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions = {},
): string => JSON.stringify(encodeDensityFunction(density, options))

export const parseDensityFunction = (
  serialized: string,
  options: DensityFunctionCodecOptions = {},
): DensityFunction => {
  if (typeof serialized !== 'string') {
    throw new TypeError('serialized density function must be a string')
  }
  return decodeDensityFunction(JSON.parse(serialized) as unknown, options)
}
