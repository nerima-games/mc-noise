import * as DensityApi from '../src/index.js'
import {
  BlockAxis,
  PositionAxis,
  type BlockAxis as BlockAxisValue,
  type PositionAxis as PositionAxisValue,
} from '@nerima-games/mc-kernel/domain/coordinates'
import {
  DensityBound,
  DensityCellSize,
  DensityScale,
  DensityValue,
  type DensityBound as DensityBoundValue,
  type DensityCellSize as DensityCellSizeValue,
  type DensityEvaluationContext,
  type DensityEvaluationSession,
  type DensityFunction,
  type DensityNoiseSource,
  type DensityOldBlendedNoiseSource,
  type DensityPosition,
  type DensityScale as DensityScaleValue,
  type DensityValue as DensityValueType,
} from '../src/domain/density-function-types.js'
import { DensityArrayIndex, type DensityArrayIndex as DensityArrayIndexValue } from '../src/domain/density-function-runtime.js'
import { SplineInput, SplineValue, type ControlPoint, type Spline } from '../src/domain/spline.js'
import { Result } from 'effect'
import type { NoiseFn3D } from '../src/domain/perlin.js'

export const expectDensitySuccess = <Value, Failure>(
  result: Result.Result<Value, Failure>,
): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }
  return result.success
}

export const expectResultFailure = <Value, Failure>(
  result: Result.Result<Value, Failure>,
): Failure => {
  if (Result.isSuccess(result)) {
    throw new Error('expected Result failure')
  }
  return result.failure
}

export const densityValue = (value: number): DensityValueType => DensityValue(value)
export const densityBound = (value: number): DensityBoundValue => DensityBound(value)
export const densityScale = (value: number): DensityScaleValue => DensityScale(value)
export const densityCellSize = (value: number): DensityCellSizeValue =>
  DensityCellSize(value)
export const positionAxis = (value: number): PositionAxisValue => PositionAxis(value)
export const blockAxis = (value: number): BlockAxisValue => BlockAxis(value)
export const densityArrayIndex = (value: number): DensityArrayIndexValue =>
  DensityArrayIndex(value)

export type RawPosition = Readonly<{ x: number; y: number; z: number }>

export const densityPosition = (position: RawPosition): DensityPosition =>
  Object.freeze({
    x: PositionAxis(position.x),
    y: PositionAxis(position.y),
    z: PositionAxis(position.z),
  })

type RawBounds = Readonly<{ minValue: number; maxValue: number }>
type RawDensityOptions = Readonly<{ xzScale?: number; yScale?: number }>
type RawSpline = ReadonlyArray<readonly [number, number]>

const densityBounds = (bounds: RawBounds) => ({
  maxValue: DensityBound(bounds.maxValue),
  minValue: DensityBound(bounds.minValue),
})

export const createDensityNoiseSource = (
  sample: NoiseFn3D,
  bounds: RawBounds,
): DensityNoiseSource =>
  expectDensitySuccess(
    DensityApi.createDensityNoiseSource(sample, densityBounds(bounds)),
  )

export const createDensityOldBlendedNoiseSource = (
  source: Pick<DensityOldBlendedNoiseSource, 'mainNoise' | 'minLimitNoise' | 'maxLimitNoise'>,
  bounds: RawBounds,
): DensityOldBlendedNoiseSource =>
  expectDensitySuccess(
    DensityApi.createDensityOldBlendedNoiseSource(source, densityBounds(bounds)),
  )

export const createSpline = (points: RawSpline): Spline => {
  const controlPoints: ControlPoint[] = points.map(([input, value]) => [
    SplineInput(input),
    SplineValue(value),
  ])
  return expectDensitySuccess(DensityApi.createSpline(controlPoints))
}

export const densityConstant = (value: number): DensityFunction =>
  expectDensitySuccess(DensityApi.densityConstant(DensityValue(value)))

export const densityCoordinate = (
  axis: 'x' | 'y' | 'z',
  options: Readonly<{ scale?: number; offset?: number }> = {},
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityCoordinate(axis, {
      ...(typeof options.scale !== 'undefined' && { scale: DensityScale(options.scale) } || {}),
      ...(typeof options.offset !== 'undefined' && { offset: PositionAxis(options.offset) } || {}),
    }),
  )

export const densityNoise = (
  source: DensityNoiseSource,
  options: RawDensityOptions = {},
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityNoise(source, {
      ...(typeof options.xzScale !== 'undefined' && { xzScale: DensityScale(options.xzScale) } || {}),
      ...(typeof options.yScale !== 'undefined' && { yScale: DensityScale(options.yScale) } || {}),
    }),
  )

