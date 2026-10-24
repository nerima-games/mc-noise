/**
 * Octave / fBm composition.
 *
 *
 * ---------------------------------------------------------------------------
 * PERFORMANCE EXCEPTION — DO NOT "FIX" THE LOOPS BELOW (docs/design-notes.md N-1)
 * ---------------------------------------------------------------------------
 *
 * The octave loops are written with `let` + `for`. That is deliberate and it is
 * load-bearing. They thread four scalars (total, amplitude, frequency,
 * maxValue) across a handful of iterations on the hottest path in world
 * generation — the reference implementation runs this per column per chunk.
 *
 * The idiomatic Effect-flavoured rewrites all lose:
 *
 *   - `Array.from({length: octaves}).reduce(...)` allocates an array and a
 *     closure per call, and forces the accumulator into a heap object because
 *     four values do not fit a single reduce parameter without a tuple.
 *   - `ReadonlyArray.reduce` from `effect` has the same problem plus a call
 *     through the module boundary.
 *   - `Effect.reduce` additionally allocates one fiber step per octave.
 *
 * None of these change the result; all of them change the cost, on a path where
 * cost is the entire point. The reference implementation carries the same
 * exemption with the same reasoning at
 * `packages/world/domain/noise-primitives.ts:82-93` and `:112-130`, and its own
 * lint config disables `no-plusplus` for it.
 *
 * This is not an argument against Effect. It is an argument that the boundary
 * of the effect system belongs at the edge of this module, not inside its
 * inner loop. Everything a caller can observe is pure and total.
 *
 * If somebody proposes replacing these loops, the answer is: benchmark first,
 * and put the benchmark in the repository. THE BENCHMARK IS NOW IN THE
 * REPOSITORY — `scripts/bench-noise.ts`, run with `pnpm bench`. Every rewrite
 * named above is implemented there and timed against this loop. The benchmark
 * uses seeded input, interleaved A/B timing, twenty warm-up rounds, and nine
 * timed samples. Its committed ratios are guard inputs, not portable machine
 * claims; see docs/design-notes.md, regression
 * `noise-octave-loop-is-imperative`, and docs/testing.md §7.
 */
import { Brand, Result } from 'effect'
import type { NoiseFn2D } from './perlin.js'
import type { PositionAxis } from '@nerima-games/mc-kernel/domain/coordinates'

/** Coordinate-space bounds every signed noise sample must land within. */
const SIGNED_MIN = -1
const SIGNED_MAX = 1
/** The signed value with no directional signal — normalization maps it to the midpoint of [0, 1]. */
const NEUTRAL_SIGNED_VALUE = 0
const NORMALIZED_MIN = 0
const NORMALIZED_MAX = 1

export type BoundedNoise = number & Brand.Brand<'BoundedNoise'>
export const BoundedNoise: Brand.Constructor<BoundedNoise> = Brand.make<BoundedNoise>(
  (value) =>
    (Number.isFinite(value) && value >= SIGNED_MIN && value <= SIGNED_MAX) ||
    'noise value must be finite and within [-1, 1]',
)

export type NormalizedNoise = number & Brand.Brand<'NormalizedNoise'>
export const NormalizedNoise: Brand.Constructor<NormalizedNoise> = Brand.make<NormalizedNoise>(
  (value) =>
    (Number.isFinite(value) && value >= NORMALIZED_MIN && value <= NORMALIZED_MAX) ||
    'normalized noise must be finite and within [0, 1]',
)

export type NoiseAccumulator = number & Brand.Brand<'NoiseAccumulator'>
export const NoiseAccumulator: Brand.Constructor<NoiseAccumulator> = Brand.make<NoiseAccumulator>(
  (value) => Number.isFinite(value) || 'noise accumulator must be finite',
)

const normalizeNoiseValue = (value: number): number =>
  (value - SIGNED_MIN) / (SIGNED_MAX - SIGNED_MIN)

const clampSignedValue = (value: number): number => {
  if (value < SIGNED_MIN) {
    return SIGNED_MIN
  }
  if (value > SIGNED_MAX) {
    return SIGNED_MAX
  }
  return value
}

