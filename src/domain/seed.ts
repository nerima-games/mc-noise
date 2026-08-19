/**
 * Seeds and the PRNG they drive.
 *
 * The seed mapping is a versioned contract; channel tuning is documented separately
 * because it changes generated terrain when intentionally revised.
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
 * The seed accepts any safe integer at the public boundary. It is normalised
 * with `>>> 0` at PRNG and derived-seed boundaries so that `-1`,
 * `4294967295` and `0xFFFFFFFF` produce the same uint32 stream.
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
/** Shift distance of zero: `>>> UINT32_COERCION_SHIFT` forces the uint32 bit pattern without moving any bits. */
const UINT32_COERCION_SHIFT = 0

/** Coerce a number to its uint32 bit pattern via an unsigned right shift by zero. */
const asUint32 = (value: number): number => value >>> UINT32_COERCION_SHIFT

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
export const toUint32 = (seed: NoiseSeed): number => asUint32(seed)

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
  jaggedness: 0x510e527f,
  weirdness: 0xa54ff53a,
} as const satisfies Readonly<Record<string, number>>

export type NoiseChannel = keyof typeof CHANNEL_SALT

export const NOISE_CHANNELS: ReadonlyArray<NoiseChannel> = Object.keys(
  CHANNEL_SALT,
) as ReadonlyArray<NoiseChannel>

/** The per-channel seed derived from a world seed. Deterministic and total. */
export const deriveSeed = (seed: NoiseSeed, channel: NoiseChannel): NoiseSeed =>
  NoiseSeed(asUint32(toUint32(seed) ^ CHANNEL_SALT[channel]))

/**
 * The mulberry32 PRNG — a 32-bit state generator.
 *
 * Chosen over `Math.random` for the obvious reason (it is seedable) and over a
 * cryptographic generator for the equally obvious one (this is terrain, not
 * key material, and it is on the hot path). Its period is 2^32, which is ample
 * for the few hundred draws needed to build a permutation table.
 *
 * The bit twiddling is the specification, not an optimisation — see the
 * `no-bitwise: off` note in .oxlintrc.json. The constants below (the state
 * increment and the shift/mask pairs) are mulberry32's own fixed reference
 * constants, not tunable parameters: changing any of them produces a
 * different (and unvalidated) generator, not a faster mulberry32.
 */
const MULBERRY32_STATE_INCREMENT = 0x6d2b79f5
const MULBERRY32_SHIFT_A = 15
const MULBERRY32_ODD_MASK = 1
const MULBERRY32_SHIFT_B = 7
const MULBERRY32_MIX_MASK = 61
const MULBERRY32_SHIFT_C = 14

export const mulberry32 = (seed: NoiseSeed): RandFn => {
  let state = toUint32(seed)
  return () => {
    state = asUint32(state + MULBERRY32_STATE_INCREMENT)
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> MULBERRY32_SHIFT_A), mixed | MULBERRY32_ODD_MASK)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> MULBERRY32_SHIFT_B), mixed | MULBERRY32_MIX_MASK)
    return asUint32(mixed ^ (mixed >>> MULBERRY32_SHIFT_C)) / UINT32_MODULUS
  }
}
