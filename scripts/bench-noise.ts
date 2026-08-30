/**
 * bench-noise.ts — the octave loop, measured against the rewrites it keeps being
 * offered.
 *
 * Run: `pnpm bench`. Also `--update-baseline`, `--guard-tolerance=`, `--workload-tolerance=`.
 * NOT part of `pnpm verify`: CI runs on every pull request in a public
 * repository and wall-clock there is a shared resource. See docs/testing.md.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 *
 * `domain/octaves.ts` opens with a performance exception (docs/design-notes.md N-1):
 * the octave loops are `let` + `for` and must stay that way. It lists three
 * rewrites that would lose — `Array.from(...).reduce`, `effect`'s
 * `Array.reduce`, `Effect.reduce` — and it ends:
 *
 *   "If somebody proposes replacing these loops, the answer is: benchmark
 *    first, and put the benchmark in the repository."
 *
 * Until now the repository had no benchmark, so that sentence was an IOU.
 * The design notes call this exception "established by measurement", and of the
 * five exceptions it was the one with the weakest protection — a comment, and
 * nothing else. This file discharges the IOU. Every rewrite the comment names is
 * implemented below and timed against the real thing, so a reviewer arguing for
 * a fold gets a number rather than an assertion.
 *
 * ---------------------------------------------------------------------------
 * Methodology and provenance
 * ---------------------------------------------------------------------------
 *
 * Guards use interleaved implementations with twenty warm-up rounds and nine
 * timed samples. Workloads use adjacent paired workload/yardstick samples,
 * alternate measurement order, and gate on the median of per-sample ratios.
 *
 * The workload sizes come from the same place: the reference measures per-chunk
 * terrain generation and multiplies by 81 chunks (renderDistance=4). mc-noise
 * has no notion of a chunk, so the per-chunk unit here is the 16 x 16 = 256
 * columns a chunk's worth of terrain sampling asks for. That is a real quantity
 * — `mc-worldgen`'s `generateChunk` performs exactly that many column samples —
 * and it makes the x81 load-time framing mean the same thing in both
 * repositories.
 *
 * Every fixture is seeded and deterministic. `NoiseSeed(20260726)` is a
 * constant, not a clock read.
 */
import { Array as EffectArray, Effect } from 'effect'
import {
  clampSigned,
  createNoiseField,
  DEFAULT_OCTAVE_PARAMS,
  NOISE_CHANNELS,
  NoiseSeed,
  normalizeNoise,
  octaveNoise2D,
  type NoiseFn2D,
  type OctaveParams,
} from '../src/index'
import {
  checkGuards,
  checkWorkloads,
  formatCheck,
  formatGuard,
  formatWorkload,
  guardRatio,
  measure,
  measureInterleaved,
  measurePaired,
  readBaseline,
  SHIPPED_VS_FROZEN_TOLERANCE,
  tolerancesFrom,
  wantsBaselineUpdate,
  writeBaseline,
  type Baseline,
  type Guard,
  type MeasureOptions,
  type Workload,
} from './bench-harness'

const BASELINE_PATH = new URL('./bench-baseline.json', import.meta.url).pathname

/** The reference's run count for the terrain-side workload. */
const RUNS = 9

const SEED = NoiseSeed(20260726)

/** 16 x 16 — the columns one chunk of terrain sampling asks for. */
const COLUMNS_PER_CHUNK = 256

/**
 * Samples per timed call. Large enough that the per-call timer resolution and
 * the loop overhead are both irrelevant, and a round number so the printed
 * per-sample cost is easy to reason about.
 */
const SAMPLES = 200_000

const FIELD = createNoiseField(SEED)
const BASE_NOISE: NoiseFn2D = FIELD.raw2d
const BASE_NOISE_3D = FIELD.raw3d

/**
 * Anything a measured loop computes has to be observed somewhere, or a
 * sufficiently clever JIT is entitled to delete the loop.
 */
let sink = 0

/**
 * Sample coordinates. Deterministic, irrational-ish strides so successive
 * samples land in different Perlin cells — sampling the same cell 200,000 times
 * would measure the cache and not the noise.
 */
const coordsX = new Float64Array(SAMPLES)
const coordsZ = new Float64Array(SAMPLES)
for (let index = 0; index < SAMPLES; index += 1) {
  coordsX[index] = index * 0.31830988618
  coordsZ[index] = index * 0.61803398875
}

