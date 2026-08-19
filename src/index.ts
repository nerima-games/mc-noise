/**
 * @nerima-games/mc-noise — seeded deterministic noise.
 *
 * Public entrypoint for deterministic noise kernels and sampling adapters.
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

export * from './domain/field.js'
export * from './domain/octaves.js'
export * from './domain/noise-primitives.js'
export * from './domain/perlin.js'
export * from './domain/primitive-batches.js'
export * from './domain/sampling.js'
export * from './domain/sampling-3d.js'
export * from './domain/transforms.js'
export * from './domain/spline.js'
export * from './domain/terrain-channels.js'
export * from './domain/chunk-sampling.js'
export * from './domain/seed.js'
export * from './domain/value-noise.js'