const makeNormalizedNoise = (value: number): Result.Result<NormalizedNoise, RangeError> =>
  Result.mapError(
    NormalizedNoise.result(value),
    (error) => new RangeError(error.message),
  )

/** Map a signed sample in [-1, 1] onto [0, 1]. Linear, so it preserves shape. */
export const normalizeNoise = (value: BoundedNoise): NormalizedNoise =>
  NormalizedNoise(normalizeNoiseValue(value))

/** Clamp a finite octave sum to [-1, 1]. fBm can overshoot slightly at high octave counts. */
export const clampSigned = (value: NoiseAccumulator): BoundedNoise =>
  BoundedNoise(clampSignedValue(value))

/**
 * Parameters of an fBm stack.
 *
 * `octaves`      how many frequency bands to sum. Cost is linear in this.
 * `persistence`  amplitude ratio between successive bands, typically 0.5.
 * `lacunarity`   frequency ratio between successive bands, typically 2.
 */
export type OctaveCount = number & Brand.Brand<'OctaveCount'>
export const OctaveCount: Brand.Constructor<OctaveCount> = Brand.make<OctaveCount>(
  (value) => Number.isSafeInteger(value) || 'octave count must be a safe integer',
)

export type OctaveAmplitude = number & Brand.Brand<'OctaveAmplitude'>
export const OctaveAmplitude: Brand.Constructor<OctaveAmplitude> = Brand.make<OctaveAmplitude>(
  (value) => Number.isFinite(value) || 'octave amplitude must be finite',
)

export type OctaveFrequency = number & Brand.Brand<'OctaveFrequency'>
export const OctaveFrequency: Brand.Constructor<OctaveFrequency> = Brand.make<OctaveFrequency>(
  (value) => Number.isFinite(value) || 'octave frequency must be finite',
)

export type OctaveParams = {
  readonly octaves: OctaveCount
  readonly persistence: OctaveAmplitude
  readonly lacunarity: OctaveFrequency
}

export type OctaveParameters = readonly [
  octaves: OctaveCount,
  persistence: OctaveAmplitude,
  lacunarity: OctaveFrequency,
]

export type OctaveNoiseArguments = readonly [
  x: PositionAxis,
  z: PositionAxis,
  ...octaveParameters: OctaveParameters,
]

const DEFAULT_LACUNARITY = 2
const DEFAULT_OCTAVE_COUNT = 4
const DEFAULT_PERSISTENCE = 0.5

export const DEFAULT_OCTAVE_PARAMS: OctaveParams = {
  lacunarity: OctaveFrequency(DEFAULT_LACUNARITY),
  octaves: OctaveCount(DEFAULT_OCTAVE_COUNT),
  persistence: OctaveAmplitude(DEFAULT_PERSISTENCE),
}

/** Fewer octaves than this is a degenerate request — see `octaveNoise2D`'s doc comment on why that returns the midpoint, not 0. */
const MIN_OCTAVES = 1
/** Positional octave composition uses this sentinel when no bands are requested. */
const NO_OCTAVE_SENTINEL = 0
/** How far an octave-loop counter advances per iteration, everywhere in this file. */
const OCTAVE_STEP = 1
/** `signedFbm2D` clamps a negative octave request to this floor before summing amplitudes. */
const MIN_OCTAVE_COUNT = 0
/** An amplitude sum equal to this means every octave in the stack had zero amplitude. */
const ZERO_AMPLITUDE_SUM = 0
/** Target total signed amplitude after `signedFbm2D`'s per-sample scale factor is applied. */
const UNIT_AMPLITUDE = 1

/**
 * Sum `octaves` bands of `noiseFn` and normalise into [0, 1].
 *
 * Returns exactly 0.5 — the midpoint, not 0 — when `octaves < 1`, because the
 * function's codomain is [0, 1] and 0 is a legitimate extreme value there. A
 * degenerate parameter must not be indistinguishable from a real trough.
 *
 * NOTE: this differs from the reference, which returns 0 in that case
 * (`noise-primitives.ts:82`). The reference's choice makes "no octaves" read as
 * "deepest possible valley" downstream. Recorded in docs/design-notes.md.
 *
 * Division by `maxValue` — the sum of the amplitudes actually used, not the
 * geometric-series limit — is what keeps the result in range for any
 * persistence, including persistence >= 1.
 */
