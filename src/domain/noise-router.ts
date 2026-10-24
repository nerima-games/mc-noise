import {
  type DensityEvaluationContext,
  type DensityEvaluationSession,
  type DensityFunction,
  DensityFunctionFieldName,
  type DensityFunctionResult,
  type DensityPosition,
  type DensityValue,
} from './density-function-types.js'
import {
  createDensityEvaluationSession,
  evaluateDensityFunction,
} from './density-function-evaluator.js'
import {
  isDensityFunction,
  requireDensityFunction,
} from './density-function-validation.js'
import { Result } from 'effect'

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
  readonly [channel in NoiseRouterChannel]: DensityValue
}>

type RouterRecord = Readonly<Record<string, unknown>>

type CoreRouterFields = Pick<NoiseRouter, 'barrierNoise' | 'continents' | 'depth' | 'erosion' | 'finalDensity'>
type FluidRouterFields = Pick<
  NoiseRouter,
  'fluidLevelFloodednessNoise' | 'fluidLevelSpreadNoise' | 'initialDensityWithoutJaggedness' | 'lavaNoise'
>
type RemainingRouterFields = Pick<
  NoiseRouter,
  'ridges' | 'temperature' | 'vegetation' | 'veinGap' | 'veinRidged' | 'veinToggle'
>

const isObject = (value: unknown): value is RouterRecord =>
  value !== null && typeof value === 'object'

const isNoiseRouter = (router: unknown): router is NoiseRouter =>
  isObject(router) &&
  NOISE_ROUTER_CHANNELS.every((channel) => isDensityFunction(router[channel]))

const readRouterChannel = (
  router: unknown,
  channel: NoiseRouterChannel,
): DensityFunctionResult<DensityFunction> => {
  if (!isObject(router)) {
    return Result.fail(new TypeError('router must be an object'))
  }
  return requireDensityFunction(DensityFunctionFieldName(`router.${channel}`), router[channel])
}

const readCoreRouterFields = (router: unknown): DensityFunctionResult<CoreRouterFields> =>
  Result.gen(function* readCoreRouterFieldsResult() {
    const barrierNoise = yield* readRouterChannel(router, 'barrierNoise')
    const continents = yield* readRouterChannel(router, 'continents')
    const depth = yield* readRouterChannel(router, 'depth')
    const erosion = yield* readRouterChannel(router, 'erosion')
    const finalDensity = yield* readRouterChannel(router, 'finalDensity')
    return { barrierNoise, continents, depth, erosion, finalDensity }
  })

const readFluidRouterFields = (router: unknown): DensityFunctionResult<FluidRouterFields> =>
  Result.gen(function* readFluidRouterFieldsResult() {
    const fluidLevelFloodednessNoise = yield* readRouterChannel(router, 'fluidLevelFloodednessNoise')
    const fluidLevelSpreadNoise = yield* readRouterChannel(router, 'fluidLevelSpreadNoise')
    const initialDensityWithoutJaggedness = yield* readRouterChannel(
      router,
      'initialDensityWithoutJaggedness',
    )
    const lavaNoise = yield* readRouterChannel(router, 'lavaNoise')
    return {
      fluidLevelFloodednessNoise,
      fluidLevelSpreadNoise,
      initialDensityWithoutJaggedness,
      lavaNoise,
    }
  })

const readRemainingRouterFields = (router: unknown): DensityFunctionResult<RemainingRouterFields> =>
  Result.gen(function* readRemainingRouterFieldsResult() {
    const ridges = yield* readRouterChannel(router, 'ridges')
    const temperature = yield* readRouterChannel(router, 'temperature')
    const vegetation = yield* readRouterChannel(router, 'vegetation')
    const veinGap = yield* readRouterChannel(router, 'veinGap')
    const veinRidged = yield* readRouterChannel(router, 'veinRidged')
    const veinToggle = yield* readRouterChannel(router, 'veinToggle')
    return { ridges, temperature, vegetation, veinGap, veinRidged, veinToggle }
  })

const readRouterFields = (router: unknown): DensityFunctionResult<NoiseRouter> =>
  Result.gen(function* readRouterFieldsResult() {
    const core = yield* readCoreRouterFields(router)
    const fluid = yield* readFluidRouterFields(router)
    const remaining = yield* readRemainingRouterFields(router)
    return Object.freeze({ ...core, ...fluid, ...remaining })
  })

export const createNoiseRouter = (
  router: NoiseRouter,
): DensityFunctionResult<NoiseRouter> => readRouterFields(router)

export const requireNoiseRouter = (router: unknown): DensityFunctionResult<NoiseRouter> =>
  readRouterFields(router)

export { isNoiseRouter }

