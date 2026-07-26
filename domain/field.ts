/**
 * The seeded noise field — this repository's public entry point.
 *
 * FIRST CUT (叩き台). The channel roster is provisional; the *shape* is not.
 *
 * ---------------------------------------------------------------------------
 * Seed once, sample many
 * ---------------------------------------------------------------------------
 *
 * plan.md §3.2 sketches the API as `noise2d(seed, x, y, z)`, with the seed as a
 * per-call argument. That signature cannot be implemented efficiently: every
 * call would have to rebuild a 256-entry permutation table, turning an O(1)
 * sample into an O(256) one on the hottest path in world generation.
 *
 * The interface is therefore a factory — `createNoiseField(seed)` once, then
 * `field.noise2d(x, z)` per sample. The FROZEN CONTRACT of plan.md §3.2 is
 * unaffected by this: what is frozen is the mapping from (seed, coordinate) to
 * value, and that mapping is identical either way. Only the currying changes.
 *
 * The reference implementation reached the same conclusion independently
 * (`packages/world/domain/noise-primitives.ts:235`,
 * `createNoisePrimitives(seed)`).
 *
 * ---------------------------------------------------------------------------
 * What "frozen" obliges us to do
 * ---------------------------------------------------------------------------
 *
 * Changing any of: the PRNG, the channel salts, the permutation shuffle, the
 * fade curve, the gradient set, the amplitude scaling, or the octave
 * parameters, changes the terrain of every existing world. Such a change is a
 * MAJOR version bump AND needs a save-format migration story from mc-save. It
 * is not a refactor. Golden-value tests exist to make an accidental one fail
 * loudly — see docs/testing.md.
 */
import { DEFAULT_OCTAVE_PARAMS, normalizeNoise, octaveNoise2D, signedFbm2D, type OctaveParams } from './octaves'
import { createPerlinNoise2D, createPerlinNoise3D, type NoiseFn2D, type NoiseFn3D } from './perlin'
import { deriveSeed, mulberry32, NOISE_CHANNELS, type NoiseChannel, type NoiseSeed } from './seed'

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

/** Default fBm parameters per terrain channel. Provisional; see README 現状. */
export const CHANNEL_PARAMS: Readonly<Record<NoiseChannel, OctaveParams>> = {
  base2d: DEFAULT_OCTAVE_PARAMS,
  base3d: DEFAULT_OCTAVE_PARAMS,
  continentalness: { octaves: 4, persistence: 0.5, lacunarity: 2 },
  erosion: { octaves: 3, persistence: 0.5, lacunarity: 2 },
  weirdness: { octaves: 3, persistence: 0.5, lacunarity: 2 },
  jaggedness: { octaves: 1, persistence: 0.5, lacunarity: 2 },
}

/**
 * Build every sampler for a world seed. Pure, total, and deterministic: two
 * calls with the same seed produce fields that agree at every coordinate.
 *
 * All channels are constructed eagerly. Six permutation tables is 1.5 KiB and a
 * few microseconds; making them lazy would introduce a mutable cache into a
 * value that is otherwise trivially shareable across workers.
 */
export const createNoiseField = (seed: NoiseSeed): NoiseField => {
  const raw2d = createPerlinNoise2D(mulberry32(deriveSeed(seed, 'base2d')))
  const raw3d = createPerlinNoise3D(mulberry32(deriveSeed(seed, 'base3d')))

  const channels = new Map<NoiseChannel, NoiseFn2D>(
    NOISE_CHANNELS.map((name) => [
      name,
      signedFbm2D(createPerlinNoise2D(mulberry32(deriveSeed(seed, name))), CHANNEL_PARAMS[name]),
    ]),
  )

  const fallback: NoiseFn2D = () => 0

  return {
    seed,
    raw2d,
    raw3d,
    noise2d: (x, z) => normalizeNoise(raw2d(x, z)),
    noise3d: (x, y, z) => normalizeNoise(raw3d(x, y, z)),
    octave2d: (x, z, params = DEFAULT_OCTAVE_PARAMS) => octaveNoise2D(raw2d, x, z, params),
    channel: (name) => channels.get(name) ?? fallback,
  }
}