export const octaveNoise2D = (
  noiseFn: NoiseFn2D,
  x: PositionAxis,
  z: PositionAxis,
  params: OctaveParams,
): Result.Result<NormalizedNoise, RangeError> => {
  if (params.octaves < MIN_OCTAVES) {
    return Result.succeed(NormalizedNoise(normalizeNoiseValue(NEUTRAL_SIGNED_VALUE)))
  }

  // PERFORMANCE EXCEPTION — see the file header before changing this.
  // The four accumulators below share one statement to stay under `max-statements` without touching the loop itself.
  let total = 0,
    amplitude = 1,
    frequency = 1,
    maxValue = 0
  for (let octave = 0; octave < params.octaves; octave += OCTAVE_STEP) {
    total += noiseFn(x * frequency, z * frequency) * amplitude
    maxValue += amplitude
    amplitude *= params.persistence
    frequency *= params.lacunarity
  }

  return makeNormalizedNoise(normalizeNoiseValue(clampSignedValue(total / maxValue)))
}

/**
 * Sum positional octave parameters and return a normalized [0, 1] sample.
 *
 * This form matches the portable Minecraft-facing primitive API. Unlike
 * octaveNoise2D, a request with no octaves returns 0 to preserve that API's
 * established sentinel semantics.
 */
export const computeOctaveNoise = (
  ...args: readonly [noiseFn: NoiseFn2D, ...OctaveNoiseArguments]
): Result.Result<NormalizedNoise, RangeError> => {
  const [noiseFn, x, z, octaves, persistence, lacunarity] = args
  if (octaves < MIN_OCTAVES) {
    return Result.succeed(NormalizedNoise(NO_OCTAVE_SENTINEL))
  }

  // PERFORMANCE EXCEPTION — see the file header before changing this.
  let total = 0,
    frequency = 1,
    amplitude = 1,
    maxValue = 0
  for (
    let octave = 0;
    octave < octaves;
    octave += OCTAVE_STEP, amplitude *= persistence, frequency *= lacunarity
  ) {
    total += noiseFn(x * frequency, z * frequency) * amplitude
    maxValue += amplitude
  }

  return makeNormalizedNoise(normalizeNoiseValue(total / maxValue))
}

/**
 * Pre-compose an fBm sampler that stays SIGNED, in [-1, 1].
 *
 * Terrain splines are defined over [-1, 1], so the terrain channels must not be
 * normalised to [0, 1] on the way in. Keeping a signed variant is what stops a
 * caller from "helpfully" normalising and silently halving the spline's domain.
 *
 * The amplitude-sum loop is hoisted OUT of the returned closure: it depends
 * only on `params`, so paying for it per sample would be pure waste. The
 * reference does the same (`noise-primitives.ts:112-118`).
 */
export const signedFbm2D = (noiseFn: NoiseFn2D, params: OctaveParams, boost: OctaveAmplitude = OctaveAmplitude(UNIT_AMPLITUDE)): NoiseFn2D => {
  // PERFORMANCE EXCEPTION — see the file header before changing this.
  let amplitudeSum = 0
  let amplitude = 1
  for (let octave = 0; octave < Math.max(params.octaves, MIN_OCTAVE_COUNT); octave += OCTAVE_STEP) {
    amplitudeSum += amplitude
    amplitude *= params.persistence
  }

  if (amplitudeSum === ZERO_AMPLITUDE_SUM) {
    return () => NEUTRAL_SIGNED_VALUE
  }

  const scale = boost / amplitudeSum

  return (x, z) => {
    // PERFORMANCE EXCEPTION — see the file header before changing this.
    let total = 0
    let sampleAmplitude = 1
    let frequency = 1
    for (let octave = 0; octave < params.octaves; octave += OCTAVE_STEP) {
      total += noiseFn(x * frequency, z * frequency) * sampleAmplitude
      sampleAmplitude *= params.persistence
      frequency *= params.lacunarity
    }
    return clampSignedValue(total * scale)
  }
}
