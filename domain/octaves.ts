/**
 * Octave / fBm composition.
 *
 * FIRST CUT (叩き台).
 *
 * ---------------------------------------------------------------------------
 * PERFORMANCE EXCEPTION — DO NOT "FIX" THE LOOPS BELOW (plan.md §3.2, §5.2)
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
 * and put the benchmark in the repository. See docs/design-notes.md, regression
 * `noise-octave-loop-is-imperative`.
 */
import type { NoiseFn2D } from './perlin'

/** Map a signed sample in [-1, 1] onto [0, 1]. Linear, so it preserves shape. */
export const normalizeNoise = (value: number): number => (value + 1) / 2

/** Clamp to [-1, 1]. fBm can overshoot slightly at high octave counts. */
export const clampSigned = (value: number): number => (value < -1 ? -1 : value > 1 ? 1 : value)

/**
 * Parameters of an fBm stack.
 *
 * `octaves`      how many frequency bands to sum. Cost is linear in this.
 * `persistence`  amplitude ratio between successive bands, typically 0.5.
 * `lacunarity`   frequency ratio between successive bands, typically 2.
 */
export type OctaveParams = {
  readonly octaves: number
  readonly persistence: number
  readonly lacunarity: number
}

export const DEFAULT_OCTAVE_PARAMS: OctaveParams = {
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
}

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
export const octaveNoise2D = (noiseFn: NoiseFn2D, x: number, z: number, params: OctaveParams): number => {
  if (params.octaves < 1) {
    return 0.5
  }

  // PERFORMANCE EXCEPTION — see the file header before changing this.
  let total = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0
  for (let octave = 0; octave < params.octaves; octave += 1) {
    total += noiseFn(x * frequency, z * frequency) * amplitude
    maxValue += amplitude
    amplitude *= params.persistence
    frequency *= params.lacunarity
  }

  return normalizeNoise(clampSigned(total / maxValue))
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
export const signedFbm2D = (noiseFn: NoiseFn2D, params: OctaveParams): NoiseFn2D => {
  // PERFORMANCE EXCEPTION — see the file header before changing this.
  let amplitudeSum = 0
  let amplitude = 1
  for (let octave = 0; octave < Math.max(params.octaves, 0); octave += 1) {
    amplitudeSum += amplitude
    amplitude *= params.persistence
  }

  if (amplitudeSum === 0) {
    return () => 0
  }

  const scale = 1 / amplitudeSum

  return (x, z) => {
    // PERFORMANCE EXCEPTION — see the file header before changing this.
    let total = 0
    let sampleAmplitude = 1
    let frequency = 1
    for (let octave = 0; octave < params.octaves; octave += 1) {
      total += noiseFn(x * frequency, z * frequency) * sampleAmplitude
      sampleAmplitude *= params.persistence
      frequency *= params.lacunarity
    }
    return clampSigned(total * scale)
  }
}
