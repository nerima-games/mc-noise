---
'@nerima-games/mc-noise': minor
---

Add seeded Simplex noise and typed portable DensityFunction composition, bounds, and evaluation APIs.
Includes the official Shift, ShiftA, and ShiftB coordinate transforms and bounds.
Also includes portable shifted-noise-2d, noise-in-range, map, map-range, and lerp helpers.
The common official API comparison targets Minecraft Java 1.21.1, the static node set was audited against 1.21.8, and the 1.21.9 `find_top_surface` node is included. Portable NoiseRouter, Climate, and Blender contracts are included, while worldgen-context caches and configured terrain routers remain outside this package.
