import type { DensityFunction, DensityFunctionVisitor } from './density-function-types.js'
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
import { densityRangeChoice } from './density-function-spatial.js'
import { requireDensityFunction } from './density-function-validation.js'

const requireVisitor = (visitor: DensityFunctionVisitor): DensityFunctionVisitor => {
  if (typeof visitor !== 'function') {
    throw new TypeError('visitor must be a function')
  }
  return visitor
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

const mapOperationChildren = (
  density: OperationDensityFunction,
  visit: (child: DensityFunction) => DensityFunction,
): DensityFunction => {
  if (density.kind === 'shifted-noise') {
    return densityShiftedNoise(
      density.source,
      {
        x: visit(density.shiftX),
        y: visit(density.shiftY),
        z: visit(density.shiftZ),
      },
      { xzScale: density.xzScale, yScale: density.yScale },
    )
  }
  if (density.kind === 'linear-operation') {
    return densityLinearOperation(
      density.operation,
      visit(density.input),
      density.argument,
    )
  }
  if (density.kind === 'weird-scaled-sampler') {
    return densityWeirdScaledSampler(
      visit(density.input),
      density.source,
      density.rarityValueMapper,
    )
  }
  if (density.kind === 'binary') {
    return densityBinary(
      density.operation,
      visit(density.left),
      visit(density.right),
    )
  }
  return densityUnary(density.operation, visit(density.input))
}

const mapBranchChildren = (
  density: BranchDensityFunction,
  visit: (child: DensityFunction) => DensityFunction,
): DensityFunction => {
  if (density.kind === 'clamp') {
    return densityClamp(visit(density.input), density.min, density.max)
  }
  if (density.kind === 'range-choice') {
    return densityRangeChoice(
      visit(density.input),
      { maxExclusive: density.maxExclusive, minInclusive: density.minInclusive },
      visit(density.inRange),
      visit(density.outOfRange),
    )
  }
  if (density.kind === 'find-top-surface') {
    return densityFindTopSurface(
      visit(density.density),
      visit(density.upperBound),
      density.lowerBound,
      density.cellHeight,
    )
  }
  return densitySpline(visit(density.input), density.spline)
}

const contextChildMappers: Readonly<
  Record<
    ContextDensityFunction['kind'],
    (input: DensityFunction) => DensityFunction
  >
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
  visit: (child: DensityFunction) => DensityFunction,
): DensityFunction => contextChildMappers[density.kind](visit(density.input))

const mapLeafChildren = (density: DensityFunction): DensityFunction => {
  if (density.kind === 'y-clamped-gradient') {
    return densityYClampedGradient(
      density.fromY,
      density.toY,
      density.fromValue,
      density.toValue,
    )
  }
  return density
}

const mapChildren = (
  density: DensityFunction,
  visit: (child: DensityFunction) => DensityFunction,
): DensityFunction => {
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
): DensityFunction => {
  const density = requireDensityFunction('density', densityValue)
  const mapVisitor = requireVisitor(visitor)
  const mapped = mapChildren(density, (child) => mapDensityFunction(child, mapVisitor))
  return requireDensityFunction('visitor result', mapVisitor(mapped))
}

export const mapAll = mapDensityFunction
