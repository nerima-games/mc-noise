import * as Schema from 'effect/Schema'
import { BlockAxis, PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { type ControlPoint, type Spline, SplineInput, SplineValue, createSpline } from './spline.js'
import {
  type DensityBinaryOperation,
  DensityBound,
  type DensityBound as DensityBoundValue,
  DensityCellSize,
  type DensityCellSize as DensityCellSizeValue,
  type DensityCoordinateAxis,
  type DensityFunction,
  DensityFunctionFieldName,
  type DensityNoiseSource,
  DensityOctaveIndex,
  type DensityOctaveIndex as DensityOctaveIndexValue,
  type DensityOldBlendedNoiseOctave,
  type DensityOldBlendedNoiseSource,
  type DensityRarityValueMapper,
  DensityScale,
  type DensityScale as DensityScaleValue,
  type DensityUnaryOperation,
  DensityValue,
  type DensityValue as DensityValueType,
} from './density-function-types.js'
import { Option, Result } from 'effect'
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
import {
  requireFiniteNumber,
  requirePositiveInteger,
  requireSafeInteger,
} from './number-validation.js'
import type { SchemaError } from 'effect/Schema'
import { requireDensityFunction } from './density-function-validation.js'

export type DensityFunctionCodecOptions = Readonly<{
  readonly encodeNoiseSource?: (source: DensityNoiseSource) => string
  readonly decodeNoiseSource?: (id: string) => DensityNoiseSource
  readonly encodeOldBlendedNoiseSource?: (source: DensityOldBlendedNoiseSource) => string
  readonly decodeOldBlendedNoiseSource?: (id: string) => DensityOldBlendedNoiseSource
}>

type EncodedSpline = ReadonlyArray<readonly [SplineInput, SplineValue]>

export type DensityFunctionEncoded =
  | Readonly<{ readonly kind: 'constant'; readonly value: DensityValueType }>
  | Readonly<{
      readonly kind: 'coordinate'
      readonly axis: DensityCoordinateAxis
      readonly scale: DensityScaleValue
      readonly offset: PositionAxis
    }>
  | Readonly<{
      readonly kind: 'noise'
      readonly source: string
      readonly xzScale: DensityScaleValue
      readonly yScale: DensityScaleValue
    }>
  | Readonly<{
      readonly kind: 'old-blended-noise'
      readonly source: string
      readonly xzScale: DensityScaleValue
      readonly yScale: DensityScaleValue
      readonly xzFactor: DensityScaleValue
      readonly yFactor: DensityScaleValue
      readonly smearScaleMultiplier: DensityScaleValue
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
      readonly xzScale: DensityScaleValue
      readonly yScale: DensityScaleValue
    }>
  | Readonly<{
      readonly kind: 'linear-operation'
      readonly operation: 'add' | 'mul'
      readonly input: DensityFunctionEncoded
      readonly argument: DensityValueType
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
      readonly min: DensityValueType
      readonly max: DensityValueType
    }>
  | Readonly<{
      readonly kind: 'range-choice'
      readonly input: DensityFunctionEncoded
      readonly minInclusive: DensityValueType
      readonly maxExclusive: DensityValueType
      readonly inRange: DensityFunctionEncoded
      readonly outOfRange: DensityFunctionEncoded
    }>
  | Readonly<{
      readonly kind: 'find-top-surface'
      readonly density: DensityFunctionEncoded
      readonly upperBound: DensityFunctionEncoded
      readonly lowerBound: BlockAxis
      readonly cellHeight: DensityCellSizeValue
    }>
  | Readonly<{
      readonly kind: 'y-clamped-gradient'
      readonly fromY: BlockAxis
      readonly toY: BlockAxis
      readonly fromValue: DensityValueType
      readonly toValue: DensityValueType
    }>
  | Readonly<{
      readonly kind: 'spline'
      readonly input: DensityFunctionEncoded
      readonly spline: EncodedSpline
    }>
  | Readonly<{ readonly kind: 'interpolated'; readonly input: DensityFunctionEncoded }>
  | Readonly<{ readonly kind: 'flat-cache'; readonly input: DensityFunctionEncoded }>
  | Readonly<{ readonly kind: 'cache-2d'; readonly input: DensityFunctionEncoded }>
  | Readonly<{ readonly kind: 'cache-once'; readonly input: DensityFunctionEncoded }>
  | Readonly<{ readonly kind: 'cache-all-in-cell'; readonly input: DensityFunctionEncoded }>
  | Readonly<{ readonly kind: 'blend-density'; readonly input: DensityFunctionEncoded }>
  | Readonly<{ readonly kind: 'blend-alpha' }>
  | Readonly<{ readonly kind: 'blend-offset' }>

export type DensityFunctionCodecError = SchemaError | TypeError | RangeError
export type DensityFunctionCodecResult<Value> = Result.Result<Value, DensityFunctionCodecError>

type EncodedRecord = Readonly<{
  readonly kind?: unknown
  readonly value?: unknown
  readonly axis?: unknown
  readonly offset?: unknown
  readonly scale?: unknown
  readonly source?: unknown
  readonly sample?: unknown
  readonly maxValue?: unknown
  readonly minValue?: unknown
  readonly mainNoise?: unknown
  readonly minLimitNoise?: unknown
  readonly maxLimitNoise?: unknown
  readonly xzScale?: unknown
  readonly yScale?: unknown
  readonly xzFactor?: unknown
  readonly yFactor?: unknown
  readonly smearScaleMultiplier?: unknown
  readonly shiftX?: unknown
  readonly shiftY?: unknown
  readonly shiftZ?: unknown
  readonly operation?: unknown
  readonly input?: unknown
  readonly argument?: unknown
  readonly rarityValueMapper?: unknown
  readonly seed?: unknown
  readonly left?: unknown
  readonly right?: unknown
  readonly min?: unknown
  readonly max?: unknown
  readonly minInclusive?: unknown
  readonly maxExclusive?: unknown
  readonly inRange?: unknown
  readonly outOfRange?: unknown
  readonly density?: unknown
  readonly upperBound?: unknown
  readonly lowerBound?: unknown
  readonly cellHeight?: unknown
  readonly fromY?: unknown
  readonly toY?: unknown
  readonly fromValue?: unknown
  readonly toValue?: unknown
  readonly spline?: unknown
}>
type EncodeNode = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions,
) => DensityFunctionCodecResult<DensityFunctionEncoded>
type DecodeNode = (
  value: unknown,
  options: DensityFunctionCodecOptions,
) => DensityFunctionCodecResult<DensityFunction>

