import {
  type DensityFunction,
  DensityFunctionFieldName,
  type DensityFunctionResult,
  type DensityFunctionVisitor,
} from './density-function-types.js'
import {
  densityBinary,
  densityBlendDensity,
  densityCache2D,
  densityCacheAllInCell,
  densityCacheOnce,
  densityClamp,
  densityFindTopSurface,
  densityFlatCache,
  densityInterpolated,
  densityLinearOperation,
  densityShiftedNoise,
  densitySpline,
  densityUnary,
  densityWeirdScaledSampler,
  densityYClampedGradient,
} from './density-function.js'
import { Result } from 'effect'
import { densityRangeChoice } from './density-function-spatial.js'
import { requireDensityFunction } from './density-function-validation.js'

const requireVisitor = (
  visitor: DensityFunctionVisitor,
): Result.Result<DensityFunctionVisitor, TypeError> => {
  if (typeof visitor === 'function') {
    return Result.succeed(visitor)
  }
  return Result.fail(new TypeError('visitor must be a function'))
}

type OperationDensityFunction = Extract<
  DensityFunction,
  | { readonly kind: 'shifted-noise' }
  | { readonly kind: 'linear-operation' }
  | { readonly kind: 'weird-scaled-sampler' }
  | { readonly kind: 'binary' }
  | { readonly kind: 'unary' }
>

type BranchDensityFunction = Extract<
  DensityFunction,
  | { readonly kind: 'clamp' }
  | { readonly kind: 'find-top-surface' }
  | { readonly kind: 'range-choice' }
  | { readonly kind: 'spline' }
>

type ContextDensityFunction = Extract<
  DensityFunction,
  | { readonly kind: 'interpolated' }
  | { readonly kind: 'flat-cache' }
  | { readonly kind: 'cache-2d' }
  | { readonly kind: 'cache-once' }
  | { readonly kind: 'cache-all-in-cell' }
  | { readonly kind: 'blend-density' }
>

type Visit = (child: DensityFunction) => DensityFunctionResult<DensityFunction>

const mapOperationChildren = (
  density: OperationDensityFunction,
  visit: Visit,
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* mapOperationChildrenResult() {
    if (density.kind === 'shifted-noise') {
      return yield* densityShiftedNoise(
        density.source,
        {
          x: yield* visit(density.shiftX),
          y: yield* visit(density.shiftY),
          z: yield* visit(density.shiftZ),
        },
        { xzScale: density.xzScale, yScale: density.yScale },
      )
    }
    if (density.kind === 'linear-operation') {
      return yield* densityLinearOperation(
        density.operation,
        yield* visit(density.input),
        density.argument,
      )
    }
    if (density.kind === 'weird-scaled-sampler') {
      return yield* densityWeirdScaledSampler(
        yield* visit(density.input),
        density.source,
        density.rarityValueMapper,
      )
    }
    if (density.kind === 'binary') {
      return yield* densityBinary(
        density.operation,
        yield* visit(density.left),
        yield* visit(density.right),
      )
    }
    return yield* densityUnary(density.operation, yield* visit(density.input))
  })

const mapBranchChildren = (
  density: BranchDensityFunction,
  visit: Visit,
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* mapBranchChildrenResult() {
    if (density.kind === 'clamp') {
      return yield* densityClamp(yield* visit(density.input), density.min, density.max)
    }
    if (density.kind === 'range-choice') {
      return yield* densityRangeChoice(
        yield* visit(density.input),
        { maxExclusive: density.maxExclusive, minInclusive: density.minInclusive },
        yield* visit(density.inRange),
        yield* visit(density.outOfRange),
      )
    }
    if (density.kind === 'find-top-surface') {
      return yield* densityFindTopSurface(
        yield* visit(density.density),
        yield* visit(density.upperBound),
        density.lowerBound,
        density.cellHeight,
      )
    }
    return yield* densitySpline(yield* visit(density.input), density.spline)
  })

const contextChildMappers: Readonly<
  Record<ContextDensityFunction['kind'], (input: DensityFunction) => DensityFunction>
> = {
  'blend-density': densityBlendDensity,
  'cache-2d': densityCache2D,
  'cache-all-in-cell': densityCacheAllInCell,
  'cache-once': densityCacheOnce,
  'flat-cache': densityFlatCache,
  interpolated: densityInterpolated,
}

const mapContextChildren = (
  density: ContextDensityFunction,
  visit: Visit,
): DensityFunctionResult<DensityFunction> =>
  Result.map(visit(density.input), (input) => contextChildMappers[density.kind](input))

const mapLeafChildren = (
  density: DensityFunction,
): DensityFunctionResult<DensityFunction> => {
  if (density.kind === 'y-clamped-gradient') {
    return densityYClampedGradient(
      density.fromY,
      density.toY,
      density.fromValue,
      density.toValue,
    )
  }
  return Result.succeed(density)
}

const mapChildren = (
  density: DensityFunction,
  visit: Visit,
): DensityFunctionResult<DensityFunction> => {
  switch (density.kind) {
    case 'shifted-noise':
    case 'linear-operation':
    case 'weird-scaled-sampler':
    case 'binary':
    case 'unary':
      return mapOperationChildren(density, visit)
    case 'clamp':
    case 'find-top-surface':
    case 'range-choice':
    case 'spline':
      return mapBranchChildren(density, visit)
    case 'interpolated':
    case 'flat-cache':
    case 'cache-2d':
    case 'cache-once':
    case 'cache-all-in-cell':
    case 'blend-density':
      return mapContextChildren(density, visit)
    default:
      return mapLeafChildren(density)
  }
}

export const mapDensityFunction = (
  densityValue: DensityFunction,
  visitor: DensityFunctionVisitor,
): DensityFunctionResult<DensityFunction> =>
  Result.gen(function* mapContextChildrenResult() {
    const density = yield* requireDensityFunction(DensityFunctionFieldName('density'), densityValue)
    const mapVisitor = yield* requireVisitor(visitor)
    const mapped = yield* mapChildren(density, (child) =>
      mapDensityFunction(child, mapVisitor),
    )
    return yield* requireDensityFunction(
      DensityFunctionFieldName('visitor result'),
      mapVisitor(mapped),
    )
  })

export const mapAll: typeof mapDensityFunction = mapDensityFunction
