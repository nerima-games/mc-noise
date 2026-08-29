import type { EndIslandsSampler } from './end-islands.js'
import type { NoiseFn3D } from './perlin.js'
import type { Position } from '@nerima-games/mc-kernel'
import type { Spline } from './spline.js'

export type DensityPosition = Position

export type DensityBounds = Readonly<{
  readonly minValue: number
  readonly maxValue: number
}>

export type DensityNoiseSource = DensityBounds & Readonly<{
  readonly sample: NoiseFn3D
}>

export type DensityOldBlendedNoiseSample = readonly [
  x: number,
  y: number,
  z: number,
  yScale: number,
  yMax: number,
]

export type DensityOldBlendedNoiseOctave = Readonly<{
  readonly sample: (...coordinates: DensityOldBlendedNoiseSample) => number
}>

export type DensityOldBlendedNoiseOctaveSource = (
  octave: number,
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
  readonly value: number
}>

export type DensityCoordinate = DensityBounds & Readonly<{
  readonly kind: 'coordinate'
  readonly axis: DensityCoordinateAxis
  readonly scale: number
  readonly offset: number
}>

export type DensityNoise = DensityBounds & Readonly<{
  readonly kind: 'noise'
  readonly source: DensityNoiseSource
  readonly xzScale: number
  readonly yScale: number
}>

export type DensityOldBlendedNoise = DensityBounds & Readonly<{
  readonly kind: 'old-blended-noise'
  readonly source: DensityOldBlendedNoiseSource
  readonly xzScale: number
  readonly yScale: number
  readonly xzFactor: number
  readonly yFactor: number
  readonly smearScaleMultiplier: number
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
  readonly xzScale: number
  readonly yScale: number
}>

export type DensityLinearOperationType = 'add' | 'mul'

export type DensityLinearOperation = DensityBounds & Readonly<{
  readonly kind: 'linear-operation'
  readonly operation: DensityLinearOperationType
  readonly input: DensityFunction
  readonly argument: number
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
  readonly min: number
  readonly max: number
}>

export type DensityRangeChoice = DensityBounds & Readonly<{
  readonly kind: 'range-choice'
  readonly input: DensityFunction
  readonly minInclusive: number
  readonly maxExclusive: number
  readonly inRange: DensityFunction
  readonly outOfRange: DensityFunction
}>

export type DensityFindTopSurface = DensityBounds & Readonly<{
  readonly kind: 'find-top-surface'
  readonly density: DensityFunction
  readonly upperBound: DensityFunction
  readonly lowerBound: number
  readonly cellHeight: number
}>

export type DensityYClampedGradient = DensityBounds & Readonly<{
  readonly kind: 'y-clamped-gradient'
  readonly fromY: number
  readonly toY: number
  readonly fromValue: number
  readonly toValue: number
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

export type DensityFunctionValue = DensityFunction | number


export type DensityEvaluationContext = Readonly<{
  readonly cellWidth: number
  readonly cellHeight: number
  readonly blendDensity?: (
    inputValue: number,
    position: DensityPosition,
  ) => number
  readonly blendAlpha?: (position: DensityPosition) => number
  readonly blendOffset?: (position: DensityPosition) => number
  readonly beardifier?: (position: DensityPosition) => number
}>

export type DensityEvaluationContextOptions = Readonly<{
  readonly cellWidth?: number
  readonly cellHeight?: number
  readonly blendDensity?: (
    inputValue: number,
    position: DensityPosition,
  ) => number
  readonly blendAlpha?: (position: DensityPosition) => number
  readonly blendOffset?: (position: DensityPosition) => number
  readonly beardifier?: (position: DensityPosition) => number
}>

export type DensityEvaluationSession = Readonly<{
  readonly context: DensityEvaluationContext
  readonly evaluate: (
    density: DensityFunction,
    position: DensityPosition,
  ) => number
  readonly clear: () => void
}>

export type DensityCoordinateOptions = Readonly<{
  readonly scale?: number
  readonly offset?: number
}>

export type DensityNoiseOptions = Readonly<{
  readonly xzScale?: number
  readonly yScale?: number
}>

export type DensityOldBlendedNoiseOptions = Readonly<{
  readonly xzScale: number
  readonly yScale: number
  readonly xzFactor: number
  readonly yFactor: number
  readonly smearScaleMultiplier: number
}>

export type DensityNoiseInRangeOptions = DensityNoiseOptions & Readonly<{
  readonly min: number
  readonly max: number
}>

export type DensityShiftedNoise2DOptions = Readonly<{
  readonly xzScale?: number
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
  readonly minInclusive: number
  readonly maxExclusive: number
}>