const EMPTY_STRING_LENGTH = 0
const OLD_BLENDED_NOISE_OCTAVE_COUNT = 16
const OLD_BLENDED_NOISE_OCTAVE_STEP = 1
const SPLINE_POINT_LENGTH = 2
const SPLINE_INPUT_POSITION_INDEX = 0
const SPLINE_VALUE_POSITION_INDEX = 1
const SPLINE_INDEX_INCREMENT = 1
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
const DensityFunctionJsonSchema = Schema.fromJsonString(Schema.Unknown)

const normalizeOptions = (
  options: DensityFunctionCodecOptions,
): Result.Result<DensityFunctionCodecOptions, TypeError> => {
  if (options !== null && typeof options === 'object') {
    return Result.succeed(options)
  }
  return Result.fail(new TypeError('codec options must be an object'))
}

const isEncodedRecord = (value: unknown): value is EncodedRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const readRecord = (name: string, value: unknown): Result.Result<EncodedRecord, TypeError> => {
  if (isEncodedRecord(value)) {
    return Result.succeed(value)
  }
  return Result.fail(new TypeError(`${name} must be an object`))
}

const readString = (name: string, value: unknown): Result.Result<string, TypeError> => {
  if (typeof value === 'string') {
    return Result.succeed(value)
  }
  return Result.fail(new TypeError(`${name} must be a string`))
}

