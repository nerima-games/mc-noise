import type { BlockAxis, PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'
import { Brand, type Result } from 'effect'
import type { EndIslandsSampler } from './end-islands.js'
import type { NoiseFn3D } from './perlin.js'
import type { Spline } from './spline.js'

const DENSITY_FIELD_NAME_EMPTY_LENGTH = 0
const DENSITY_CELL_SIZE_LOWER_BOUND = 0

export type DensityValue = number & Brand.Brand<'DensityValue'>
export const DensityValue: Brand.Constructor<DensityValue> = Brand.make<DensityValue>((value) =>
  Number.isFinite(value) || 'density value must be finite',
)

export type DensityFunctionFieldName = string & Brand.Brand<'DensityFunctionFieldName'>
export const DensityFunctionFieldName: Brand.Constructor<DensityFunctionFieldName> =
  Brand.make<DensityFunctionFieldName>((value) =>
    value.length > DENSITY_FIELD_NAME_EMPTY_LENGTH || 'density function field name must not be empty',
  )

export type DensityBound = number & Brand.Brand<'DensityBound'>
export const DensityBound: Brand.Constructor<DensityBound> = Brand.make<DensityBound>((value) =>
  !Number.isNaN(value) || 'density bound must not be NaN',
)

export type DensityScale = number & Brand.Brand<'DensityScale'>
export const DensityScale: Brand.Constructor<DensityScale> = Brand.make<DensityScale>((value) =>
  Number.isFinite(value) || 'density scale must be finite',
)

export type DensityCellSize = number & Brand.Brand<'DensityCellSize'>
export const DensityCellSize: Brand.Constructor<DensityCellSize> = Brand.make<DensityCellSize>((value) =>
  Number.isSafeInteger(value) && value > DENSITY_CELL_SIZE_LOWER_BOUND || 'density cell size must be a positive integer',
)

export type DensityFunctionError = TypeError | RangeError
export type DensityFunctionResult<Value> = Result.Result<Value, DensityFunctionError>

export type DensityOctaveIndex = number & Brand.Brand<'DensityOctaveIndex'>
export const DensityOctaveIndex: Brand.Constructor<DensityOctaveIndex> = Brand.make<DensityOctaveIndex>((value) =>
  Number.isSafeInteger(value) || 'density octave index must be a safe integer',
)

export type DensityPosition = Readonly<{
  readonly x: PositionAxis
  readonly y: PositionAxis
  readonly z: PositionAxis
}>

export type DensityBounds = Readonly<{
  readonly minValue: DensityBound
  readonly maxValue: DensityBound
}>

export type DensityNoiseSource = DensityBounds & Readonly<{
  readonly sample: NoiseFn3D
}>

export type DensityOldBlendedNoiseSample = readonly [
  x: PositionAxis,
  y: PositionAxis,
  z: PositionAxis,
  yScale: DensityScale,
  yMax: PositionAxis,
]

export type DensityOldBlendedNoiseOctave = Readonly<{
  readonly sample: (...coordinates: DensityOldBlendedNoiseSample) => DensityValue
}>

export type DensityOldBlendedNoiseOctaveSource = (
  octave: DensityOctaveIndex,
) => DensityOldBlendedNoiseOctave | undefined

export type DensityOldBlendedNoiseSource = DensityBounds & Readonly<{
  readonly mainNoise: DensityOldBlendedNoiseOctaveSource
  readonly minLimitNoise: DensityOldBlendedNoiseOctaveSource
  readonly maxLimitNoise: DensityOldBlendedNoiseOctaveSource
}>

export type DensityCoordinateAxis = 'x' | 'y' | 'z'

export type DensityBinaryOperation = 'add' | 'mul' | 'min' | 'max'

export type DensityUnaryOperation =
  | 'abs'
  | 'square'
  | 'cube'
  | 'half-negative'
  | 'quarter-negative'
  | 'squeeze'
  | 'invert'

export type DensityMappedOperation = Exclude<DensityUnaryOperation, 'invert'>

export type DensityConstant = DensityBounds & Readonly<{
  readonly kind: 'constant'
  readonly value: DensityValue
}>

export type DensityCoordinate = DensityBounds & Readonly<{
  readonly kind: 'coordinate'
  readonly axis: DensityCoordinateAxis
  readonly scale: DensityScale
  readonly offset: PositionAxis
}>

export type DensityNoise = DensityBounds & Readonly<{
  readonly kind: 'noise'
  readonly source: DensityNoiseSource
  readonly xzScale: DensityScale
  readonly yScale: DensityScale
}>

export type DensityOldBlendedNoise = DensityBounds & Readonly<{
  readonly kind: 'old-blended-noise'
  readonly source: DensityOldBlendedNoiseSource
  readonly xzScale: DensityScale
  readonly yScale: DensityScale
  readonly xzFactor: DensityScale
  readonly yFactor: DensityScale
  readonly smearScaleMultiplier: DensityScale
}>

export type DensityBeardifier = DensityBounds & Readonly<{
  readonly kind: 'beardifier'
}>

export type DensityShift = DensityBounds & Readonly<{
  readonly kind: 'shift'
  readonly source: DensityNoiseSource
}>

export type DensityShiftA = DensityBounds & Readonly<{
  readonly kind: 'shift-a'
  readonly source: DensityNoiseSource
}>

export type DensityShiftB = DensityBounds & Readonly<{
  readonly kind: 'shift-b'
  readonly source: DensityNoiseSource
}>

export type DensityShiftedNoise = DensityBounds & Readonly<{
  readonly kind: 'shifted-noise'
  readonly source: DensityNoiseSource
  readonly shiftX: DensityFunction
  readonly shiftY: DensityFunction
  readonly shiftZ: DensityFunction
  readonly xzScale: DensityScale
  readonly yScale: DensityScale
}>

export type DensityLinearOperationType = 'add' | 'mul'

export type DensityLinearOperation = DensityBounds & Readonly<{
  readonly kind: 'linear-operation'
  readonly operation: DensityLinearOperationType
  readonly input: DensityFunction
  readonly argument: DensityValue
}>

export type DensityRarityValueMapper = 'type-1' | 'type-2'

export type DensityWeirdScaledSampler = DensityBounds & Readonly<{
  readonly kind: 'weird-scaled-sampler'
  readonly input: DensityFunction
  readonly source: DensityNoiseSource
  readonly rarityValueMapper: DensityRarityValueMapper
}>

export type DensityEndIslands = DensityBounds & Readonly<{
  readonly kind: 'end-islands'
  readonly seed: bigint
  readonly sampler: EndIslandsSampler
}>

export type DensityBinary = DensityBounds & Readonly<{
  readonly kind: 'binary'
  readonly operation: DensityBinaryOperation
  readonly left: DensityFunction
  readonly right: DensityFunction
}>

export type DensityUnary = DensityBounds & Readonly<{
  readonly kind: 'unary'
  readonly operation: DensityUnaryOperation
  readonly input: DensityFunction
}>

export type DensityClamp = DensityBounds & Readonly<{
  readonly kind: 'clamp'
  readonly input: DensityFunction
  readonly min: DensityValue
  readonly max: DensityValue
}>

export type DensityRangeChoice = DensityBounds & Readonly<{
  readonly kind: 'range-choice'
  readonly input: DensityFunction
  readonly minInclusive: DensityValue
  readonly maxExclusive: DensityValue
  readonly inRange: DensityFunction
  readonly outOfRange: DensityFunction
}>

export type DensityFindTopSurface = DensityBounds & Readonly<{
  readonly kind: 'find-top-surface'
  readonly density: DensityFunction
  readonly upperBound: DensityFunction
  readonly lowerBound: BlockAxis
  readonly cellHeight: DensityCellSize
}>

export type DensityYClampedGradient = DensityBounds & Readonly<{
  readonly kind: 'y-clamped-gradient'
  readonly fromY: BlockAxis
  readonly toY: BlockAxis
  readonly fromValue: DensityValue
  readonly toValue: DensityValue
}>

export type DensitySpline = DensityBounds & Readonly<{
  readonly kind: 'spline'
  readonly input: DensityFunction
  readonly spline: Spline
}>

export type DensityInterpolated = DensityBounds & Readonly<{
  readonly kind: 'interpolated'
  readonly input: DensityFunction
}>

export type DensityFlatCache = DensityBounds & Readonly<{
  readonly kind: 'flat-cache'
  readonly input: DensityFunction
}>

export type DensityCache2D = DensityBounds & Readonly<{
  readonly kind: 'cache-2d'
  readonly input: DensityFunction
}>

export type DensityCacheOnce = DensityBounds & Readonly<{
  readonly kind: 'cache-once'
  readonly input: DensityFunction
}>

export type DensityCacheAllInCell = DensityBounds & Readonly<{
  readonly kind: 'cache-all-in-cell'
  readonly input: DensityFunction
}>

export type DensityBlendDensity = DensityBounds & Readonly<{
  readonly kind: 'blend-density'
  readonly input: DensityFunction
}>

export type DensityBlendAlpha = DensityBounds & Readonly<{
  readonly kind: 'blend-alpha'
}>

export type DensityBlendOffset = DensityBounds & Readonly<{
  readonly kind: 'blend-offset'
}>

export type DensityFunction =
  | DensityConstant
  | DensityCoordinate
  | DensityNoise
  | DensityOldBlendedNoise
  | DensityBeardifier
  | DensityShift
  | DensityShiftA
  | DensityShiftB
  | DensityShiftedNoise
  | DensityLinearOperation
  | DensityWeirdScaledSampler
  | DensityEndIslands
  | DensityBinary
  | DensityUnary
  | DensityClamp
  | DensityRangeChoice
  | DensityFindTopSurface
  | DensityYClampedGradient
  | DensitySpline
  | DensityInterpolated
  | DensityFlatCache
  | DensityCache2D
  | DensityCacheOnce
  | DensityCacheAllInCell
  | DensityBlendDensity
  | DensityBlendAlpha
  | DensityBlendOffset

export type DensityFunctionVisitor = (density: DensityFunction) => DensityFunction

export type DensityFunctionValue = DensityFunction | DensityValue


export type DensityEvaluationContext = Readonly<{
  readonly cellWidth: DensityCellSize
  readonly cellHeight: DensityCellSize
  readonly blendDensity?: (
    inputValue: DensityValue,
    position: DensityPosition,
  ) => DensityFunctionResult<DensityValue>
  readonly blendAlpha?: (position: DensityPosition) => DensityFunctionResult<DensityValue>
  readonly blendOffset?: (position: DensityPosition) => DensityFunctionResult<DensityValue>
  readonly beardifier?: (position: DensityPosition) => DensityFunctionResult<DensityValue>
}>

export type DensityEvaluationContextOptions = Readonly<{
  readonly cellWidth?: DensityCellSize
  readonly cellHeight?: DensityCellSize
  readonly blendDensity?: (
    inputValue: DensityValue,
    position: DensityPosition,
  ) => DensityFunctionResult<DensityValue>
  readonly blendAlpha?: (position: DensityPosition) => DensityFunctionResult<DensityValue>
  readonly blendOffset?: (position: DensityPosition) => DensityFunctionResult<DensityValue>
  readonly beardifier?: (position: DensityPosition) => DensityFunctionResult<DensityValue>
}>

export type DensityEvaluationSession = Readonly<{
  readonly context: DensityEvaluationContext
  readonly evaluate: (
    density: DensityFunction,
    position: DensityPosition,
  ) => DensityFunctionResult<DensityValue>
  readonly clear: () => void
}>

export type DensityCoordinateOptions = Readonly<{
  readonly scale?: DensityScale
  readonly offset?: PositionAxis
}>

export type DensityNoiseOptions = Readonly<{
  readonly xzScale?: DensityScale
  readonly yScale?: DensityScale
}>

export type DensityOldBlendedNoiseOptions = Readonly<{
  readonly xzScale: DensityScale
  readonly yScale: DensityScale
  readonly xzFactor: DensityScale
  readonly yFactor: DensityScale
  readonly smearScaleMultiplier: DensityScale
}>

export type DensityNoiseInRangeOptions = DensityNoiseOptions & Readonly<{
  readonly min: DensityValue
  readonly max: DensityValue
}>

export type DensityShiftedNoise2DOptions = Readonly<{
  readonly xzScale?: DensityScale
}>

export type DensityShiftedNoise2DShifts = Readonly<{
  readonly x: DensityFunction
  readonly z: DensityFunction
}>

export type DensityShiftedNoiseShifts = Readonly<{
  readonly x: DensityFunction
  readonly y: DensityFunction
  readonly z: DensityFunction
}>

export type DensityRangeChoiceOptions = Readonly<{
  readonly minInclusive: DensityValue
  readonly maxExclusive: DensityValue
}>
