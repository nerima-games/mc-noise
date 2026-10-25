import { describe, expect, it } from 'vitest'
import {
  computeDensityFunction,
  createBlender,
  createDensityFunctionContextProvider,
  createDensityFunctionFunctionContext,
  createDensityFunctionRuntime,
  densityBlendAlpha,
  densityBlendDensity,
  densityBlendOffset,
  densityFunctionMaxValue,
  densityFunctionMinValue,
  fillDensityFunctionArray,
  mapAllDensityFunction,
} from '../src/index.js'
import { Result } from 'effect'
import * as DensityApi from '../src/index.js'
import { DensityValue } from '../src/domain/density-function-types.js'
import {
  createDensityEvaluationContext,
  createDensityEvaluationSession,
  densityConstant,
  densityCoordinate,
  densityPosition,
  expectDensitySuccess,
  expectResultFailure,
  densityArrayIndex,
  positionAxis,
} from './density-function-test-utils.js'

const positions = [
  { x: 1, y: 2, z: 3 },
  { x: -2, y: 4, z: 5 },
  { x: 0, y: 0, z: 0 },
] as const

describe('DensityFunction runtime facade', () => {
  it('computes and fills arrays without an evaluation context', () => {
    const density = densityCoordinate('x', { scale: 2, offset: 1 })

    expect(
      expectDensitySuccess(
        computeDensityFunction(density, densityPosition(positions[0])),
      ),
    ).toBe(3)

    const values = [0, 0, 0]
    expect(
      expectDensitySuccess(
        fillDensityFunctionArray(
          density,
          values,
          (index) => densityPosition(positions[index]!),
        ),
      ),
    ).toBeUndefined()
    expect(values).toEqual([3, -3, 1])
    expect(
      expectDensitySuccess(
        fillDensityFunctionArray(density, [], () => densityPosition(positions[0])),
      ),
    ).toBeUndefined()

    const runtime = expectDensitySuccess(createDensityFunctionRuntime(density))
    expect(expectDensitySuccess(runtime.compute(densityPosition(positions[1])))).toBe(-3)
    const runtimeValues = [0, 0]
    expect(
      expectDensitySuccess(
        runtime.fillArray(runtimeValues, (index) => densityPosition(positions[index]!)),
      ),
    ).toBeUndefined()
    expect(runtimeValues).toEqual([3, -3])
  })

  it('supports contexts, sessions, and Float64Array targets', () => {
    const density = densityCoordinate('y')
    const context = createDensityEvaluationContext()
    const session = createDensityEvaluationSession(context)

    expect(
      expectDensitySuccess(
        computeDensityFunction(density, densityPosition(positions[0]), context),
      ),
    ).toBe(2)

    const contextValues = new Float64Array(2)
    expect(
      expectDensitySuccess(
        fillDensityFunctionArray(
          density,
          contextValues,
          (index) => densityPosition(positions[index]!),
          context,
        ),
      ),
    ).toBeUndefined()
    expect([...contextValues]).toEqual([2, 4])

    const sessionValues = new Float64Array(2)
    expect(
      expectDensitySuccess(
        fillDensityFunctionArray(
          density,
          sessionValues,
          (index) => densityPosition(positions[index]!),
          session,
        ),
      ),
    ).toBeUndefined()
    expect([...sessionValues]).toEqual([2, 4])

    const runtime = expectDensitySuccess(createDensityFunctionRuntime(density, session))
    expect(expectDensitySuccess(runtime.compute(densityPosition(positions[1])))).toBe(4)
    const runtimeValues = [0, 0]
    expect(
      expectDensitySuccess(
        runtime.fillArray(runtimeValues, (index) => densityPosition(positions[index]!)),
      ),
    ).toBeUndefined()
    expect(runtimeValues).toEqual([2, 4])

    const contextRuntime = expectDensitySuccess(createDensityFunctionRuntime(density, context))
    expect(
      expectDensitySuccess(contextRuntime.compute(densityPosition(positions[2]))),
    ).toBe(0)
  })

  it('maps nodes and exposes structural bounds', () => {
    const density = densityConstant(2)
    const runtime = expectDensitySuccess(createDensityFunctionRuntime(density))
    const mapped = expectDensitySuccess(runtime.mapAll((node) => {
      if (node.kind === 'constant') {
        return densityConstant(4)
      }
      return node
    }))

    expect(mapped).toMatchObject({ kind: 'constant', value: 4 })
    expect(
      expectDensitySuccess(
        mapAllDensityFunction(density, () => densityConstant(5)),
      ),
    ).toMatchObject({
      kind: 'constant',
      value: 5,
    })
    expect(expectDensitySuccess(densityFunctionMinValue(density))).toBe(2)
    expect(expectDensitySuccess(densityFunctionMaxValue(density))).toBe(2)
  })

  it('supports official FunctionContext and ContextProvider contracts', () => {
    const blender = expectDensitySuccess(createBlender({
      blendDensity: (_position, density) =>
        Result.succeed(DensityValue(density + 4)),
      blendOffsetAndFactor: () =>
        Result.succeed({
          alpha: DensityValue(0.25),
          blendingOffset: DensityValue(8),
        }),
    }))
    const context = expectDensitySuccess(
      createDensityFunctionFunctionContext(densityPosition({ x: 1, y: 2, z: 3 }), blender),
    )
    const defaultContext = expectDensitySuccess(
      createDensityFunctionFunctionContext(densityPosition(positions[0])),
    )

    expect(context.blockX()).toBe(1)
    expect(context.blockY()).toBe(2)
    expect(context.blockZ()).toBe(3)
    expect(context.getBlender().blendDensity).toBeTypeOf('function')
    expect(context.getBlender().blendOffsetAndFactor).toBeTypeOf('function')
    expect(
      expectDensitySuccess(computeDensityFunction(densityBlendDensity(densityConstant(2)), context)),
    ).toBe(6)
    expect(
      expectDensitySuccess(
        computeDensityFunction(
          densityBlendDensity(densityConstant(2)),
          context,
          createDensityEvaluationSession(createDensityEvaluationContext()),
        ),
      ),
    ).toBe(6)
    expect(
      expectDensitySuccess(
        computeDensityFunction(
          densityBlendDensity(densityConstant(2)),
          context,
          createDensityEvaluationContext(),
        ),
      ),
    ).toBe(6)
    expect(
      expectDensitySuccess(computeDensityFunction(densityBlendAlpha(), context)),
    ).toBe(0.25)
    expect(
      expectDensitySuccess(computeDensityFunction(densityBlendOffset(), context)),
    ).toBe(8)
    expect(defaultContext.getBlender()).toBeDefined()

    const provider = expectDensitySuccess(createDensityFunctionContextProvider(
      (index) => ({
        x: positionAxis(Number(index)),
        y: positionAxis(0),
        z: positionAxis(Number(index) + 1),
      }),
      blender,
    ))
    expect(
      expectDensitySuccess(provider.forIndex(densityArrayIndex(2))).blockX(),
    ).toBe(2)

    const directValues = [0, 0]
    expect(
      expectDensitySuccess(
        provider.fillAllDirectly(directValues, densityBlendDensity(densityConstant(2))),
      ),
    ).toBeUndefined()
    expect(directValues).toEqual([6, 6])

    const facadeValues = [0, 0]
    expect(
      expectDensitySuccess(
        fillDensityFunctionArray(
          densityBlendDensity(densityConstant(2)),
          facadeValues,
          provider,
        ),
      ),
    ).toBeUndefined()
    expect(facadeValues).toEqual([6, 6])
  })

  it('rejects invalid runtime inputs', () => {
    expect(
      expectResultFailure(
        DensityApi.computeDensityFunction(null as never, densityPosition(positions[0])),
      ).message,
    ).toContain('density must be a DensityFunction')
    expect(
      expectResultFailure(DensityApi.createDensityFunctionRuntime(null as never)).message,
    ).toContain('density must be a DensityFunction')
    expect(
      expectResultFailure(DensityApi.densityFunctionMinValue(null as never)).message,
    ).toContain('density must be a DensityFunction')
    expect(
      expectResultFailure(DensityApi.densityFunctionMaxValue(null as never)).message,
    ).toContain('density must be a DensityFunction')
    expect(
      expectResultFailure(
        DensityApi.computeDensityFunction(densityConstant(1), null as never),
      ).message,
    ).toContain('position must be an object')
    expect(
      expectResultFailure(
        DensityApi.computeDensityFunction(densityConstant(1), 1 as never),
      ).message,
    ).toContain('position must be an object')
    expect(
      expectResultFailure(
        DensityApi.computeDensityFunction(
          densityConstant(1),
          { x: Number.NaN, y: 0, z: 0 } as never,
        ),
      ).message,
      ).toContain('position.x PositionAxis must be a finite number of blocks')
    expect(
      expectResultFailure(
        DensityApi.fillDensityFunctionArray(
          densityConstant(1),
          {} as never,
          () => densityPosition(positions[0]),
        ),
      ).message,
    ).toContain('array must be an Array or Float64Array')
    expect(
      expectResultFailure(
        DensityApi.fillDensityFunctionArray(
          densityConstant(1),
          [],
          null as never,
        ),
      ).message,
    ).toContain('contextProvider must be a function or ContextProvider')
    expect(
      expectResultFailure(
        DensityApi.fillDensityFunctionArray(
          densityConstant(1),
          [0],
          () => null as never,
        ),
      ).message,
    ).toContain('position must be an object')
    expect(
      expectResultFailure(
        DensityApi.createDensityFunctionContextProvider(null as never),
      ).message,
    ).toContain('contextSource must be a function')
    const invalidYProvider = expectDensitySuccess(createDensityFunctionContextProvider(
      () => ({
        x: positionAxis(0),
        y: Number.NaN as never,
        z: positionAxis(0),
      }),
    ))
    expect(
      expectResultFailure(invalidYProvider.forIndex(densityArrayIndex(0))).message,
    ).toContain('position.y PositionAxis must be a finite number of blocks')
    const invalidZProvider = expectDensitySuccess(createDensityFunctionContextProvider(
      () => ({
        x: positionAxis(0),
        y: positionAxis(0),
        z: Number.NaN as never,
      }),
    ))
    expect(
      expectResultFailure(invalidZProvider.forIndex(densityArrayIndex(0))).message,
    ).toContain('position.z PositionAxis must be a finite number of blocks')

    const provider = expectDensitySuccess(createDensityFunctionContextProvider(
      (index) => ({
        x: positionAxis(Number(index)),
        y: positionAxis(0),
        z: positionAxis(Number(index)),
      }),
    ))
    expect(
      expectResultFailure(provider.forIndex(-1 as never)).message,
    ).toContain('index must be a non-negative safe integer')
    expect(
      expectResultFailure(provider.forIndex(Number.NaN as never)).message,
    ).toContain('index must be a non-negative safe integer')
    expect(
      expectResultFailure(provider.forIndex(0.5 as never)).message,
    ).toContain('index must be a non-negative safe integer')
    expect(
      expectResultFailure(
        provider.fillAllDirectly({} as never, densityConstant(1)),
      ).message,
    ).toContain('array must be an Array or Float64Array')
    expect(
      expectResultFailure(provider.fillAllDirectly([], null as never)).message,
    ).toContain('density must be a DensityFunction')
    expect(
      expectResultFailure(
        DensityApi.fillDensityFunctionArray(densityConstant(1), [0], {} as never),
      ).message,
    ).toContain('contextProvider must be a function or ContextProvider')
  })
})