const readEnum = <Value extends string>(
  name: string,
  value: unknown,
  allowed: readonly Value[],
): Result.Result<Value, TypeError | RangeError> =>
  Result.flatMap(readString(name, value), (candidate) => {
    const matching = allowed.find((item) => item === candidate)
    if (typeof matching !== 'undefined') {
      return Result.succeed(matching)
    }
    return Result.fail(
      new RangeError(`${name} must be one of ${allowed.join(', ')}, received ${candidate}`),
    )
  })

const readIdentifier = (name: string, value: unknown): Result.Result<string, TypeError | RangeError> =>
  Result.flatMap(readString(name, value), (identifier) => {
    if (identifier.length === EMPTY_STRING_LENGTH) {
      return Result.fail(new RangeError(`${name} must not be empty`))
    }
    return Result.succeed(identifier)
  })

const readFiniteValue = (
  name: string,
  value: unknown,
): Result.Result<number, TypeError | RangeError> => {
  if (typeof value !== 'number') {
    return Result.fail(new TypeError(`${name} must be a number`))
  }
  return requireFiniteNumber(value, () => `${name} must be finite`)
}

const readDensityValue = (
  name: string,
  value: unknown,
): Result.Result<DensityValueType, TypeError | RangeError> =>
  Result.map(readFiniteValue(name, value), DensityValue)

const readDensityScale = (
  name: string,
  value: unknown,
): Result.Result<DensityScaleValue, TypeError | RangeError> =>
  Result.map(readFiniteValue(name, value), DensityScale)

const readPositionAxis = (
  name: string,
  value: unknown,
): Result.Result<PositionAxis, TypeError | RangeError> =>
  Result.map(readFiniteValue(name, value), PositionAxis)

const readBlockAxis = (
  name: string,
  value: unknown,
): Result.Result<BlockAxis, TypeError | RangeError> => {
  if (typeof value !== 'number') {
    return Result.fail(new TypeError(`${name} must be a number`))
  }
  return Result.map(
    requireSafeInteger(value, () => `${name} must be a safe integer`),
    BlockAxis,
  )
}

const readDensityCellSize = (
  name: string,
  value: unknown,
): Result.Result<DensityCellSizeValue, TypeError | RangeError> => {
  if (typeof value !== 'number') {
    return Result.fail(new TypeError(`${name} must be a number`))
  }
  return Result.map(
    requirePositiveInteger(value, () => `${name} must be a positive integer`),
    DensityCellSize,
  )
}

const readDensityBound = (
  name: string,
  value: unknown,
): Result.Result<DensityBoundValue, TypeError | RangeError> => {
  if (typeof value !== 'number') {
    return Result.fail(new TypeError(`${name} must be a number`))
  }
  if (Number.isNaN(value)) {
    return Result.fail(new RangeError(`${name} must not be NaN`))
  }
  return Result.succeed(DensityBound(value))
}

const encodeSource = (
  source: DensityNoiseSource,
  options: DensityFunctionCodecOptions,
): DensityFunctionCodecResult<string> => {
  if (typeof options.encodeNoiseSource !== 'function') {
    return Result.fail(new TypeError('encodeNoiseSource is required for noise functions'))
  }
  const identifier: unknown = options.encodeNoiseSource(source)
  if (typeof identifier !== 'string' || identifier.length === EMPTY_STRING_LENGTH) {
    return Result.fail(new TypeError('encodeNoiseSource must return a non-empty string'))
  }
  return Result.succeed(identifier)
}

const encodeOldBlendedNoiseSource = (
  source: DensityOldBlendedNoiseSource,
  options: DensityFunctionCodecOptions,
): DensityFunctionCodecResult<string> => {
  if (typeof options.encodeOldBlendedNoiseSource !== 'function') {
    return Result.fail(
      new TypeError('encodeOldBlendedNoiseSource is required for old blended noise functions'),
    )
  }
  const identifier: unknown = options.encodeOldBlendedNoiseSource(source)
  if (typeof identifier !== 'string' || identifier.length === EMPTY_STRING_LENGTH) {
    return Result.fail(
      new TypeError('encodeOldBlendedNoiseSource must return a non-empty string'),
    )
  }
  return Result.succeed(identifier)
}