export const densityOldBlendedNoise = (
  source: DensityOldBlendedNoiseSource,
  options: Readonly<{
    xzScale: number
    yScale: number
    xzFactor: number
    yFactor: number
    smearScaleMultiplier: number
  }>,
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityOldBlendedNoise(source, {
      smearScaleMultiplier: DensityScale(options.smearScaleMultiplier),
      xzFactor: DensityScale(options.xzFactor),
      xzScale: DensityScale(options.xzScale),
      yFactor: DensityScale(options.yFactor),
      yScale: DensityScale(options.yScale),
    }),
  )

export const densityShift = (source: DensityNoiseSource): DensityFunction =>
  expectDensitySuccess(DensityApi.densityShift(source))
export const densityShiftA = (source: DensityNoiseSource): DensityFunction =>
  expectDensitySuccess(DensityApi.densityShiftA(source))
export const densityShiftB = (source: DensityNoiseSource): DensityFunction =>
  expectDensitySuccess(DensityApi.densityShiftB(source))

export const densityShiftedNoise = (
  source: DensityNoiseSource,
  shifts: Readonly<{ x: DensityFunction; y: DensityFunction; z: DensityFunction }>,
  options: RawDensityOptions = {},
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityShiftedNoise(source, shifts, {
      ...(typeof options.xzScale !== 'undefined' && { xzScale: DensityScale(options.xzScale) } || {}),
      ...(typeof options.yScale !== 'undefined' && { yScale: DensityScale(options.yScale) } || {}),
    }),
  )

export const densityLinearOperation = (
  operation: 'add' | 'mul',
  input: DensityFunction,
  argument: number,
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityLinearOperation(operation, input, DensityValue(argument)),
  )

export const densityWeirdScaledSampler = (
  input: DensityFunction,
  source: DensityNoiseSource,
  mapper: 'type-1' | 'type-2',
): DensityFunction =>
  expectDensitySuccess(DensityApi.densityWeirdScaledSampler(input, source, mapper))

export const densityEndIslands = (seed: bigint): DensityFunction =>
  expectDensitySuccess(DensityApi.densityEndIslands(seed))

export const densityBinary = (
  operation: 'add' | 'mul' | 'min' | 'max',
  left: DensityFunction,
  right: DensityFunction,
): DensityFunction =>
  expectDensitySuccess(DensityApi.densityBinary(operation, left, right))
export const densityAdd = (left: DensityFunction, right: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densityAdd(left, right))
export const densityMul = (left: DensityFunction, right: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densityMul(left, right))
export const densityMin = (left: DensityFunction, right: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densityMin(left, right))
export const densityMax = (left: DensityFunction, right: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densityMax(left, right))

export const densityUnary = (
  operation: 'abs' | 'square' | 'cube' | 'half-negative' | 'quarter-negative' | 'squeeze' | 'invert',
  input: DensityFunction,
): DensityFunction => expectDensitySuccess(DensityApi.densityUnary(operation, input))
export const densityAbs = (input: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densityAbs(input))
export const densitySquare = (input: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densitySquare(input))
export const densityCube = (input: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densityCube(input))
export const densityHalfNegative = (input: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densityHalfNegative(input))
export const densityQuarterNegative = (input: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densityQuarterNegative(input))
export const densitySqueeze = (input: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densitySqueeze(input))
export const densityInvert = (input: DensityFunction): DensityFunction =>
  expectDensitySuccess(DensityApi.densityInvert(input))

export const densityMap = (
  input: DensityFunction,
  operation: 'abs' | 'square' | 'cube' | 'half-negative' | 'quarter-negative' | 'squeeze',
): DensityFunction => expectDensitySuccess(DensityApi.densityMap(input, operation))

export const densityMapRange = (
  input: DensityFunction,
  min: number,
  max: number,
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityMapRange(input, DensityValue(min), DensityValue(max)),
  )

export const densityMappedNoise = (
  source: DensityNoiseSource,
  ...parameters: readonly number[]
): DensityFunction => {
  if (parameters.length === 2) {
    return expectDensitySuccess(
      DensityApi.densityMappedNoise(
        source,
        BlockAxis(parameters[0]!),
        BlockAxis(parameters[1]!),
      ),
    )
  }
  if (parameters.length === 3) {
    return expectDensitySuccess(
      DensityApi.densityMappedNoise(
        source,
        DensityScale(parameters[0]!),
        BlockAxis(parameters[1]!),
        BlockAxis(parameters[2]!),
      ),
    )
  }
  return expectDensitySuccess(
    DensityApi.densityMappedNoise(
      source,
      DensityScale(parameters[0]!),
      DensityScale(parameters[1]!),
      BlockAxis(parameters[2]!),
      BlockAxis(parameters[3]!),
    ),
  )
}

