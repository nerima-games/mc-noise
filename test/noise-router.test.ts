import { describe, expect, it } from 'vitest'
import {
  NOISE_ROUTER_CHANNELS,
  createDensityEvaluationContext,
  createDensityEvaluationSession,
  createNoiseRouter,
  createNoiseRouterRuntime,
  densityAdd,
  densityConstant,
  evaluateNoiseRouter,
  isNoiseRouter,
  mapAllNoiseRouter,
  mapNoiseRouter,
  requireNoiseRouter,
  type NoiseRouter,
} from '../src/index.js'

const makeRouter = (): NoiseRouter =>
  createNoiseRouter(
    Object.fromEntries(
      NOISE_ROUTER_CHANNELS.map((channel, index) => [
        channel,
        densityConstant(index),
      ]),
    ) as NoiseRouter,
  )

describe('NoiseRouter', () => {
  it('preserves all official channels and evaluates them', () => {
    const router = makeRouter()
    const position = { x: 1, y: 2, z: 3 }
    const expected = Object.fromEntries(
      NOISE_ROUTER_CHANNELS.map((channel, index) => [channel, index]),
    )

    expect(NOISE_ROUTER_CHANNELS).toHaveLength(15)
    expect(Object.isFrozen(router)).toBe(true)
    expect(requireNoiseRouter(router)).toEqual(router)
    expect(isNoiseRouter(router)).toBe(true)
    expect(evaluateNoiseRouter(router, position)).toEqual(expected)
    expect(
      evaluateNoiseRouter(router, position, createDensityEvaluationContext()),
    ).toEqual(expected)
    expect(
      evaluateNoiseRouter(
        router,
        position,
        createDensityEvaluationSession(createDensityEvaluationContext()),
      ),
    ).toEqual(expected)
  })

  it('maps every channel and supports the mapAll alias', () => {
    const router = makeRouter()
    const mapped = mapNoiseRouter(router, (density, channel) =>
      densityAdd(density, densityConstant(channel.length)),
    )
    const mappedAlias = mapAllNoiseRouter(router, (density) =>
      densityAdd(density, densityConstant(1)),
    )

    expect(evaluateNoiseRouter(mapped, { x: 0, y: 0, z: 0 }).finalDensity).toBe(
      11 + 'finalDensity'.length,
    )
    expect(
      evaluateNoiseRouter(mappedAlias, { x: 0, y: 0, z: 0 }).barrierNoise,
    ).toBe(1)
    expect(() => mapNoiseRouter(router, null as never)).toThrow(
      'visitor must be a function',
    )
    expect(() =>
      mapNoiseRouter(router, () => null as never),
    ).toThrow('mapped router.barrierNoise must be a DensityFunction')
  })

  it('exposes the official mapAll runtime method', () => {
    const runtime = createNoiseRouterRuntime(makeRouter())

    expect(Object.isFrozen(runtime)).toBe(true)
    expect(runtime.mapAll((density) => densityAdd(density, densityConstant(1))).barrierNoise).toMatchObject({
      kind: 'binary',
    })
    expect(() => runtime.mapAll(null as never)).toThrow(
      'visitor must be a function',
    )
  })

  it('rejects malformed routers at every public boundary', () => {
    expect(isNoiseRouter(null)).toBe(false)
    expect(isNoiseRouter({})).toBe(false)
    expect(isNoiseRouter({ barrierNoise: densityConstant(0) })).toBe(false)
    expect(() => createNoiseRouter(null as never)).toThrow(
      'router must be an object',
    )
    expect(() => requireNoiseRouter({})).toThrow(
      'router.barrierNoise must be a DensityFunction',
    )
    expect(() => evaluateNoiseRouter({} as never, { x: 0, y: 0, z: 0 })).toThrow(
      'router.barrierNoise must be a DensityFunction',
    )
    expect(() =>
      evaluateNoiseRouter(makeRouter(), { x: 0, y: 0, z: 0 }, null as never),
    ).toThrow('evaluation context must be an object')
  })
})