const requireVisitor = (visitor: NoiseRouterVisitor): Result.Result<NoiseRouterVisitor, TypeError> => {
  if (typeof visitor === 'function') {
    return Result.succeed(visitor)
  }
  return Result.fail(new TypeError('visitor must be a function'))
}

export const mapNoiseRouter = (
  router: NoiseRouter,
  visitor: NoiseRouterVisitor,
): DensityFunctionResult<NoiseRouter> =>
  Result.gen(function* mapNoiseRouterResult() {
    const normalizedRouter = yield* requireNoiseRouter(router)
    const mapVisitor = yield* requireVisitor(visitor)
    const map = (channel: NoiseRouterChannel): DensityFunctionResult<DensityFunction> =>
      requireDensityFunction(
        DensityFunctionFieldName(`mapped router.${channel}`),
        mapVisitor(normalizedRouter[channel], channel),
      )
    return Object.freeze({
      barrierNoise: yield* map('barrierNoise'),
      continents: yield* map('continents'),
      depth: yield* map('depth'),
      erosion: yield* map('erosion'),
      finalDensity: yield* map('finalDensity'),
      fluidLevelFloodednessNoise: yield* map('fluidLevelFloodednessNoise'),
      fluidLevelSpreadNoise: yield* map('fluidLevelSpreadNoise'),
      initialDensityWithoutJaggedness: yield* map('initialDensityWithoutJaggedness'),
      lavaNoise: yield* map('lavaNoise'),
      ridges: yield* map('ridges'),
      temperature: yield* map('temperature'),
      vegetation: yield* map('vegetation'),
      veinGap: yield* map('veinGap'),
      veinRidged: yield* map('veinRidged'),
      veinToggle: yield* map('veinToggle'),
    })
  })

export const mapAllNoiseRouter: typeof mapNoiseRouter = mapNoiseRouter

export type NoiseRouterRuntime = NoiseRouter & Readonly<{
  readonly mapAll: (visitor: NoiseRouterVisitor) => DensityFunctionResult<NoiseRouter>
}>

export const createNoiseRouterRuntime = (
  routerValue: NoiseRouter,
): DensityFunctionResult<NoiseRouterRuntime> =>
  Result.map(requireNoiseRouter(routerValue), (router) =>
    Object.freeze({
      ...router,
      mapAll: (visitor: NoiseRouterVisitor): DensityFunctionResult<NoiseRouter> =>
        mapAllNoiseRouter(router, visitor),
    }),
  )

const isDensityEvaluationSession = (
  value: DensityEvaluationContext | DensityEvaluationSession,
): value is DensityEvaluationSession =>
  isObject(value) &&
  'evaluate' in value &&
  typeof value.evaluate === 'function'

const resolveEvaluator = (
  contextOrSession: DensityEvaluationContext | DensityEvaluationSession | undefined,
): DensityFunctionResult<
  (density: DensityFunction, position: DensityPosition) => DensityFunctionResult<DensityValue>
> => {
  if (typeof contextOrSession === 'undefined') {
    return Result.succeed(evaluateDensityFunction)
  }
  if (isDensityEvaluationSession(contextOrSession)) {
    return Result.succeed(contextOrSession.evaluate)
  }
  return Result.map(createDensityEvaluationSession(contextOrSession), (session) =>
    session.evaluate,
  )
}

export const evaluateNoiseRouter = (
  router: NoiseRouter,
  position: DensityPosition,
  contextOrSession?: DensityEvaluationContext | DensityEvaluationSession,
): DensityFunctionResult<NoiseRouterValues> =>
  Result.gen(function* evaluateNoiseRouterResult() {
    const normalizedRouter = yield* requireNoiseRouter(router)
    const evaluate = yield* resolveEvaluator(contextOrSession)
    const sample = (channel: NoiseRouterChannel): DensityFunctionResult<DensityValue> =>
      evaluate(normalizedRouter[channel], position)
    return Object.freeze({
      barrierNoise: yield* sample('barrierNoise'),
      continents: yield* sample('continents'),
      depth: yield* sample('depth'),
      erosion: yield* sample('erosion'),
      finalDensity: yield* sample('finalDensity'),
      fluidLevelFloodednessNoise: yield* sample('fluidLevelFloodednessNoise'),
      fluidLevelSpreadNoise: yield* sample('fluidLevelSpreadNoise'),
      initialDensityWithoutJaggedness: yield* sample('initialDensityWithoutJaggedness'),
      lavaNoise: yield* sample('lavaNoise'),
      ridges: yield* sample('ridges'),
      temperature: yield* sample('temperature'),
      vegetation: yield* sample('vegetation'),
      veinGap: yield* sample('veinGap'),
      veinRidged: yield* sample('veinRidged'),
      veinToggle: yield* sample('veinToggle'),
    })
  })
