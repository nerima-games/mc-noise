---
"@nerima-games/mc-noise": patch
---

Pin `@nerima-games/mc-kernel` to `0.7.0` (exact, no caret), up from `^0.4.0`. The used surface — `ChunkCoord`, `ChunkHeight`, `chunkCoord`, `CHUNK_SIZE_XZ`, `Position`, `BlockId`, `blockIdOf` — is unchanged between the two versions, so no call sites needed adaptation. The seed-to-value interface documented in `docs/versioning.md` §5 does not depend on mc-kernel at all; `test/determinism.test.ts` and `test/public-api.test.ts` were confirmed still passing with no changes to any value-producing path.
