# API lock — @nerima-games/mc-noise

<!-- ------------------------------------------------------------------------- -->
<!-- GENERATED FILE. Do not edit by hand.                                      -->
<!--                                                                           -->
<!-- Regenerate with `pnpm api:update`. `pnpm api:check`, which `pnpm verify`  -->
<!-- runs, fails when this file is stale.                                      -->
<!--                                                                           -->
<!-- Every line below is part of the published surface of this package. A diff -->
<!-- here is a diff in what consumers can see, and is the thing plan.md §6     -->
<!-- Step 0-3 asks to be reviewed as a diff. See scripts/api-lock.ts for how   -->
<!-- it is produced and why it is produced this way.                           -->
<!-- ------------------------------------------------------------------------- -->

format: 1
exported declarations: 24
supporting declarations: 0

## Exported

### CHANNEL_PARAMS  `const`

```ts
const CHANNEL_PARAMS: Readonly<Record<NoiseChannel, OctaveParams>>;
```

### CHANNEL_SALT  `const`

```ts
const CHANNEL_SALT: {
    readonly base2d: 2654435761;
    readonly base3d: 2654435769;
    readonly continentalness: 3144134277;
    readonly erosion: 1013904242;
    readonly weirdness: 2773480762;
    readonly jaggedness: 1359893119;
};
```

### DEFAULT_OCTAVE_PARAMS  `const`

```ts
const DEFAULT_OCTAVE_PARAMS: OctaveParams;
```

### NOISE_CHANNELS  `const`

```ts
const NOISE_CHANNELS: ReadonlyArray<NoiseChannel>;
```

### NoiseChannel  `type`

```ts
type NoiseChannel = keyof typeof CHANNEL_SALT;
```

### NoiseField  `type`

```ts
type NoiseField = {
    readonly seed: NoiseSeed;
    readonly raw2d: NoiseFn2D;
    readonly raw3d: NoiseFn3D;
    readonly noise2d: NoiseFn2D;
    readonly noise3d: NoiseFn3D;
    readonly octave2d: (x: number, z: number, params?: OctaveParams) => number;
    readonly channel: (name: NoiseChannel) => NoiseFn2D;
};
```

### NoiseFn2D  `type`

```ts
type NoiseFn2D = (x: number, z: number) => number;
```

### NoiseFn3D  `type`

```ts
type NoiseFn3D = (x: number, y: number, z: number) => number;
```

### NoiseSeed  `const`

```ts
const NoiseSeed: Brand.Brand.Constructor<NoiseSeed>;
```

### NoiseSeed  `type`

```ts
type NoiseSeed = number & Brand.Brand<'NoiseSeed'>;
```

### OctaveParams  `type`

```ts
type OctaveParams = {
    readonly octaves: number;
    readonly persistence: number;
    readonly lacunarity: number;
};
```

### PERMUTATION_SIZE  `const`

```ts
const PERMUTATION_SIZE = 256;
```

### RandFn  `type`

```ts
type RandFn = () => number;
```

### buildPermutation  `const`

```ts
const buildPermutation: (rand: RandFn) => Uint8Array;
```

### clampSigned  `const`

```ts
const clampSigned: (value: number) => number;
```

### createNoiseField  `const`

```ts
const createNoiseField: (seed: NoiseSeed) => NoiseField;
```

### createPerlinNoise2D  `const`

```ts
const createPerlinNoise2D: (rand: RandFn) => NoiseFn2D;
```

### createPerlinNoise3D  `const`

```ts
const createPerlinNoise3D: (rand: RandFn) => NoiseFn3D;
```

### deriveSeed  `const`

```ts
const deriveSeed: (seed: NoiseSeed, channel: NoiseChannel) => NoiseSeed;
```

### mulberry32  `const`

```ts
const mulberry32: (seed: NoiseSeed) => RandFn;
```

### normalizeNoise  `const`

```ts
const normalizeNoise: (value: number) => number;
```

### octaveNoise2D  `const`

```ts
const octaveNoise2D: (noiseFn: NoiseFn2D, x: number, z: number, params: OctaveParams) => number;
```

### signedFbm2D  `const`

```ts
const signedFbm2D: (noiseFn: NoiseFn2D, params: OctaveParams) => NoiseFn2D;
```

### toUint32  `const`

```ts
const toUint32: (seed: NoiseSeed) => number;
```