const encodeSpline = (spline: Spline): EncodedSpline =>
  spline.map(([input, value]) => [input, value] as const)

const encodeDirectNode = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions,
): DensityFunctionCodecResult<Option.Option<DensityFunctionEncoded>> =>
  Result.gen(function* encodeDirectDensityNodeResult() {
    switch (density.kind) {
      case 'constant':
        return Option.some({ kind: 'constant', value: density.value })
      case 'coordinate':
        return Option.some({
          axis: density.axis,
          kind: 'coordinate',
          offset: density.offset,
          scale: density.scale,
        })
      case 'noise':
        return Option.some({
          kind: 'noise',
          source: yield* encodeSource(density.source, options),
          xzScale: density.xzScale,
          yScale: density.yScale,
        })
      case 'old-blended-noise':
        return Option.some({
          kind: 'old-blended-noise',
          smearScaleMultiplier: density.smearScaleMultiplier,
          source: yield* encodeOldBlendedNoiseSource(density.source, options),
          xzFactor: density.xzFactor,
          xzScale: density.xzScale,
          yFactor: density.yFactor,
          yScale: density.yScale,
        })
      case 'beardifier':
        return Option.some({ kind: 'beardifier' })
      case 'shift':
        return Option.some({
          kind: 'shift',
          source: yield* encodeSource(density.source, options),
        })
      case 'shift-a':
        return Option.some({
          kind: 'shift-a',
          source: yield* encodeSource(density.source, options),
        })
      case 'shift-b':
        return Option.some({
          kind: 'shift-b',
          source: yield* encodeSource(density.source, options),
        })
      case 'end-islands':
        return Option.some({ kind: 'end-islands', seed: density.seed.toString() })
      case 'y-clamped-gradient':
        return Option.some({
          fromValue: density.fromValue,
          fromY: density.fromY,
          kind: 'y-clamped-gradient',
          toValue: density.toValue,
          toY: density.toY,
        })
      case 'blend-alpha':
        return Option.some({ kind: 'blend-alpha' })
      case 'blend-offset':
        return Option.some({ kind: 'blend-offset' })
      default:
        return Option.none()
    }
  })