export const densityNoiseInRange = (
  source: DensityNoiseSource,
  options: Readonly<{ min: number; max: number; xzScale?: number; yScale?: number }>,
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityNoiseInRange(source, {
      min: DensityValue(options.min),
      max: DensityValue(options.max),
      ...(typeof options.xzScale !== 'undefined' && { xzScale: DensityScale(options.xzScale) } || {}),
      ...(typeof options.yScale !== 'undefined' && { yScale: DensityScale(options.yScale) } || {}),
    }),
  )

export const densityShiftedNoise2D = (
  source: DensityNoiseSource,
  shifts: Readonly<{ x: DensityFunction; z: DensityFunction }>,
  options: Readonly<{ xzScale?: number }> = {},
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityShiftedNoise2D(source, shifts, {
      ...(typeof options.xzScale !== 'undefined' && { xzScale: DensityScale(options.xzScale) } || {}),
    }),
  )

export const densityClamp = (
  input: DensityFunction,
  min: number,
  max: number,
): DensityFunction =>
  expectDensitySuccess(DensityApi.densityClamp(input, DensityValue(min), DensityValue(max)))

export const densityRangeChoice = (
  input: DensityFunction,
  options: Readonly<{ minInclusive: number; maxExclusive: number }>,
  inRange: DensityFunction,
  outOfRange: DensityFunction,
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityRangeChoice(
      input,
      {
        minInclusive: DensityValue(options.minInclusive),
        maxExclusive: DensityValue(options.maxExclusive),
      },
      inRange,
      outOfRange,
    ),
  )

export const densityYClampedGradient = (
  fromY: number,
  toY: number,
  fromValue: number,
  toValue: number,
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityYClampedGradient(
      BlockAxis(fromY),
      BlockAxis(toY),
      DensityValue(fromValue),
      DensityValue(toValue),
    ),
  )

export const densitySpline = (input: DensityFunction, spline: Spline): DensityFunction =>
  expectDensitySuccess(DensityApi.densitySpline(input, spline))

export const densityFindTopSurface = (
  density: DensityFunction,
  upperBound: DensityFunction,
  lowerBound: number,
  cellHeight: number,
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityFindTopSurface(
      density,
      upperBound,
      BlockAxis(lowerBound),
      DensityCellSize(cellHeight),
    ),
  )

const normalizeDensityFunctionValue = (
  value: DensityFunction | number,
): DensityFunction | DensityValueType => {
  if (typeof value === 'number') {
    return DensityValue(value)
  }
  return value
}

export const densityLerp = (
  delta: DensityFunction,
  min: DensityFunction | number,
  max: DensityFunction | number,
): DensityFunction =>
  expectDensitySuccess(
    DensityApi.densityLerp(
      delta,
      normalizeDensityFunctionValue(min),
      normalizeDensityFunctionValue(max),
    ),
  )

type RawEvaluationContextOptions = Readonly<{
  cellWidth?: number
  cellHeight?: number
  blendDensity?: (value: DensityValueType, position: DensityPosition) => number
  blendAlpha?: (position: DensityPosition) => number
  blendOffset?: (position: DensityPosition) => number
  beardifier?: (position: DensityPosition) => number
}>

export const createDensityEvaluationContext = (
  options: RawEvaluationContextOptions = {},
): DensityEvaluationContext =>
  expectDensitySuccess(
    DensityApi.createDensityEvaluationContext({
      ...(typeof options.cellWidth !== 'undefined' && { cellWidth: DensityCellSize(options.cellWidth) } || {}),
      ...(typeof options.cellHeight !== 'undefined' && { cellHeight: DensityCellSize(options.cellHeight) } || {}),
      ...(typeof options.blendDensity !== 'undefined' && {
            blendDensity: (value, position) =>
              Result.succeed(DensityValue(options.blendDensity!(value, position))),
          } || {}),
      ...(typeof options.blendAlpha !== 'undefined' && {
            blendAlpha: (position) =>
              Result.succeed(DensityValue(options.blendAlpha!(position))),
          } || {}),
      ...(typeof options.blendOffset !== 'undefined' && {
            blendOffset: (position) =>
              Result.succeed(DensityValue(options.blendOffset!(position))),
          } || {}),
      ...(typeof options.beardifier !== 'undefined' && {
            beardifier: (position) =>
              Result.succeed(DensityValue(options.beardifier!(position))),
          } || {}),
    }),
  )

export const createDensityEvaluationSession = (
  context: DensityEvaluationContext,
): DensityEvaluationSession =>
  expectDensitySuccess(DensityApi.createDensityEvaluationSession(context))

export const evaluateDensityFunction = (
  density: DensityFunction,
  position: RawPosition,
  context?: DensityEvaluationContext | DensityEvaluationSession,
): DensityValueType =>
  expectDensitySuccess(
    DensityApi.evaluateDensityFunction(density, densityPosition(position), context),
  )
