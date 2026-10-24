import { describe, expect, it } from 'vitest'
import {
  NOISE_ROUTER_CHANNELS,
  createNoiseRouter,
  createNoiseRouterRuntime,
  evaluateNoiseRouter,
  isNoiseRouter,
  mapAllNoiseRouter,
  mapNoiseRouter,
  requireNoiseRouter,
  type NoiseRouter,
} from '../src/index.js'
import {
  createDensityEvaluationContext,
  createDensityEvaluationSession,
  densityAdd,
  densityConstant,
  densityPosition,
  expectDensitySuccess,
  expectResultFailure,
} from './density-function-test-utils.js'

const makeRouter = (): NoiseRouter =>
  expectDensitySuccess(createNoiseRouter(
    Object.fromEntries(
      NOISE_ROUTER_CHANNELS.map((channel, index) => [
        channel,
        densityConstant(index),
      ]),
    ) as NoiseRouter,
  ))

describe('NoiseRouter', () => {
  it('preserves all official channels and evaluates them', () => {
    const router = makeRouter()
    const context = createDensityEvaluationContext()
    const position = densityPosition({ x: 1, y: 2, z: 3 })
    const expected = Object.fromEntries(
      NOISE_ROUTER_CHANNELS.map((channel, index) => [channel, index]),
    )

    expect(NOISE_ROUTER_CHANNELS).toHaveLength(15)
    expect(Object.isFrozen(router)).toBe(true)
    expect(expectDensitySuccess(requireNoiseRouter(router))).toEqual(router)
    expect(isNoiseRouter(router)).toBe(true)
    expect(expectDensitySuccess(evaluateNoiseRouter(router, position))).toEqual(expected)
    expect(
      expectDensitySuccess(
        evaluateNoiseRouter(router, position, context),
      ),
    ).toEqual(expected)
    expect(
      expectDensitySuccess(
        evaluateNoiseRouter(
          router,
          position,
          createDensityEvaluationSession(context),
        ),
      ),
    ).toEqual(expected)
  })

  it('maps every channel and supports the mapAll alias', () => {
    const router = makeRouter()
    const mapped = expectDensitySuccess(mapNoiseRouter(router, (density, channel) =>
      densityAdd(density, densityConstant(channel.length)),
    ))
    const mappedAlias = expectDensitySuccess(mapAllNoiseRouter(router, (density) =>
      densityAdd(density, densityConstant(1)),
    ))

    expect(
      expectDensitySuccess(
        evaluateNoiseRouter(mapped, densityPosition({ x: 0, y: 0, z: 0 })),
      ).finalDensity,
    ).toBe(11 + 'finalDensity'.length)
    expect(
      expectDensitySuccess(
        evaluateNoiseRouter(mappedAlias, densityPosition({ x: 0, y: 0, z: 0 })),
      ).barrierNoise,
    ).toBe(1)
    expect(
      expectResultFailure(mapNoiseRouter(router, null as never)).message,
    ).toContain('visitor must be a function')
    expect(
      expectResultFailure(mapNoiseRouter(router, () => null as never)).message,
    ).toContain('mapped router.barrierNoise must be a DensityFunction')
  })

  it('exposes the official mapAll runtime method', () => {
    const runtime = expectDensitySuccess(createNoiseRouterRuntime(makeRouter()))

    expect(Object.isFrozen(runtime)).toBe(true)
    expect(
      expectDensitySuccess(
        runtime.mapAll((density) => densityAdd(density, densityConstant(1))),
      ).barrierNoise,
    ).toMatchObject({ kind: 'binary' })
    expect(
      expectResultFailure(runtime.mapAll(null as never)).message,
    ).toContain('visitor must be a function')
  })

  it('rejects malformed routers at every public boundary', () => {
    expect(isNoiseRouter(null)).toBe(false)
    expect(isNoiseRouter({})).toBe(false)
    expect(isNoiseRouter({ barrierNoise: densityConstant(0) })).toBe(false)
    expect(
      expectResultFailure(createNoiseRouter(null as never)).message,
    ).toContain('router must be an object')
    expect(
      expectResultFailure(requireNoiseRouter({} as never)).message,
    ).toContain('router.barrierNoise must be a DensityFunction')
    expect(
      expectResultFailure(
        evaluateNoiseRouter({} as never, densityPosition({ x: 0, y: 0, z: 0 })),
      ).message,
    ).toContain('router.barrierNoise must be a DensityFunction')
    expect(
      expectResultFailure(
        evaluateNoiseRouter(
          makeRouter(),
          densityPosition({ x: 0, y: 0, z: 0 }),
          null as never,
        ),
      ).message,
    ).toContain('evaluation context must be an object')
  })
})