const encodeNode: EncodeNode = (density, options) =>
  Result.gen(function* encodeDensityNodeResult() {
    const normalized = yield* requireDensityFunction(DensityFunctionFieldName('density'), density)
    const directNode = yield* encodeDirectNode(normalized, options)
    if (Option.isSome(directNode)) {
      return directNode.value
    }
    switch (normalized.kind) {
      case 'shifted-noise':
        return {
          kind: 'shifted-noise',
          shiftX: yield* encodeNode(normalized.shiftX, options),
          shiftY: yield* encodeNode(normalized.shiftY, options),
          shiftZ: yield* encodeNode(normalized.shiftZ, options),
          source: yield* encodeSource(normalized.source, options),
          xzScale: normalized.xzScale,
          yScale: normalized.yScale,
        }
      case 'linear-operation':
        return {
          argument: normalized.argument,
          input: yield* encodeNode(normalized.input, options),
          kind: 'linear-operation',
          operation: normalized.operation,
        }
      case 'weird-scaled-sampler':
        return {
          input: yield* encodeNode(normalized.input, options),
          kind: 'weird-scaled-sampler',
          rarityValueMapper: normalized.rarityValueMapper,
          source: yield* encodeSource(normalized.source, options),
        }
      case 'binary':
        return {
          kind: 'binary',
          left: yield* encodeNode(normalized.left, options),
          operation: normalized.operation,
          right: yield* encodeNode(normalized.right, options),
        }
      case 'unary':
        return {
          input: yield* encodeNode(normalized.input, options),
          kind: 'unary',
          operation: normalized.operation,
        }
      case 'clamp':
        return {
          input: yield* encodeNode(normalized.input, options),
          kind: 'clamp',
          max: normalized.max,
          min: normalized.min,
        }
      case 'range-choice':
        return {
          inRange: yield* encodeNode(normalized.inRange, options),
          input: yield* encodeNode(normalized.input, options),
          kind: 'range-choice',
          maxExclusive: normalized.maxExclusive,
          minInclusive: normalized.minInclusive,
          outOfRange: yield* encodeNode(normalized.outOfRange, options),
        }
      case 'find-top-surface':
        return {
          cellHeight: normalized.cellHeight,
          density: yield* encodeNode(normalized.density, options),
          kind: 'find-top-surface',
          lowerBound: normalized.lowerBound,
          upperBound: yield* encodeNode(normalized.upperBound, options),
        }
      case 'spline':
        return {
          input: yield* encodeNode(normalized.input, options),
          kind: 'spline',
          spline: encodeSpline(normalized.spline),
        }
      case 'interpolated':
        return { input: yield* encodeNode(normalized.input, options), kind: 'interpolated' }
      case 'flat-cache':
        return { input: yield* encodeNode(normalized.input, options), kind: 'flat-cache' }
      case 'cache-2d':
        return { input: yield* encodeNode(normalized.input, options), kind: 'cache-2d' }
      case 'cache-once':
        return { input: yield* encodeNode(normalized.input, options), kind: 'cache-once' }
      case 'cache-all-in-cell':
        return {
          input: yield* encodeNode(normalized.input, options),
          kind: 'cache-all-in-cell',
        }
      case 'blend-density':
        return { input: yield* encodeNode(normalized.input, options), kind: 'blend-density' }
      default:
        return yield* Result.fail(new RangeError('unsupported density function kind'))
    }
  })

const readSplineInput = (name: string, value: unknown): Result.Result<SplineInput, TypeError | RangeError> =>
  Result.map(readFiniteValue(name, value), SplineInput)

const readSplineValue = (name: string, value: unknown): Result.Result<SplineValue, TypeError | RangeError> =>
  Result.map(readFiniteValue(name, value), SplineValue)

const decodeSpline = (value: unknown): DensityFunctionCodecResult<Spline> => {
  if (!Array.isArray(value)) {
    return Result.fail(new TypeError('spline must be an array'))
  }
  return Result.gen(function* decodeSplineResult() {
    const points: ControlPoint[] = []
    for (
      let index = 0;
      index < value.length;
      index += SPLINE_INDEX_INCREMENT
    ) {
      const candidate = value[index]
      if (!Array.isArray(candidate) || candidate.length !== SPLINE_POINT_LENGTH) {
        return yield* Result.fail(new TypeError(`spline[${index}] must be a pair`))
      }
      const input = yield* readSplineInput(
        `spline[${index}][${SPLINE_INPUT_POSITION_INDEX}]`,
        candidate[SPLINE_INPUT_POSITION_INDEX],
      )
      const splineValue = yield* readSplineValue(
        `spline[${index}][${SPLINE_VALUE_POSITION_INDEX}]`,
        candidate[SPLINE_VALUE_POSITION_INDEX],
      )
      points.push([input, splineValue])
    }
    return yield* createSpline(points)
  })
}

const readSeed = (value: unknown): DensityFunctionCodecResult<bigint> =>
  Result.flatMap(readString('seed', value), (seed) => {
    if (/^-?[0-9]+$/.test(seed)) {
      return Result.succeed(BigInt(seed))
    }
    return Result.fail(new RangeError('seed must be a decimal integer string'))
  })

const isDensityNoiseSample = (
  value: unknown,
): value is DensityNoiseSource['sample'] => typeof value === 'function'