// ---------------------------------------------------------------------------
// The yardstick
// ---------------------------------------------------------------------------

const PERMUTATION = new Uint8Array(256)
for (let index = 0; index < 256; index += 1) {
  PERMUTATION[index] = (index * 167 + 13) & 255
}

/**
 * The arithmetic shape of one Perlin sample without being one: a quintic fade
 * curve, two lerps and a byte-table lookup, repeated.
 *
 * The machine-speed reference for the `workloads` ratios. It is deliberately
 * NOT `raw2d` — that is the workload — but it is deliberately the same mix of
 * float multiply-add and small-table indexing, so a machine that is fast at one
 * is fast at the other and the quotient stays put. Not perfectly: see the
 * harness header on why workload ratios carry a looser tolerance than guard
 * ratios do.
 *
 * Sized so that one pass costs the same order as one chunk's worth of sampling.
 * A yardstick hundreds of times larger than the workload would push every
 * recorded ratio down into its last decimal place, where it is only noise.
 */
const YARDSTICK_OPS = 4096

const yardstick = (): void => {
  let total = 0
  for (let index = 0; index < YARDSTICK_OPS; index += 1) {
    const t = (index & 1023) / 1024
    const eased = t * t * t * (t * (t * 6 - 15) + 10)
    const hashed = PERMUTATION[(index + (PERMUTATION[index & 255] ?? 0)) & 255] ?? 0
    total += eased * (hashed & 3) + (1 - eased) * ((hashed >> 2) & 3)
  }
  sink += total
}

// ---------------------------------------------------------------------------
// Guard — noise-octave-loop-is-imperative (docs/design-notes.md)
// ---------------------------------------------------------------------------

/**
 * The three rewrites `domain/octaves.ts` names, written out.
 *
 * All four spellings below compute the SAME number — `octaveEquivalence` checks
 * that before any timing happens, because a benchmark of two functions that
 * disagree is a benchmark of nothing. What differs is only cost.
 */

/**
 * A frozen copy of `octaveNoise2D` as it is written today.
 *
 * This is the actual GATE, and the three rewrites below are the price list.
 * Timing the shipped function against a rewrite proves nothing on its own: the
 * ratio moves the same way whichever side changes, so if `octaveNoise2D` were
 * itself replaced by a fold, every "rewrite is Nx slower" ratio would simply
 * shrink towards 1 and could still sit inside tolerance. Timing it against a
 * frozen copy of its own current shape pins the SHIPPED function, and drops the
 * moment the shipped loop gets slower for any reason.
 *
 * The frozen copy includes the same parameter precondition as the shipped
 * function. Without that precondition, this comparison would measure the
 * validation boundary rather than the loop body it is meant to pin.
 */
const validateBenchmarkOctaveParams = (params: OctaveParams): void => {
  if (!Number.isSafeInteger(params.octaves)) {
    throw new RangeError('octaves must be a safe integer')
  }
  if (!Number.isFinite(params.persistence)) {
    throw new RangeError('persistence must be finite')
  }
  if (!Number.isFinite(params.lacunarity)) {
    throw new RangeError('lacunarity must be finite')
  }
}

