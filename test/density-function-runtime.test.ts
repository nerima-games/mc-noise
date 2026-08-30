import { describe, expect, it } from 'vitest'
import {
  computeDensityFunction,
  createBlender,
  createDensityEvaluationContext,
  createDensityEvaluationSession,
  createDensityFunctionContextProvider,
  createDensityFunctionFunctionContext,
  createDensityFunctionRuntime,
  densityBlendAlpha,
  densityBlendDensity,
  densityBlendOffset,
  densityConstant,
  densityCoordinate,
  densityFunctionMaxValue,
  densityFunctionMinValue,
  fillDensityFunctionArray,
  mapAllDensityFunction,
} from '../src/index.js'

const positions = [
  { x: 1, y: 2, z: 3 },
  { x: -2, y: 4, z: 5 },
  { x: 0, y: 0, z: 0 },
] as const

describe('DensityFunction runtime facade', () => {
  it('computes and fills arrays without an evaluation context', () => {
    const density = densityCoordinate('x', { scale: 2, offset: 1 })

    expect(computeDensityFunction(density, positions[0])).toBe(3)

    const values = [0, 0, 0]
    fillDensityFunctionArray(density, values, (index) => positions[index]!)
    expect(values).toEqual([3, -3, 1])
    fillDensityFunctionArray(density, [], () => positions[0])

    const runtime = createDensityFunctionRuntime(density)
    expect(runtime.compute(positions[1])).toBe(-3)
    const runtimeValues = [0, 0]
    runtime.fillArray(runtimeValues, (index) => positions[index]!)
    expect(runtimeValues).toEqual([3, -3])
  })

  it('supports contexts, sessions, and Float64Array targets', () => {
    const density = densityCoordinate('y')
    const context = createDensityEvaluationContext()
    const session = createDensityEvaluationSession(context)

    expect(computeDensityFunction(density, positions[0], context)).toBe(2)

    const contextValues = new Float64Array(2)
    fillDensityFunctionArray(
      density,
      contextValues,
      (index) => positions[index]!,
      context,
    )
    expect([...contextValues]).toEqual([2, 4])

    const sessionValues = new Float64Array(2)
    fillDensityFunctionArray(
      density,
      sessionValues,
      (index) => positions[index]!,
      session,
    )
    expect([...sessionValues]).toEqual([2, 4])

    const runtime = createDensityFunctionRuntime(density, session)
    expect(runtime.compute(positions[1])).toBe(4)
    const runtimeValues = [0, 0]
    runtime.fillArray(runtimeValues, (index) => positions[index]!)
    expect(runtimeValues).toEqual([2, 4])

    const contextRuntime = createDensityFunctionRuntime(density, context)
    expect(contextRuntime.compute(positions[2])).toBe(0)
  })

  it('maps nodes and exposes structural bounds', () => {
    const density = densityConstant(2)
    const runtime = createDensityFunctionRuntime(density)
    const mapped = runtime.mapAll((node) => {
      if (node.kind === 'constant') {
        return densityConstant(4)
      }
      return node
    })

    expect(mapped).toMatchObject({ kind: 'constant', value: 4 })
    expect(mapAllDensityFunction(density, () => densityConstant(5))).toMatchObject({
      kind: 'constant',
      value: 5,
    })
    expect(densityFunctionMinValue(density)).toBe(2)
    expect(densityFunctionMaxValue(density)).toBe(2)
  })

  it('supports official FunctionContext and ContextProvider contracts', () => {
    const blender = createBlender({
      blendDensity: (_position, density) => density + 4,
      blendOffsetAndFactor: () => ({ alpha: 0.25, blendingOffset: 8 }),
    })
    const context = createDensityFunctionFunctionContext(
      { x: 1, y: 2, z: 3 },
      blender,
    )
    const defaultContext = createDensityFunctionFunctionContext(positions[0])

    expect(context.blockX()).toBe(1)
    expect(context.blockY()).toBe(2)
    expect(context.blockZ()).toBe(3)
    expect(context.getBlender()).toBe(blender)
    expect(
      computeDensityFunction(densityBlendDensity(densityConstant(2)), context),
    ).toBe(6)
    expect(
      computeDensityFunction(
        densityBlendDensity(densityConstant(2)),
        context,
        createDensityEvaluationSession(createDensityEvaluationContext()),
      ),
    ).toBe(6)
    expect(
      computeDensityFunction(
        densityBlendDensity(densityConstant(2)),
        context,
        createDensityEvaluationContext(),
      ),
    ).toBe(6)
    expect(computeDensityFunction(densityBlendAlpha(), context)).toBe(0.25)
    expect(computeDensityFunction(densityBlendOffset(), context)).toBe(8)
    expect(defaultContext.getBlender()).toBeDefined()

    const provider = createDensityFunctionContextProvider(
      (index) => ({ x: index, y: 0, z: index + 1 }),
      blender,
    )
    expect(provider.forIndex(2).blockX()).toBe(2)

    const directValues = [0, 0]
    provider.fillAllDirectly(
      directValues,
      densityBlendDensity(densityConstant(2)),
    )
    expect(directValues).toEqual([6, 6])

    const facadeValues = [0, 0]
    fillDensityFunctionArray(
      densityBlendDensity(densityConstant(2)),
      facadeValues,
      provider,
    )
    expect(facadeValues).toEqual([6, 6])
  })

  it('rejects invalid runtime inputs', () => {
    expect(() => computeDensityFunction(null as never, positions[0])).toThrow(
      'density must be a DensityFunction',
    )
    expect(() => createDensityFunctionRuntime(null as never)).toThrow(
      'density must be a DensityFunction',
    )
    expect(() => densityFunctionMinValue(null as never)).toThrow(
      'density must be a DensityFunction',
    )
    expect(() => densityFunctionMaxValue(null as never)).toThrow(
      'density must be a DensityFunction',
    )
    expect(() => computeDensityFunction(densityConstant(1), null as never)).toThrow(
      'position must be an object',
    )
    expect(() => computeDensityFunction(densityConstant(1), 1 as never)).toThrow(
      'position must be an object',
    )
    expect(() => computeDensityFunction(densityConstant(1), {
      x: Number.NaN,
      y: 0,
      z: 0,
    })).toThrow('position.x must be finite')
    expect(() =>
      fillDensityFunctionArray(densityConstant(1), {} as never, () => positions[0]),
    ).toThrow('array must be an Array or Float64Array')
    expect(() =>
      fillDensityFunctionArray(densityConstant(1), [], null as never),
    ).toThrow('contextProvider must be a function or ContextProvider')
    expect(() =>
      fillDensityFunctionArray(densityConstant(1), [0], () => null as never),
    ).toThrow('position must be an object')
    expect(() =>
      createDensityFunctionContextProvider(null as never),
    ).toThrow('contextSource must be a function')

    const provider = createDensityFunctionContextProvider(
      (index) => ({ x: index, y: 0, z: index }),
    )
    expect(() => provider.forIndex(-1)).toThrow(
      'index must be a non-negative safe integer',
    )
    expect(() => provider.forIndex(Number.NaN)).toThrow(
      'index must be a non-negative safe integer',
    )
    expect(() => provider.forIndex(0.5)).toThrow(
      'index must be a non-negative safe integer',
    )
    expect(() => provider.fillAllDirectly({} as never, densityConstant(1))).toThrow(
      'array must be an Array or Float64Array',
    )
    expect(() => provider.fillAllDirectly([], null as never)).toThrow(
      'density must be a DensityFunction',
    )
    expect(() =>
      fillDensityFunctionArray(densityConstant(1), [0], {} as never),
    ).toThrow('contextProvider must be a function or ContextProvider')
  })
})
