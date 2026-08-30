/**
 * The seeded noise field — this repository's public entry point.
 *
 * The field assembly and channel roster are part of the current public contract; terrain tuning remains versioned.
 *
 * ---------------------------------------------------------------------------
 * Seed once, sample many
 * ---------------------------------------------------------------------------
 *
 * The initial public API sketch uses `noise2d(seed, x, y, z)`, with the seed as a
 * per-call argument. That signature cannot be implemented efficiently: every
 * call would have to rebuild a 256-entry permutation table, turning an O(1)
 * sample into an O(256) one on the hottest path in world generation.
 *
 * The interface is therefore a factory — `createNoiseField(seed)` once, then
 * `field.noise2d(x, z)` per sample. The field's canonical algorithm is versioned;
 * deliberate algorithm changes are breaking changes rather than compatibility
 * modes hidden behind this factory.
 *
 * The reference implementation reached the same conclusion independently
 * (`packages/world/domain/noise-primitives.ts:235`,
 * `createNoisePrimitives(seed)`).
 *
 * ---------------------------------------------------------------------------
 * What the versioned contract obliges us to do
 * ---------------------------------------------------------------------------
 *
 * Changing any of: the PRNG, the channel salts, the permutation shuffle, the
 * fade curve, the gradient set, the amplitude scaling, or the octave
 * parameters, changes the generated terrain. Such a change must be released as
 * an intentional breaking change. Golden-value tests make accidental changes fail
 * loudly — see
 * docs/testing.md. This package exposes only the canonical kernel; consumers
 * that need reproducible saved worlds must pin the package version.
 */
import { DEFAULT_OCTAVE_PARAMS, type OctaveParams, clampSigned, normalizeNoise, octaveNoise2D, signedFbm2D } from './octaves.js'
import { NOISE_CHANNELS, type NoiseChannel, type NoiseSeed, deriveSeed, mulberry32 } from './seed.js'
import { type NoiseFn2D, type NoiseFn3D, createPerlinNoise2D, createPerlinNoise3D } from './perlin.js'

/**
 * A fully seeded set of samplers.
 *
 * `raw2d` / `raw3d` are SIGNED, approximately [-1, 1].
 * `noise2d` / `noise3d` are NORMALISED to [0, 1].
 * `channel(name)` returns a signed fBm sampler for a named terrain channel.
 *
 * The signed/normalised split is spelled out in the names on purpose: the
 * reference implementation normalised `noise2D` but not `noise3D`, and that
 * asymmetry is the sort of thing that produces a bug nobody can see.
 */
export type NoiseField = {
  readonly seed: NoiseSeed
  readonly raw2d: NoiseFn2D
  readonly raw3d: NoiseFn3D
  readonly noise2d: NoiseFn2D
  readonly noise3d: NoiseFn3D
  readonly octave2d: (x: number, z: number, params?: OctaveParams) => number
  readonly channel: (name: NoiseChannel) => NoiseFn2D
}

/** Default fBm parameters for the channels owned by this field. */
export const CHANNEL_PARAMS: Readonly<Record<NoiseChannel, OctaveParams>> = {
  base2d: DEFAULT_OCTAVE_PARAMS,
  base3d: DEFAULT_OCTAVE_PARAMS,
  continentalness: { lacunarity: 2, octaves: 4, persistence: 0.5 },
  erosion: { lacunarity: 2, octaves: 3, persistence: 0.5 },
  jaggedness: { lacunarity: 2, octaves: 1, persistence: 0.5 },
  weirdness: { lacunarity: 2, octaves: 3, persistence: 0.5 },
}

/**
 * Build every sampler for a world seed. Pure, total, and deterministic: two
 * calls with the same seed produce fields that agree at every coordinate.
 *
 * All channels are constructed eagerly. Six permutation tables is 1.5 KiB and a
 * few microseconds; making them lazy would introduce a mutable cache into a
 * value that is otherwise trivially shareable across workers.
 */
/** Signed-noise fallback for a channel name outside `NOISE_CHANNELS` — the origin of the [-1, 1] range. */
const UNKNOWN_CHANNEL_VALUE = 0

const normalizeFieldSample = (value: number): number => normalizeNoise(clampSigned(value))

export const createNoiseField = (seed: NoiseSeed): NoiseField => {
  const raw2d = createPerlinNoise2D(mulberry32(deriveSeed(seed, 'base2d')))
  const raw3d = createPerlinNoise3D(mulberry32(deriveSeed(seed, 'base3d')))

  const channels = new Map<NoiseChannel, NoiseFn2D>(
    NOISE_CHANNELS.map((name) => [
      name,
      signedFbm2D(createPerlinNoise2D(mulberry32(deriveSeed(seed, name))), CHANNEL_PARAMS[name]),
    ]),
  )

  const fallback: NoiseFn2D = () => UNKNOWN_CHANNEL_VALUE

  return {
    channel: (name) => channels.get(name) ?? fallback,
    noise2d: (x, z) => normalizeFieldSample(raw2d(x, z)),
    noise3d: (x, y, z) => normalizeFieldSample(raw3d(x, y, z)),
    octave2d: (x, z, params = DEFAULT_OCTAVE_PARAMS) => octaveNoise2D(raw2d, x, z, params),
    raw2d,
    raw3d,
    seed,
  }
}