const octaveNoiseFrozenImperative = (
  noiseFn: NoiseFn2D,
  x: number,
  z: number,
  params: OctaveParams,
): number => {
  validateBenchmarkOctaveParams(params)
  if (params.octaves < 1) {
    return 0.5
  }
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

/** Rewrite 1: `Array.from({length: octaves}).reduce(...)`. */
const octaveNoiseArrayFromReduce = (
  noiseFn: NoiseFn2D,
  x: number,
  z: number,
  params: OctaveParams,
): number => {
  validateBenchmarkOctaveParams(params)
  if (params.octaves < 1) {
    return 0.5
  }
  const folded = Array.from({ length: params.octaves }).reduce<{
    readonly total: number
    readonly amplitude: number
    readonly frequency: number
    readonly maxValue: number
  }>(
    (accumulator) => ({
      total: accumulator.total + noiseFn(x * accumulator.frequency, z * accumulator.frequency) * accumulator.amplitude,
      maxValue: accumulator.maxValue + accumulator.amplitude,
      amplitude: accumulator.amplitude * params.persistence,
      frequency: accumulator.frequency * params.lacunarity,
    }),
    { total: 0, amplitude: 1, frequency: 1, maxValue: 0 },
  )
  return normalizeNoise(clampSigned(folded.total / folded.maxValue))
}

/** Rewrite 2: `effect`'s own `Array.reduce`, through the module boundary. */
const octaveNoiseEffectArrayReduce = (
  noiseFn: NoiseFn2D,
  x: number,
  z: number,
  params: OctaveParams,
): number => {
  validateBenchmarkOctaveParams(params)
  if (params.octaves < 1) {
    return 0.5
  }
  const folded = EffectArray.reduce(
    EffectArray.makeBy(params.octaves, (index) => index),
    { total: 0, amplitude: 1, frequency: 1, maxValue: 0 },
    (accumulator) => ({
      total: accumulator.total + noiseFn(x * accumulator.frequency, z * accumulator.frequency) * accumulator.amplitude,
      maxValue: accumulator.maxValue + accumulator.amplitude,
      amplitude: accumulator.amplitude * params.persistence,
      frequency: accumulator.frequency * params.lacunarity,
    }),
  )
  return normalizeNoise(clampSigned(folded.total / folded.maxValue))
}

/** Rewrite 3: `Effect.reduce`, one fiber step per octave. */
const octaveNoiseEffectReduce = (noiseFn: NoiseFn2D, x: number, z: number, params: OctaveParams): number => {
  validateBenchmarkOctaveParams(params)
  if (params.octaves < 1) {
    return 0.5
  }
  const folded = Effect.runSync(
    Effect.reduce(
      EffectArray.makeBy(params.octaves, (index) => index),
      { total: 0, amplitude: 1, frequency: 1, maxValue: 0 },
      (accumulator) =>
        Effect.succeed({
          total:
            accumulator.total + noiseFn(x * accumulator.frequency, z * accumulator.frequency) * accumulator.amplitude,
          maxValue: accumulator.maxValue + accumulator.amplitude,
          amplitude: accumulator.amplitude * params.persistence,
          frequency: accumulator.frequency * params.lacunarity,
        }),
    ),
  )
  return normalizeNoise(clampSigned(folded.total / folded.maxValue))
}

type OctaveImplementation = (noiseFn: NoiseFn2D, x: number, z: number, params: OctaveParams) => number

const armOver =
  (implementation: OctaveImplementation) =>
    (): void => {
      let total = 0
      for (let index = 0; index < SAMPLES; index += 1) {
        total += implementation(
          BASE_NOISE,
          coordsX[index] ?? 0,
          coordsZ[index] ?? 0,
          DEFAULT_OCTAVE_PARAMS,
        )
      }
      sink += total
    }

/**
 * All four spellings must agree exactly before any of them is timed. Floating
 * point is associative-order-sensitive, so this is a real check and not a
 * formality: it also pins that the rewrites are faithful rather than
 * conveniently simplified.
 */
const octaveEquivalence = (): string => {
  const implementations: ReadonlyArray<readonly [string, OctaveImplementation]> = [
    ['frozen imperative copy', octaveNoiseFrozenImperative],
    ['Array.from().reduce', octaveNoiseArrayFromReduce],
    ['effect Array.reduce', octaveNoiseEffectArrayReduce],
    ['Effect.reduce', octaveNoiseEffectReduce],
  ]
  const disagreements: Array<string> = []
  for (let index = 0; index < 1024; index += 1) {
    const x = coordsX[index] ?? 0
    const z = coordsZ[index] ?? 0
    const expected = octaveNoise2D(BASE_NOISE, x, z, DEFAULT_OCTAVE_PARAMS)
    for (const [label, implementation] of implementations) {
      if (implementation(BASE_NOISE, x, z, DEFAULT_OCTAVE_PARAMS) !== expected) {
        disagreements.push(label)
      }
    }
  }
  return disagreements.length === 0
    ? 'all five spellings agree bit-for-bit over 1024 coordinates'
    : `DISAGREE: ${[...new Set(disagreements)].join(', ')} — the ratios below are meaningless`
}

// ---------------------------------------------------------------------------
// Workloads
// ---------------------------------------------------------------------------

/** One-time per seed: six permutation tables plus six pre-composed samplers. */
const buildFieldWorkload = (): void => {
  sink += createNoiseField(SEED).raw2d(0.5, 0.5)
}

/**
 * What a chunk of terrain actually asks of this repository: every channel
 * sampled once per column, 256 columns.
 *
 * The pre-composed `field.channel(name)` path, i.e. `signedFbm2D` with its
 * amplitude sum hoisted out of the closure — the spelling `domain/octaves.ts`
 * says the reference also uses. `octave2d` below is the same work WITHOUT the
 * hoist, so the pair prices the hoist itself.
 */
const CHANNEL_SAMPLERS = NOISE_CHANNELS.map((name) => FIELD.channel(name))

const chunkChannelSampling = (): void => {
  let total = 0
  for (let column = 0; column < COLUMNS_PER_CHUNK; column += 1) {
    const x = (column & 15) * 1.7
    const z = (column >> 4) * 1.7
    for (const sampler of CHANNEL_SAMPLERS) {
      total += sampler(x, z)
    }
  }
  sink += total
}

const chunkOctaveSampling = (): void => {
  let total = 0
  for (let column = 0; column < COLUMNS_PER_CHUNK; column += 1) {
    total += FIELD.octave2d((column & 15) * 1.7, (column >> 4) * 1.7)
  }
  sink += total
}

const rawSampling = (): void => {
  let total = 0
  for (let column = 0; column < COLUMNS_PER_CHUNK; column += 1) {
    total += BASE_NOISE((column & 15) * 1.7, (column >> 4) * 1.7)
  }
  sink += total
}

const raw3dSampling = (): void => {
  let total = 0
  for (let column = 0; column < COLUMNS_PER_CHUNK; column += 1) {
    total += BASE_NOISE_3D(
      (column & 15) * 1.7,
      ((column >> 4) & 15) * 0.9,
      column * 0.11,
    )
  }
  sink += total
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const options = (iterations: number, warmupIterations = iterations): MeasureOptions => ({
  iterations,
  warmupIterations,
  runs: RUNS,
})

const main = async (): Promise<number> => {
  const tolerances = tolerancesFrom(process.argv)

  console.log('mc-noise benchmark — median of 9 timed runs after warmup, per the reference implementation\n')
  console.log(`  seed:                 ${String(SEED)} (constant; nothing here reads a clock or a PRNG it did not seed)`)
  console.log(`  octave samples/arm:   ${String(SAMPLES)} at ${String(DEFAULT_OCTAVE_PARAMS.octaves)} octaves`)
  console.log(`  chunk framing:        ${String(COLUMNS_PER_CHUNK)} columns/chunk, x81 chunks at renderDistance=4\n`)
  console.log(`  equivalence check:    ${octaveEquivalence()}\n`)

  const octaveTimings = measureInterleaved(
    [
      armOver(octaveNoise2D),
      armOver(octaveNoiseFrozenImperative),
      armOver(octaveNoiseArrayFromReduce),
      armOver(octaveNoiseEffectArrayReduce),
      armOver(octaveNoiseEffectReduce),
    ],
    options(3, 20),
  )
  const imperativeMs = octaveTimings[0] ?? Number.NaN
  const frozenMs = octaveTimings[1] ?? Number.NaN
  const arrayFromMs = octaveTimings[2] ?? Number.NaN
  const effectArrayMs = octaveTimings[3] ?? Number.NaN
  const effectReduceMs = octaveTimings[4] ?? Number.NaN

  const guards: ReadonlyArray<Guard> = [
    {
      // THE GATE: shipped `octaveNoise2D` against a frozen copy of its own
      // current shape. Expected ~1.0; it drops if the shipped loop gets slower.
      name: 'octave-loop/shipped-vs-frozen-imperative',
      regression: 'noise-octave-loop-is-imperative',
      fastLabel: 'octaveNoise2D (shipped)',
      slowLabel: 'frozen let + for copy',
      fastMs: imperativeMs,
      slowMs: frozenMs,
      tolerance: SHIPPED_VS_FROZEN_TOLERANCE,
    },
    {
      name: 'octave-loop/array-from-reduce-vs-imperative',
      regression: 'noise-octave-loop-is-imperative',
      fastLabel: 'let + for',
      slowLabel: 'Array.from().reduce',
      fastMs: imperativeMs,
      slowMs: arrayFromMs,
    },
    {
      name: 'octave-loop/effect-array-reduce-vs-imperative',
      regression: 'noise-octave-loop-is-imperative',
      fastLabel: 'let + for',
      slowLabel: 'effect Array.reduce',
      fastMs: imperativeMs,
      slowMs: effectArrayMs,
    },
    {
      name: 'octave-loop/effect-reduce-vs-imperative',
      regression: 'noise-octave-loop-is-imperative',
      fastLabel: 'let + for',
      slowLabel: 'Effect.reduce',
      fastMs: imperativeMs,
      slowMs: effectReduceMs,
    },
  ]

  console.log('the performance exception of domain/octaves.ts, as interleaved A/B ratios:\n')
  for (const guard of guards) {
    console.log(formatGuard(guard))
  }
  console.log(`\n      all four protect docs/design-notes.md regression: ${guards[0]?.regression ?? ''}\n`)

  const yardstickOptions = options(2000, 4000)
  const yardstickMs = measure(yardstick, yardstickOptions)
  const measureWorkload = (run: () => void, workloadOptions: MeasureOptions): Pick<Workload, 'msPerUnit' | 'ratio'> => {
    const paired = measurePaired(yardstick, run, yardstickOptions, workloadOptions)
    return { msPerUnit: paired.slowMs, ratio: paired.ratio }
  }

  const workloads: ReadonlyArray<Workload> = [
    {
      name: 'createNoiseField',
      ...measureWorkload(buildFieldWorkload, options(200, 400)),
      unit: 'seed',
      detail: '6 permutation tables + 6 pre-composed fBm samplers; once per world, not per chunk',
    },
    {
      name: 'sample/raw2d-per-chunk-columns',
      ...measureWorkload(rawSampling, options(200, 400)),
      unit: 'chunk',
      detail: '256 single-octave Perlin samples',
    },
    {
      name: 'sample/raw3d-per-chunk-columns',
      ...measureWorkload(raw3dSampling, options(200, 400)),
      unit: 'chunk',
      detail: '256 single-octave 3D Perlin samples',
    },
    {
      name: 'sample/octave2d-per-chunk-columns',
      ...measureWorkload(chunkOctaveSampling, options(100, 200)),
      unit: 'chunk',
      detail: '256 x 4 octaves, amplitude sum recomputed per sample',
    },
    {
      name: 'sample/all-channels-per-chunk-columns',
      ...measureWorkload(chunkChannelSampling, options(50, 100)),
      unit: 'chunk',
      detail: `256 columns x ${String(NOISE_CHANNELS.length)} channels, amplitude sum hoisted`,
    },
  ]

  console.log('end-to-end workloads — paired ratios gate; absolute figures are diagnostics:\n')
  console.log(`  ${'yardstick/fade-and-table-lookup'.padEnd(44)} ${yardstickMs.toFixed(4)} ms/pass`)
  for (const workload of workloads) {
    console.log(formatWorkload(workload))
  }
  console.log('')

  if (wantsBaselineUpdate(process.argv)) {
    const recorded: Baseline = {
      version: 1,
      recordedOn: process.env['BENCH_MACHINE'] ?? 'unrecorded machine',
      note:
        'guards are interleaved slow/fast ratios measured in one process; ' +
        'workloads use adjacent paired workload/yardstick samples. Both remain environment-sensitive. ' +
        'Regenerate with `pnpm bench --update-baseline` and say in the commit message what moved and why.',
      guards: Object.fromEntries(guards.map((guard) => [guard.name, Number(guardRatio(guard).toPrecision(4))])),
      workloads: Object.fromEntries(
        workloads.map((workload) => [
          workload.name,
          Number((workload.ratio ?? workload.msPerUnit / yardstickMs).toPrecision(4)),
        ]),
      ),
    }
    await writeBaseline(BASELINE_PATH, recorded)
    console.log(`baseline written to scripts/bench-baseline.json  (sink ${sink.toFixed(3)})`)
    return 0
  }

  const baseline = await readBaseline(BASELINE_PATH)
  const results = [
    ...checkGuards(guards, baseline, tolerances.guard),
    ...checkWorkloads(workloads, yardstickMs, baseline, tolerances.workload),
  ]

  console.log(
    `baseline comparison (guard tolerance ${tolerances.guard.toFixed(2)}x, ` +
      `workload tolerance ${tolerances.workload.toFixed(2)}x):\n`,
  )
  for (const result of results) {
    console.log(formatCheck(result))
  }
  console.log('')

  const regressed = results.filter((result) => result.status === 'regressed')
  if (regressed.length > 0) {
    console.error(`${String(regressed.length)} regression(s) against scripts/bench-baseline.json.`)
    console.error('If the change is intended, re-record with `pnpm bench --update-baseline`.')
    return 1
  }

  console.log(`no regressions  (sink ${sink.toFixed(3)})`)
  return 0
}

process.exit(await main())
