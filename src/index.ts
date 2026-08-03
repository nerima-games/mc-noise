/**
 * @nerima-games/mc-noise — seeded deterministic noise.
 *
 * FIRST CUT (叩き台). See README.md 現状.
 *
 * A tier-1 stable library (plan.md §2.2): pure functions, a narrow interface,
 * and a change frequency that should approach zero. Everything here is a
 * function of (seed, coordinate) and of nothing else — no services, no clock,
 * no I/O, no platform.
 *
 * THE SEED -> VALUE MAPPING IS A FROZEN CONTRACT (plan.md §3.2). Changing it
 * regenerates the terrain of every world that has ever been saved. See
 * docs/versioning.md before touching a constant in domain/.
 */

export * from './domain/field'
export * from './domain/octaves'
export * from './domain/perlin'
export * from './domain/seed'
export * from './domain/value-noise'
