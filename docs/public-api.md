# 公開 API

- 出典: plan.md §3.2 + **参照実装の実コードによる検証**
- 参照実装ルート: `<reference-impl>`（以下パスはこれ相対）

plan.md の API スケッチと参照実装の実装は一致しない箇所がある。
本書は**実コードで確認した事実**を一次資料とし、差分は理由付きで明示する。

## 1. 最重要の差分: シードは引数ではなくファクトリ

plan.md §3.2 は次のように書く:

> **主要な公開API**: `noise2d/3d(seed, x, y, z)`

**参照実装にこのシグネチャの関数は存在しない。** 実際には factory 形式である。

`packages/world/domain/noise-primitives.ts:235`:

```typescript
export const createNoisePrimitives = (seed: number): NoisePrimitives => {
```

`noise-primitives.ts:215-230`（`noise2D` / `noise3D` は自由関数ではなくメンバ）:

```typescript
export type NoisePrimitives = Readonly<{
  raw2D: NoiseFn2D
  raw3D: NoiseFn3D
  continentalness: NoiseFn2D
  erosion: NoiseFn2D
  weirdness: NoiseFn2D
  jaggedness: NoiseFn2D
  noise2D: (x: number, z: number) => number
  octaveNoise2D: (x: number, z: number, octaves: number, persistence: number, lacunarity: number) => number
  noise3D: (x: number, y: number, z: number) => number
  continentalnessAt: (x: number, z: number) => number
  erosionAt: (x: number, z: number) => number
  weirdnessAt: (x: number, z: number) => number
  jaggednessAt: (x: number, z: number) => number
  sampleTerrainChannels: (xStart: number, zStart: number) => TerrainChannelSamples
}>
```

### なぜ factory でなければならないか

`noise2d(seed, x, y, z)` は**実装できない**。シードから 256 エントリの permutation table を
作るのは O(256) であり、これを 1 サンプルごとに行うと O(1) のサンプリングが O(256) になる。
これはワールド生成で最も熱いパスである。

**凍結の対象は変わらない。** 凍結されているのは「(seed, 座標) → 値」の写像であって、
その写像のカリー化のしかたではない。両者は同じ写像である。

本リポジトリの対応物（`domain/field.ts`）:

```typescript
export const createNoiseField = (seed: NoiseSeed): NoiseField
export const createIsotropicNoiseField = (seed: NoiseSeed): NoiseField
```

`createNoiseField` は保存済みworld向けのlegacy 4勾配写像を維持する。
`createIsotropicNoiseField` は `raw2d`、`noise2d`、`octave2d`、全channelへ8勾配
isotropic kernelを一貫して適用する新規world向けAPIである。`raw3d` / `noise3d` は共通の
3D kernelを使う。どちらを選んだかはworld metadataへ保存すること。

## 2. 型

### `NoiseSeed`（`domain/seed.ts`）

```typescript
export type NoiseSeed = number & Brand.Brand<'NoiseSeed'>
export const NoiseSeed: Brand.Brand.Constructor<NoiseSeed>   // safe integer を要求
export const toUint32 = (seed: NoiseSeed): number
```

参照実装のシードは素の `number` である（`createNoisePrimitives(seed: number)`）。
本リポジトリでは branded にした。plan.md §3.2 が「凍結扱い」と宣言している契約に入る境界は、
型で見えているべきだからである。

uint32 への正規化（`>>> 0`）により `-1` / `4294967295` / `0xFFFFFFFF` は同じシードになる。
参照実装も `mulberry32` 内で `s = seed >>> 0` している（`noise-primitives.ts:16`）。

### `RandFn` / `NoiseFn2D` / `NoiseFn3D`

参照実装 `noise-primitives.ts:6-9` と**同一**:

```typescript
export type RandFn = () => number
export type NoiseFn2D = (x: number, z: number) => number
export type NoiseFn3D = (x: number, y: number, z: number) => number
```

`Effect` ではなく素のクロージャなのは意図的である。チャンクあたり数十万回呼ばれ、
構成上参照透明なので、effect でくるむ利益がゼロでコストだけが残る。

## 3. PRNG とシード分岐

### `mulberry32`

参照実装 `noise-primitives.ts:15-23`（原文）:

