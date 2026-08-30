# @nerima-games/mc-noise

## 0.3.0

### Minor Changes

- [#16](https://github.com/nerima-games/mc-noise/pull/16) [`ef3ee08`](https://github.com/nerima-games/mc-noise/commit/ef3ee08cf84b3d3098d5c36cf4fcadeadb4c7118) Thanks [@takeokunn](https://github.com/takeokunn)! - Add seeded Simplex noise and typed portable DensityFunction composition, bounds, and evaluation APIs.
  Includes the official Shift, ShiftA, and ShiftB coordinate transforms and bounds.
  Also includes portable shifted-noise-2d, noise-in-range, map, map-range, and lerp helpers.
  The common official API comparison targets Minecraft Java 1.21.1, the static node set was audited against 1.21.8, and the 1.21.9 `find_top_surface` node is included. Portable NoiseRouter, Climate, and Blender contracts are included, while worldgen-context caches and configured terrain routers remain outside this package.

- [#16](https://github.com/nerima-games/mc-noise/pull/16) [`3ca2b67`](https://github.com/nerima-games/mc-noise/commit/3ca2b67759dacd50d32fa4588f791bc55c182930) Thanks [@takeokunn](https://github.com/takeokunn)! - Add portable Minecraft climate, biome, terrain-column, lake, water-level, and surface-material definitions without chunk or block-state mutation.

- [#16](https://github.com/nerima-games/mc-noise/pull/16) [`ad819b8`](https://github.com/nerima-games/mc-noise/commit/ad819b8dcc945d65b08e930fb46265824691bd89) Thanks [@takeokunn](https://github.com/takeokunn)! - Add portable 3D/grid/chunk sampling, piecewise-linear spline evaluation, and the peaks-and-valleys transform to the public noise API, with deterministic reference coverage and package-boundary verification.

### Patch Changes

- [#17](https://github.com/nerima-games/mc-noise/pull/17) [`e25be83`](https://github.com/nerima-games/mc-noise/commit/e25be83404275498139d9f092d3aa1db8e1bcbbb) Thanks [@takeokunn](https://github.com/takeokunn)! - Toolchain frozen to org pin set (TypeScript 7.0.2, vitest 4.1.11, effect 3.22.1, node 24, pnpm 11.24.0); build switched to tsc emit; release workflow added
