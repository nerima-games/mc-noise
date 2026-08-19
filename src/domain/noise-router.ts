import type {
  DensityEvaluationContext,
  DensityEvaluationSession,
  DensityFunction,
  DensityPosition,
} from './density-function-types.js'
import {
  createDensityEvaluationSession,
  evaluateDensityFunction,
} from './density-function-evaluator.js'
import {
  isDensityFunction,
  requireDensityFunction,
} from './density-function-validation.js'

export const NOISE_ROUTER_CHANNELS = [
  'barrierNoise',
  'fluidLevelFloodednessNoise',
  'fluidLevelSpreadNoise',
  'lavaNoise',
  'temperature',
  'vegetation',
  'continents',
  'erosion',
  'depth',
  'ridges',
  'initialDensityWithoutJaggedness',
  'finalDensity',
  'veinToggle',
  'veinRidged',
  'veinGap',
] as const

export type NoiseRouterChannel = typeof NOISE_ROUTER_CHANNELS[number]

export type NoiseRouter = Readonly<{
  readonly barrierNoise: DensityFunction
  readonly fluidLevelFloodednessNoise: DensityFunction
  readonly fluidLevelSpreadNoise: DensityFunction
  readonly lavaNoise: DensityFunction
  readonly temperature: DensityFunction
  readonly vegetation: DensityFunction
  readonly continents: DensityFunction
  readonly erosion: DensityFunction
  readonly depth: DensityFunction
  readonly ridges: DensityFunction
  readonly initialDensityWithoutJaggedness: DensityFunction
  readonly finalDensity: DensityFunction
  readonly veinToggle: DensityFunction
  readonly veinRidged: DensityFunction
  readonly veinGap: DensityFunction
}>

export type NoiseRouterVisitor = (
  density: DensityFunction,
  channel: NoiseRouterChannel,
) => DensityFunction

export type NoiseRouterValues = Readonly<{
  readonly [channel in NoiseRouterChannel]: number
}>

const isObject = (value: unknown): value is object =>
  value !== null && typeof value === 'object'

const readRouterChannel = (
  router: unknown,
  channel: NoiseRouterChannel,
): DensityFunction => {
  if (!isObject(router)) {
    throw new TypeError('router must be an object')
  }
  const value = (router as Partial<Record<NoiseRouterChannel, unknown>>)[
    channel
  ]
  return requireDensityFunction(`router.${channel}`, value)
}

const readRouterFields = (router: unknown): NoiseRouter => {
  const fields = Object.fromEntries(
    NOISE_ROUTER_CHANNELS.map((channel) => [
      channel,
      readRouterChannel(router, channel),
    ]),
  ) as NoiseRouter
  return Object.freeze(fields)
}

export const createNoiseRouter = (router: NoiseRouter): NoiseRouter =>
  readRouterFields(router)

export const requireNoiseRouter = (router: unknown): NoiseRouter =>
  readRouterFields(router)

export const isNoiseRouter = (router: unknown): router is NoiseRouter => {
  if (!isObject(router)) {
    return false
  }
  return NOISE_ROUTER_CHANNELS.every((channel) =>
    isDensityFunction(
      (router as Partial<Record<NoiseRouterChannel, unknown>>)[channel],
    ),
  )
}

export const mapNoiseRouter = (
  router: NoiseRouter,
  visitor: NoiseRouterVisitor,
): NoiseRouter => {
  const normalizedRouter = requireNoiseRouter(router)
  if (typeof visitor !== 'function') {
    throw new TypeError('visitor must be a function')
  }
  const mapped = Object.fromEntries(
    NOISE_ROUTER_CHANNELS.map((channel) => [
      channel,
      requireDensityFunction(
        `mapped router.${channel}`,
        visitor(normalizedRouter[channel], channel),
      ),
    ]),
  ) as NoiseRouter
  return Object.freeze(mapped)
}

export const mapAllNoiseRouter = mapNoiseRouter

export type NoiseRouterRuntime = NoiseRouter & Readonly<{
  readonly mapAll: (visitor: NoiseRouterVisitor) => NoiseRouter
}>

export const createNoiseRouterRuntime = (
  routerValue: NoiseRouter,
): NoiseRouterRuntime => {
  const router = requireNoiseRouter(routerValue)
  return Object.freeze({
    ...router,
    mapAll: (visitor: NoiseRouterVisitor): NoiseRouter =>
      mapAllNoiseRouter(router, visitor),
  })
}

const isDensityEvaluationSession = (
  value: DensityEvaluationContext | DensityEvaluationSession,
): value is DensityEvaluationSession =>
  isObject(value) &&
  'evaluate' in value &&
  typeof (value as { readonly evaluate?: unknown }).evaluate === 'function'

const resolveEvaluator = (
  contextOrSession: DensityEvaluationContext | DensityEvaluationSession | undefined,
): (density: DensityFunction, position: DensityPosition) => number => {
  if (typeof contextOrSession === 'undefined') {
    return evaluateDensityFunction
  }
  if (isDensityEvaluationSession(contextOrSession)) {
    return contextOrSession.evaluate
  }
  return createDensityEvaluationSession(contextOrSession).evaluate
}

export const evaluateNoiseRouter = (
  router: NoiseRouter,
  position: DensityPosition,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): NoiseRouterValues => {
  const normalizedRouter = requireNoiseRouter(router)
  const evaluate = resolveEvaluator(contextOrSession)
  const values = {} as Record<NoiseRouterChannel, number>
  for (const channel of NOISE_ROUTER_CHANNELS) {
    values[channel] = evaluate(normalizedRouter[channel], position)
  }
  return Object.freeze(values)
}