const decodeSource = (
  record: EncodedRecord,
  options: DensityFunctionCodecOptions,
): DensityFunctionCodecResult<DensityNoiseSource> =>
  Result.gen(function* decodeNoiseSourceResult() {
    const identifier = yield* readIdentifier('source', record.source)
    if (typeof options.decodeNoiseSource !== 'function') {
      return yield* Result.fail(new TypeError('decodeNoiseSource is required for noise functions'))
    }
    const candidate: unknown = options.decodeNoiseSource(identifier)
    if (!isEncodedRecord(candidate)) {
      return yield* Result.fail(new TypeError('decodeNoiseSource must return a noise source'))
    }
    const { sample } = candidate
    if (!isDensityNoiseSample(sample)) {
      return yield* Result.fail(
        new TypeError('decoded noise source must provide a sample function'),
      )
    }
    return yield* createDensityNoiseSource(
      sample,
      {
        maxValue: yield* readDensityBound(
          'decoded noise source maxValue',
          candidate.maxValue,
        ),
        minValue: yield* readDensityBound(
          'decoded noise source minValue',
          candidate.minValue,
        ),
      },
    )
  })

const isOldBlendedNoiseOctave = (
  value: unknown,
): value is DensityOldBlendedNoiseOctave =>
  isEncodedRecord(value) && typeof value.sample === 'function'

const isOldBlendedNoiseOctaveSource = (
  value: unknown,
): value is DensityOldBlendedNoiseSource['mainNoise'] => typeof value === 'function'

const requireOldBlendedNoiseFunction = (
  field: 'mainNoise' | 'minLimitNoise' | 'maxLimitNoise',
  value: unknown,
): DensityFunctionCodecResult<DensityOldBlendedNoiseSource['mainNoise']> => {
  if (!isOldBlendedNoiseOctaveSource(value)) {
    return Result.fail(
      new TypeError(`decoded old blended noise source must provide a ${field} function`),
    )
  }
  return Result.gen(function* decodeOldBlendedNoiseOctavesResult() {
    const octaves: (DensityOldBlendedNoiseOctave | undefined)[] = []
    for (
      let index = 0;
      index < OLD_BLENDED_NOISE_OCTAVE_COUNT;
      index += OLD_BLENDED_NOISE_OCTAVE_STEP
    ) {
      const octave: unknown = value(DensityOctaveIndex(index))
      if (typeof octave === 'undefined') {
        delete octaves[index]
      } else if (isOldBlendedNoiseOctave(octave)) {
        octaves[index] = octave
      } else {
        return yield* Result.fail(
          new TypeError(`decoded old blended noise source ${field} must return an octave`),
        )
      }
    }
    return (index: DensityOctaveIndexValue) => octaves[index]
  })
}

const decodeOldBlendedNoiseValue = (
  value: unknown,
): DensityFunctionCodecResult<DensityOldBlendedNoiseSource> =>
  Result.gen(function* decodeOldBlendedNoiseValueResult() {
    if (!isEncodedRecord(value)) {
      return yield* Result.fail(
        new TypeError('decodeOldBlendedNoiseSource must return an old blended noise source'),
      )
    }
    const candidate = value
    return yield* createDensityOldBlendedNoiseSource(
      {
        mainNoise: yield* requireOldBlendedNoiseFunction('mainNoise', candidate.mainNoise),
        maxLimitNoise: yield* requireOldBlendedNoiseFunction(
          'maxLimitNoise',
          candidate.maxLimitNoise,
        ),
        minLimitNoise: yield* requireOldBlendedNoiseFunction(
          'minLimitNoise',
          candidate.minLimitNoise,
        ),
      },
      {
        maxValue: yield* readDensityBound(
          'decoded old blended noise source maxValue',
          candidate.maxValue,
        ),
        minValue: yield* readDensityBound(
          'decoded old blended noise source minValue',
          candidate.minValue,
        ),
      },
    )
  })

