/**
 * Seeds and the PRNG they drive.
 *
 * FIRST CUT (叩き台). The shape is settled; the tuning constants are not
 * (see README 現状).
 *
 * ---------------------------------------------------------------------------
 * Why the seed is branded
 * ---------------------------------------------------------------------------
 *
 * plan.md §3.2 declares the seed -> value interface FROZEN: changing it changes
 * the terrain of every world that has ever been generated, which is a
 * save-breaking change disguised as a refactor. A branded `NoiseSeed` makes the
 * boundary at which that contract is entered visible in the type system —
 * you cannot pass an arbitrary `number` to a sampler by accident.
 *
 * The seed is a uint32. It is normalised with `>>> 0` on construction so that
 * `-1`, `4294967295` and `0xFFFFFFFF` are the same seed rather than three
 * seeds, two of which behave identically by coincidence.
 *
 * ---------------------------------------------------------------------------
 * Channel decorrelation
 * ---------------------------------------------------------------------------
 *
 * A world needs several independent noise fields (continentalness, erosion,
 * weirdness, ...) from ONE user-facing seed. Deriving them by adding 1, 2, 3 to
 * the seed correlates them: mulberry32's state advances by a fixed odd
 * increment, so neighbouring seeds produce visibly related streams. The
 * reference implementation instead XORs the master seed with a distinct
 * odd 32-bit Weyl constant per channel
 * (`packages/world/domain/noise-primitives.ts:236-245`), and that is what
 * `deriveSeed` reproduces.
 */
import { Brand } from 'effect'

/** A uint32 world seed. The whole of a world's terrain is a function of this. */
export type NoiseSeed = number & Brand.Brand<'NoiseSeed'>

const UINT32_MODULUS = 4294967296

/**
 * Construct a seed from any integer. Values outside uint32 wrap rather than
 * being rejected: a seed is an opaque bit pattern, not a quantity, so wrapping
 * is meaning-preserving. Non-integers and non-finite values are rejected,
 * because `1.5` and `1.0` would silently collapse to the same seed.
 */
export const NoiseSeed = Brand.refined<NoiseSeed>(
  (value) => Number.isSafeInteger(value),
  (value) => Brand.error(`NoiseSeed must be a safe integer, received ${value}`),
)

/** Normalise an already-validated seed into the uint32 range. */
export const toUint32 = (seed: NoiseSeed): number => seed >>> 0

/**
 * A pure source of uniform values in [0, 1). Deliberately a plain closure and
 * not an `Effect`: it is called hundreds of thousands of times per chunk, and
 * it is referentially opaque by construction, so wrapping it in an effect would
 * buy nothing and cost everything.
 */
export type RandFn = () => number

/**
 * The Weyl constants used to fan one world seed out into decorrelated channels.
 *
 * Every value is odd and has a well-mixed bit pattern (they are the standard
 * golden-ratio / SHA-256 fractional constants). Adding a channel means adding a
 * key here; the existing channels keep their streams, so a new channel is a
 * semver-MINOR change rather than a world-breaking one.
 */
export const CHANNEL_SALT = {
  base2d: 0x9e3779b1,
  base3d: 0x9e3779b9,
  continentalness: 0xbb67ae85,
  erosion: 0x3c6ef372,
  weirdness: 0xa54ff53a,
  jaggedness: 0x510e527f,
} as const satisfies Readonly<Record<string, number>>

export type NoiseChannel = keyof typeof CHANNEL_SALT

export const NOISE_CHANNELS: ReadonlyArray<NoiseChannel> = Object.keys(
  CHANNEL_SALT,
) as ReadonlyArray<NoiseChannel>

/** The per-channel seed derived from a world seed. Deterministic and total. */
export const deriveSeed = (seed: NoiseSeed, channel: NoiseChannel): NoiseSeed =>
  NoiseSeed((toUint32(seed) ^ CHANNEL_SALT[channel]) >>> 0)

/**
 * mulberry32 — a 32-bit state PRNG.
 *
 * Chosen over `Math.random` for the obvious reason (it is seedable) and over a
 * cryptographic generator for the equally obvious one (this is terrain, not
 * key material, and it is on the hot path). Its period is 2^32, which is ample
 * for the few hundred draws needed to build a permutation table.
 *
 * The bit twiddling is the specification, not an optimisation — see the
 * `no-bitwise: off` note in .oxlintrc.json.
 */
export const mulberry32 = (seed: NoiseSeed): RandFn => {
  let state = toUint32(seed)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_MODULUS
  }
}