```typescript
export const mulberry32 = (seed: number): RandFn => {
  let s = seed >>> 0
  return () => {
    let t = (s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

本リポジトリの `domain/seed.ts` はこれと**同じアルゴリズム**を実装する（引数が branded になっただけ）。

### チャンネル分岐（`deriveSeed`）

参照実装 `noise-primitives.ts:236-245`:

```typescript
  const raw2D = createPerlinNoise2D(mulberry32(seed))
  const raw3D = createPerlinNoise3D(mulberry32((seed ^ WEYL_3D) >>> 0))
  const continentalness = signedFbm2D(createPerlinNoise2D(mulberry32((seed ^ WEYL_C) >>> 0)), 4, 0.5, 2.0, 1.4)
  const erosion = signedFbm2D(createPerlinNoise2D(mulberry32((seed ^ WEYL_E) >>> 0)), 3, 0.5, 2.0, 1.3)
  const weirdness = signedFbm2D(createPerlinNoise2D(mulberry32((seed ^ WEYL_W) >>> 0)), 3, 0.5, 2.0, 1.3)
  const jaggedness = createPerlinNoise2D(mulberry32((seed ^ WEYL_J) >>> 0))
```

定数（`noise-primitives.ts:33-37`）: `WEYL_C = 0x9e3779b1`, `WEYL_E = 0xbb67ae85`,
`WEYL_W = 0x3c6ef372`, `WEYL_J = 0xa54ff53a`, `WEYL_3D = 0x9e3779b9`。

**シードに 1, 2, 3 を足して分岐してはならない。** mulberry32 の状態は固定の奇数で進むので、
隣接シードは目に見えて相関したストリームを出す。XOR + Weyl 定数はそれを避けるための構造である。

本リポジトリ（`domain/seed.ts`）:

```typescript
export const CHANNEL_SALT: {
  base2d: number; base3d: number
  continentalness: number; erosion: number; weirdness: number; jaggedness: number
}
export type NoiseChannel = keyof typeof CHANNEL_SALT
export const NOISE_CHANNELS: ReadonlyArray<NoiseChannel>
export const deriveSeed = (seed: NoiseSeed, channel: NoiseChannel): NoiseSeed
```

参照実装の 5 定数のうち 4 つは値をそのまま引き継いだ（`base2d` は参照実装では salt なしだが、
一貫性のため `WEYL_C` と同じ値を割り当てた）。`jaggedness` だけは
`0x510e527f`（SHA-256 の別の小数部定数）に変えてある。理由: 参照実装の `WEYL_J = 0xa54ff53a` は
他の定数と混ぜたときに `base2d` と衝突しやすい配置ではないが、
本リポジトリは salt を 6 個に増やしたので独立な定数を追加した。
`test/public-api.test.ts` がこの 6 値を固定している。

## 4. Perlin カーネル

参照実装 `packages/world/domain/perlin.ts:41, 75`:

```typescript
export const createPerlinNoise2D = (rand?: RandFn): NoiseFn2D => {
export const createPerlinNoise3D = (rand?: RandFn): NoiseFn3D => {
```

**本リポジトリでは `rand` を必須にした。**

参照実装の `rand?` は `Math.random` にフォールバックする（`perlin.ts:42`, `:76`）。
これは決定論の穴である —— 引数を 1 つ書き忘れると、型エラーも失敗テストもなしに
**ロードのたびに違う地形**が出る。参照実装にはそのパスを通るテストすらある
（`perlin.test.ts:67`, `:108`）。必須にすればこのバグ全体がコンパイルエラーになる。

本リポジトリ（`domain/perlin.ts`）:

```typescript
export const PERMUTATION_SIZE = 256
export const buildPermutation = (rand: RandFn): Uint8Array
export const createPerlinNoise2D = (rand: RandFn): NoiseFn2D
export const createPerlinNoise2DIsotropic = (rand: RandFn): NoiseFn2D
export const createPerlinNoise3D = (rand: RandFn): NoiseFn3D
```

`createPerlinNoise2D` は4対角勾配を使うlegacyカーネルであり、保存済みworldとの互換性のため
seed→値を維持する。`createPerlinNoise2DIsotropic` は8つの単位勾配（軸4 + 対角4）を使う
opt-inカーネルで、半整数座標の退化と方向バイアスを抑える。新規worldで採用する場合は、
再生成時にも同じカーネルを選べるようカーネル識別子を保存すること。

permutation table は Fisher-Yates で作る。参照実装 `perlin.ts:6-17`:

```typescript
// Fisher-Yates shuffle using the provided PRNG
const buildPerm = (rand: RandFn): Uint8Array => {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = p[i]!
    p[i] = p[j]!
    p[j] = tmp
  }
  return p
}
```

## 5. オクターブ / fBm

参照実装 `noise-primitives.ts:74-81` / `:105-111`:

```typescript
export const computeOctaveNoise = (
  noiseFn: NoiseFn2D,
  x: number,
  z: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
): number => {

export const signedFbm2D = (
  noiseFn: NoiseFn2D,
  octaves: number,
  persistence: number,
  lacunarity: number,
  boost: number,
): NoiseFn2D => {
```

本リポジトリ（`domain/octaves.ts`）は、参照実装互換の位置引数版と、通常のフィールド利用向けの
レコード版を用途で分けて公開する。バッチ API の引数は位置引数をタプル型で共有する。

```typescript
export type OctaveParams = {
  readonly octaves: number
  readonly persistence: number
  readonly lacunarity: number
}
export type OctaveParameters = readonly [
  octaves: number,
  persistence: number,
  lacunarity: number,
]
export type OctaveNoiseArguments = readonly [
  x: number,
  z: number,
  ...octaveParameters: OctaveParameters,
]
export const DEFAULT_OCTAVE_PARAMS: OctaveParams
export const normalizeNoise = (value: number): number
export const clampSigned = (value: number): number
export const computeOctaveNoise = (
  noiseFn: NoiseFn2D,
  x: number,
  z: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
): number
export const octaveNoise2D = (noiseFn: NoiseFn2D, x: number, z: number, params: OctaveParams): number
export const signedFbm2D = (noiseFn: NoiseFn2D, params: OctaveParams, boost?: number): NoiseFn2D
```

`octaves` は安全整数、`persistence` と `lacunarity` は有限値でなければならない。
`octaves <= 0` の退化挙動は維持される。`computeOctaveNoise` は 0、レコード版の
`octaveNoise2D` は正規化された 0.5 を返す。違反した値はループ開始前に `RangeError` になる。

`boost` は維持している。参照実装では `signedFbm2D` の 5 番目の引数で、
`scale = boost / maxValue` として掛かる（`noise-primitives.ts:119`）。
これはチャンネルごとの**チューニング値**（continentalness は 1.4、erosion / weirdness は 1.3）であり、
`createNoisePrimitives` がこの値を適用する。単独の `signedFbm2D` でも明示的に指定できる。

### Value noise API

`domain/value-noise.ts` は、worldgen の地形・バイオーム用に決定論的な連続値ノイズを提供する。
`channelSeed` と `latticeValue` は同じ seed と座標から常に同じ値を返し、`valueNoise2D` は
smoothstep 補間で格子点を補間する。`fbm2D` は `ValueNoiseFbmOptions` で octaves・frequency・
persistence をまとめて受け取る。

`valueNoise2D` の `frequency` と `ValueNoiseFbmOptions` の連続値は有限値でなければならず、
`octaves` は安全整数でなければならない。違反した値は `RangeError` になる。

### Piecewise-linear spline API

地形の制御点データを持たない汎用の区分線形スプラインを提供する。
`createSpline` は入力座標と値が有限で、入力座標が厳密に単調増加していることを検証し、
制御点と配列を凍結する。`evaluateSpline` は空のスプラインを `0` として扱い、範囲外では
端点へクランプし、範囲内では隣接する制御点を線形補間する。静的な配列を直接渡す場合も、
この契約を満たすデータを使用する。

```typescript
export type ControlPoint = readonly [input: number, value: number]
export type Spline = ReadonlyArray<ControlPoint>
export const createSpline = (controlPoints: Spline): Spline
export const evaluateSpline = (spline: Spline, input: number): number
```

## 6. `NoiseField`（本リポジトリの入口）

```typescript
export type NoiseField = {
  readonly seed: NoiseSeed
  readonly raw2d: NoiseFn2D      // 符号付き、およそ [-1, 1]
  readonly raw3d: NoiseFn3D      // 符号付き、およそ [-1, 1]
  readonly noise2d: NoiseFn2D    // 正規化 [0, 1]
  readonly noise3d: NoiseFn3D    // 正規化 [0, 1]
  readonly octave2d: (x: number, z: number, params?: OctaveParams) => number   // [0, 1]
  readonly channel: (name: NoiseChannel) => NoiseFn2D                          // 符号付き [-1, 1]
}
export const createNoiseField = (seed: NoiseSeed): NoiseField
export const createIsotropicNoiseField = (seed: NoiseSeed): NoiseField
export const CHANNEL_PARAMS: Readonly<Record<NoiseChannel, OctaveParams>>
```

## 7. 値域 —— 参照実装の非対称性と、本リポジトリの是正

参照実装の値域は関数ごとにバラバラである（実測）:

| 関数 | 値域 | 根拠 |
| --- | --- | --- |
| `createPerlinNoise2D(...)` 生出力 | 符号付き ≈`[-1, 1]` | `perlin.ts:39` `AMPLITUDE_SCALE = Math.SQRT2` を `:56` で適用 |
| `createPerlinNoise3D(...)` 生出力 | 符号付き ≈`[-1, 1]` | `perlin.ts:66` `AMPLITUDE_SCALE_3D = Math.sqrt(3)` を `:106` で適用 |
| `normalizeNoise(v)` | `[-1,1]` → `[0,1]` | `noise-primitives.ts:29-30` |
| `primitives.noise2D` | `[0, 1]` | `noise-primitives.ts:254` = `normalizeNoise(raw2D(...))` |
| **`primitives.noise3D`** | **符号付き。正規化されない** | `noise-primitives.ts:257` = `raw3D(...)` の素通し |
| `computeOctaveNoise` | `[0, 1]` | `:93` `normalizeNoise(total / maxValue)` |
| `signedFbm2D` | ハードクランプ `[-1, 1]` | `:129` `return v < -1 ? -1 : v > 1 ? 1 : v` |
| `peaksAndValleysFromWeirdness(w)` | `[-1, 1]`（`w ∈ [-1, 1]` の場合） | `src/domain/transforms.ts`。参照式は `noise-primitives.ts:48` |

**`noise2D` は正規化されるのに `noise3D` はされない。** これは誰にも見えないバグを生む種類の非対称である。

本リポジトリは名前で区別する: `raw2d`/`raw3d` は符号付き、`noise2d`/`noise3d` は `[0, 1]`、
`channel(...)` は符号付き（スプラインの定義域が `[-1, 1]` だから）。
`test/octaves.test.ts` の「noise2d and noise3d are normalised into [0, 1]; raw2d and raw3d are not」が
これを保持する。

`peaksAndValleysFromWeirdness` は入力を暗黙に clamp しないため、`w` が `[-1, 1]` の外側では
出力値域も `[-1, 1]` に限定されない。

### `octaveNoise2D` の退化ケース

参照実装は `octaves < 1` のとき **0** を返す（`noise-primitives.ts:82`）。
本リポジトリは **0.5**（中点）を返す。
値域が `[0, 1]` である以上 0 は正当な極値であり、退化パラメータが「最も深い谷」と
区別できないのは下流にとって危険だからである。`design-notes.md` に記録。

## 8. plan.md には無いが必要だったもの

| 追加 | 理由 |
| --- | --- |
| `clampSigned` | fBm は高オクターブで `[-1, 1]` をわずかに超える。参照実装は `signedFbm2D` 内にインラインで持っていたが、`octaveNoise2D` 側にはなかった |
| `signedFbm2D` の 0 オクターブ保護 | `amplitudeSum` が 0 になり `0/0 = NaN`。NaN が地形生成に漏れると、どこから来たか分からない虚空のチャンクになる |
| `NOISE_CHANNELS` / `CHANNEL_SALT` の公開 | ゴールデンテストが salt を固定できるようにするため |

## 9. 参照実装由来の移管範囲と未移管範囲

| 項目 | 参照実装の場所 | 扱い |
| --- | --- | --- |
| `peaksAndValleysFromWeirdness`（peaks and valleys 変換） | `noise-primitives.ts:48` | **移管済み**。地形固有の意味論から独立した純粋変換として `src/domain/transforms.ts` に配置 |
| `NoisePrimitives` / `createNoisePrimitives` | `noise-primitives.ts:215-268` | **移管済み**。`src/domain/noise-primitives.ts` に raw / normalized noise、チャンネル、`...At`、チャンクサンプルを集約 |
| terrain channel サンプル | `noise-primitives.ts:140-213` | **移管済み**。`src/domain/terrain-channels.ts` で 2 刻みの疎グリッドを 16×16 へ双線形展開 |
| primitive batch helper 5 種 | `noise-primitives.ts:270-334` | **移管済み**。`src/domain/primitive-batches.ts` に座標配列・点配列 API を配置 |
| `spline.ts` | `packages/world/domain/` | **移管済み**。地形データを持たない区分線形評価を `src/domain/spline.ts` に配置 |
| `terrain-splines.ts` | `packages/world/domain/` | mc-worldgen の責務。地形固有の制御点データであり、`mc-noise` へ移管しない |

`createNoisePrimitives(seed)` は、参照実装の構成要素を再利用可能な束として返す。
`sampleTerrainChannels(xStart, zStart)` は continentalness / erosion / peaks-and-valleys /
jaggedness の 4 配列を 16×16 で返す。これは地形の式そのものではなく、mc-worldgen が
密度関数やスプラインへ渡すポータブルな材料である。

参照実装に相当する汎用サンプリングは、本リポジトリで次の API として公開済みである。

| API | 実装 | 契約 |
| --- | --- | --- |
| `sampleNoise2DBatch` / `sampleNoise3DBatch` | `src/domain/sampling.ts` / `src/domain/sampling-3d.ts` | 明示した座標を一括評価 |
| `sampleNoise2DGrid` / `sampleNoise3DGrid` | 同上 | 原点・幅・刻みを持つ密な格子を `Float32Array` で返す |
| `sampleNoise2DInterpolatedGrid` | `src/domain/sampling.ts` | 疎な格子を双線形補間し、評価回数を抑える |
| `sampleNoise3DInterpolatedGrid` | `src/domain/sampling-3d-interpolation.ts`（`sampling-3d.ts` から再公開） | 疎な格子を三線形補間し、評価回数を抑える |
| `sampleNoise2DChunk` / `sampleNoise3DChunk` | `src/domain/chunk-sampling.ts` | `mc-kernel` の `ChunkCoord` / `ChunkHeight` をサンプル領域へ変換 |

### Simplex と DensityFunction

| API | 実装 | 契約 |
| --- | --- | --- |
| `createSimplexNoise2D` / `createSimplexNoise3D` | `src/domain/simplex.ts` | Minecraft の初期化順に従うシード付き 2D / 3D Simplex ノイズ。原点は既定でシードから生成し、明示値は有限値を検証 |
| `densityConstant` / `densityCoordinate` / `densityNoise` | `src/domain/density-function.ts` | immutable な定数・座標・ノイズノード |
| `densityShift` / `densityShiftA` / `densityShiftB` / `densityShiftedNoise` | `src/domain/density-function.ts` | 公式の Shift 系を含むシフト値付き portable ノイズノード。Shift / ShiftA / ShiftB は入力座標を 1/4 にして結果を 4 倍する |
| `densityShiftedNoise2D` / `densityNoiseInRange` / `densityMappedNoise` | `src/domain/density-function.ts` | 2D shifted noise（Y シフトなし）と、ノイズ値を指定範囲へ写像する公式 overload 相当 |
| `densityLinearOperation` | `src/domain/density-function.ts` | 公式の加算・乗算による線形 DensityFunction ノード |
| `densityWeirdScaledSampler` | `src/domain/density-function.ts` | 評価値から公式の rarity 倍率を選び、座標をスケールしてサンプルするノード |
| `densityEndIslands` | `src/domain/density-function.ts` | seed と signed 32-bit X/Z 座標から End Islands の密度を評価するノード |
| `densityMap` / `densityMapRange` / `densityLerp` | `src/domain/density-function.ts` | 公式の map・mapRange・lerp に対応する純粋な写像・範囲変換・線形補間 |
| `densityAdd` / `densityMul` / `densityMin` / `densityMax` | `src/domain/density-function.ts` | 二項演算と保守的な境界値 |
| `densityAbs` / `densitySquare` / `densityCube` / `densitySqueeze` など | `src/domain/density-function.ts` | 単項演算と保守的な境界値 |
| `densityClamp` / `densityRangeChoice` / `densityYClampedGradient` / `densitySpline` | `src/domain/density-function-spatial.ts` | 空間分岐・勾配・汎用スプラインノード |
| `evaluateDensityFunction` / `densityBounds` | `src/domain/density-function-evaluator.ts` / `density-function-bounds.ts` | `mc-kernel` の `Position` を受け、値と `[minValue, maxValue]` を返す |

これらは Minecraft Java 1.21.1 の `DensityFunctions` を照合基準にした、ワールド固有の設定を
含まない portable API である。portable な `NoiseRouter` / `Climate` / `Blender` の構造・評価
ヘルパも公開する。`interpolated`、`flatCache`、`cache2d`、`cacheOnce`、`cacheAllInCell`、
`blendDensity`、`blendAlpha`、`blendOffset` は、DensityFunction の context-aware なノードとして
`DensityEvaluationContext` / `DensityEvaluationSession` とともに公開する。セル幅・高さと blend
callback は呼び出し側が context に与える。設定済みの NoiseRouter、キャッシュのライフサイクル、
地形定数・制御点などワールド固有の統合は mc-worldgen の責務である。`mapFromUnitTo` と
`mapRange` は公式では private な補助ファクトリであり、公開 API では `densityMapRange` が
その範囲変換を担う。