const decodeOldBlendedNoiseSource = (
  record: EncodedRecord,
  options: DensityFunctionCodecOptions,
): DensityFunctionCodecResult<DensityOldBlendedNoiseSource> =>
  Result.gen(function* decodeOldBlendedNoiseSourceResult() {
    const identifier = yield* readIdentifier('source', record.source)
    if (typeof options.decodeOldBlendedNoiseSource !== 'function') {
      return yield* Result.fail(
        new TypeError('decodeOldBlendedNoiseSource is required for old blended noise functions'),
      )
    }
    return yield* decodeOldBlendedNoiseValue(options.decodeOldBlendedNoiseSource(identifier))
  })

const decodeDirectNode = (
  kind: string,
  record: EncodedRecord,
  options: DensityFunctionCodecOptions,
): DensityFunctionCodecResult<Option.Option<DensityFunction>> =>
  Result.gen(function* decodeDirectDensityNodeResult() {
    switch (kind) {
      case 'constant':
        return Option.some(yield* densityConstant(yield* readDensityValue('value', record.value)))
      case 'coordinate':
        return Option.some(yield* densityCoordinate(
          yield* readEnum('axis', record.axis, DENSITY_COORDINATE_AXES),
          {
            offset: yield* readPositionAxis('offset', record.offset),
            scale: yield* readDensityScale('scale', record.scale),
          },
        ))
      case 'noise':
        return Option.some(yield* densityNoise(yield* decodeSource(record, options), {
          xzScale: yield* readDensityScale('xzScale', record.xzScale),
          yScale: yield* readDensityScale('yScale', record.yScale),
        }))
      case 'old-blended-noise':
        return Option.some(yield* densityOldBlendedNoise(
          yield* decodeOldBlendedNoiseSource(record, options),
          {
            smearScaleMultiplier: yield* readDensityScale(
              'smearScaleMultiplier',
              record.smearScaleMultiplier,
            ),
            xzFactor: yield* readDensityScale('xzFactor', record.xzFactor),
            xzScale: yield* readDensityScale('xzScale', record.xzScale),
            yFactor: yield* readDensityScale('yFactor', record.yFactor),
            yScale: yield* readDensityScale('yScale', record.yScale),
          },
        ))
      case 'beardifier':
        return Option.some(densityBeardifier())
      case 'shift':
        return Option.some(yield* densityShift(yield* decodeSource(record, options)))
      case 'shift-a':
        return Option.some(yield* densityShiftA(yield* decodeSource(record, options)))
      case 'shift-b':
        return Option.some(yield* densityShiftB(yield* decodeSource(record, options)))
      case 'end-islands':
        return Option.some(yield* densityEndIslands(yield* readSeed(record.seed)))
      case 'y-clamped-gradient':
        return Option.some(yield* densityYClampedGradient(
          yield* readBlockAxis('fromY', record.fromY),
          yield* readBlockAxis('toY', record.toY),
          yield* readDensityValue('fromValue', record.fromValue),
          yield* readDensityValue('toValue', record.toValue),
        ))
      case 'blend-alpha':
        return Option.some(densityBlendAlpha())
      case 'blend-offset':
        return Option.some(densityBlendOffset())
      default:
        return Option.none()
    }
  })

