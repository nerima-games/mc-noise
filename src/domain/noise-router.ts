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

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object'

const isNoiseRouter = (router: unknown): router is NoiseRouter =>
  isObject(router) &&
  NOISE_ROUTER_CHANNELS.every((channel) => isDensityFunction(router[channel]))

const readRouterChannel = (
  router: unknown,
  channel: NoiseRouterChannel,
): DensityFunction => {
  if (!isObject(router)) {
    throw new TypeError('router must be an object')
  }
  const value = router[channel]
  return requireDensityFunction(`router.${channel}`, value)
}

const readRouterFields = (router: unknown): NoiseRouter => Object.freeze({
    barrierNoise: readRouterChannel(router, 'barrierNoise'),
    continents: readRouterChannel(router, 'continents'),
    depth: readRouterChannel(router, 'depth'),
    erosion: readRouterChannel(router, 'erosion'),
    finalDensity: readRouterChannel(router, 'finalDensity'),
    fluidLevelFloodednessNoise: readRouterChannel(router, 'fluidLevelFloodednessNoise'),
    fluidLevelSpreadNoise: readRouterChannel(router, 'fluidLevelSpreadNoise'),
    initialDensityWithoutJaggedness: readRouterChannel(router, 'initialDensityWithoutJaggedness'),
    lavaNoise: readRouterChannel(router, 'lavaNoise'),
    ridges: readRouterChannel(router, 'ridges'),
    temperature: readRouterChannel(router, 'temperature'),
    vegetation: readRouterChannel(router, 'vegetation'),
    veinGap: readRouterChannel(router, 'veinGap'),
    veinRidged: readRouterChannel(router, 'veinRidged'),
    veinToggle: readRouterChannel(router, 'veinToggle'),
  })


export const createNoiseRouter = (router: NoiseRouter): NoiseRouter =>
  readRouterFields(router)

export const requireNoiseRouter = (router: unknown): NoiseRouter =>
  readRouterFields(router)

export { isNoiseRouter }

export const mapNoiseRouter = (
  router: NoiseRouter,
  visitor: NoiseRouterVisitor,
): NoiseRouter => {
  const normalizedRouter = requireNoiseRouter(router)
  if (typeof visitor !== 'function') {
    throw new TypeError('visitor must be a function')
  }
  const map = (channel: NoiseRouterChannel): DensityFunction =>
    requireDensityFunction(
      `mapped router.${channel}`,
      visitor(normalizedRouter[channel], channel),
    )
  return Object.freeze({
    barrierNoise: map('barrierNoise'),
    continents: map('continents'),
    depth: map('depth'),
    erosion: map('erosion'),
    finalDensity: map('finalDensity'),
    fluidLevelFloodednessNoise: map('fluidLevelFloodednessNoise'),
    fluidLevelSpreadNoise: map('fluidLevelSpreadNoise'),
    initialDensityWithoutJaggedness: map('initialDensityWithoutJaggedness'),
    lavaNoise: map('lavaNoise'),
    ridges: map('ridges'),
    temperature: map('temperature'),
    vegetation: map('vegetation'),
    veinGap: map('veinGap'),
    veinRidged: map('veinRidged'),
    veinToggle: map('veinToggle'),
  })
}

export const mapAllNoiseRouter: typeof mapNoiseRouter = mapNoiseRouter

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
  'evaluate' in value && typeof value.evaluate === 'function'

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
  const sample = (channel: NoiseRouterChannel): number =>
    evaluate(normalizedRouter[channel], position)
  return Object.freeze({
    barrierNoise: sample('barrierNoise'),
    continents: sample('continents'),
    depth: sample('depth'),
    erosion: sample('erosion'),
    finalDensity: sample('finalDensity'),
    fluidLevelFloodednessNoise: sample('fluidLevelFloodednessNoise'),
    fluidLevelSpreadNoise: sample('fluidLevelSpreadNoise'),
    initialDensityWithoutJaggedness: sample('initialDensityWithoutJaggedness'),
    lavaNoise: sample('lavaNoise'),
    ridges: sample('ridges'),
    temperature: sample('temperature'),
    vegetation: sample('vegetation'),
    veinGap: sample('veinGap'),
    veinRidged: sample('veinRidged'),
    veinToggle: sample('veinToggle'),
  })
}