const decodeNode: DecodeNode = (value, options) =>
  Result.gen(function* decodeDensityNodeResult() {
    const record = yield* readRecord('density function', value)
    const kind = yield* readString('kind', record.kind)
    const directNode = yield* decodeDirectNode(kind, record, options)
    if (Option.isSome(directNode)) {
      return directNode.value
    }
    switch (kind) {
      case 'shifted-noise':
        return yield* densityShiftedNoise(
          yield* decodeSource(record, options),
          {
            x: yield* decodeNode(record.shiftX, options),
            y: yield* decodeNode(record.shiftY, options),
            z: yield* decodeNode(record.shiftZ, options),
          },
          {
            xzScale: yield* readDensityScale('xzScale', record.xzScale),
            yScale: yield* readDensityScale('yScale', record.yScale),
          },
        )
      case 'linear-operation':
        return yield* densityLinearOperation(
          yield* readEnum('operation', record.operation, DENSITY_LINEAR_OPERATIONS),
          yield* decodeNode(record.input, options),
          yield* readDensityValue('argument', record.argument),
        )
      case 'weird-scaled-sampler':
        return yield* densityWeirdScaledSampler(
          yield* decodeNode(record.input, options),
          yield* decodeSource(record, options),
          yield* readEnum(
            'rarityValueMapper',
            record.rarityValueMapper,
            DENSITY_RARITY_VALUE_MAPPERS,
          ),
        )
      case 'binary':
        return yield* densityBinary(
          yield* readEnum('operation', record.operation, DENSITY_BINARY_OPERATIONS),
          yield* decodeNode(record.left, options),
          yield* decodeNode(record.right, options),
        )
      case 'unary':
        return yield* densityUnary(
          yield* readEnum('operation', record.operation, DENSITY_UNARY_OPERATIONS),
          yield* decodeNode(record.input, options),
        )
      case 'clamp':
        return yield* densityClamp(
          yield* decodeNode(record.input, options),
          yield* readDensityValue('min', record.min),
          yield* readDensityValue('max', record.max),
        )
      case 'range-choice':
        return yield* densityRangeChoice(
          yield* decodeNode(record.input, options),
          {
            maxExclusive: yield* readDensityValue('maxExclusive', record.maxExclusive),
            minInclusive: yield* readDensityValue('minInclusive', record.minInclusive),
          },
          yield* decodeNode(record.inRange, options),
          yield* decodeNode(record.outOfRange, options),
        )
      case 'find-top-surface':
        return yield* densityFindTopSurface(
          yield* decodeNode(record.density, options),
          yield* decodeNode(record.upperBound, options),
          yield* readBlockAxis('lowerBound', record.lowerBound),
          yield* readDensityCellSize('cellHeight', record.cellHeight),
        )
      case 'spline':
        return yield* densitySpline(
          yield* decodeNode(record.input, options),
          yield* decodeSpline(record.spline),
        )
      case 'interpolated':
        return densityInterpolated(yield* decodeNode(record.input, options))
      case 'flat-cache':
        return densityFlatCache(yield* decodeNode(record.input, options))
      case 'cache-2d':
        return densityCache2D(yield* decodeNode(record.input, options))
      case 'cache-once':
        return densityCacheOnce(yield* decodeNode(record.input, options))
      case 'cache-all-in-cell':
        return densityCacheAllInCell(yield* decodeNode(record.input, options))
      case 'blend-density':
        return densityBlendDensity(yield* decodeNode(record.input, options))
      default:
        return yield* Result.fail(
          new RangeError(`unsupported density function kind, received ${kind}`),
        )
    }
  })

export const encodeDensityFunction = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions = {},
): DensityFunctionCodecResult<DensityFunctionEncoded> =>
  Result.flatMap(normalizeOptions(options), (normalizedOptions) =>
    encodeNode(density, normalizedOptions),
  )

export const decodeDensityFunction = (
  value: unknown,
  options: DensityFunctionCodecOptions = {},
): DensityFunctionCodecResult<DensityFunction> =>
  Result.flatMap(normalizeOptions(options), (normalizedOptions) =>
    decodeNode(value, normalizedOptions),
  )

export const stringifyDensityFunction = (
  density: DensityFunction,
  options: DensityFunctionCodecOptions = {},
): DensityFunctionCodecResult<string> =>
  Result.flatMap(encodeDensityFunction(density, options), (encoded) =>
    Result.fromNullishOr(JSON.stringify(encoded), TypeError),
  )

export const parseDensityFunction = (
  serialized: string,
  options: DensityFunctionCodecOptions = {},
): DensityFunctionCodecResult<DensityFunction> => {
  if (typeof serialized !== 'string') {
    return Result.fail(new TypeError('serialized density function must be a string'))
  }
  return Result.flatMap(normalizeOptions(options), (normalizedOptions) =>
    Result.flatMap(
      Schema.decodeUnknownResult(DensityFunctionJsonSchema)(serialized),
      (value) => decodeNode(value, normalizedOptions),
    ),
  )
}
