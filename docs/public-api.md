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
```

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
export const createPerlinNoise3D = (rand: RandFn): NoiseFn3D
```

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

本リポジトリ（`domain/octaves.ts`）はパラメータ 3 つを 1 つのレコードにまとめた。
位置引数 3 つ（`octaves, persistence, lacunarity`）は呼び出し側で取り違えても型が通るためである。

```typescript
export type OctaveParams = {
  readonly octaves: number
  readonly persistence: number
  readonly lacunarity: number
}
export const DEFAULT_OCTAVE_PARAMS: OctaveParams
export const normalizeNoise = (value: number): number
export const clampSigned = (value: number): number
export const octaveNoise2D = (noiseFn: NoiseFn2D, x: number, z: number, params: OctaveParams): number
export const signedFbm2D = (noiseFn: NoiseFn2D, params: OctaveParams): NoiseFn2D
```

`boost` は落とした。参照実装では `signedFbm2D` の 5 番目の引数で、
`scale = boost / maxValue` として掛かる（`noise-primitives.ts:119`）。
これはチャンネルごとの**チューニング値**（continentalness は 1.4、erosion / weirdness は 1.3）であり、
凍結対象のノイズ関数ではなく地形調整に属する。掛けたい側が掛ければよい。

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
| `toPV(w)` | `[-1, 1]` | `:48` |

**`noise2D` は正規化されるのに `noise3D` はされない。** これは誰にも見えないバグを生む種類の非対称である。

本リポジトリは名前で区別する: `raw2d`/`raw3d` は符号付き、`noise2d`/`noise3d` は `[0, 1]`、
`channel(...)` は符号付き（スプラインの定義域が `[-1, 1]` だから）。
`test/octaves.test.ts` の「noise2d and noise3d are normalised into [0, 1]; raw2d and raw3d are not」が
これを保持する。

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

## 9. 参照実装にあって本リポジトリにまだ無いもの

| 項目 | 参照実装の場所 | 扱い |
| --- | --- | --- |
| `toPV`（peaks and valleys 変換） | `noise-primitives.ts:48` | mc-worldgen 寄り。地形の形の話なので保留 |
| `computeTerrainChannels`（疎グリッド + 双線形補間） | `noise-primitives.ts:143-150` | 性能最適化。ベンチマークを先に用意してから |
| バッチヘルパ 5 種 | `noise-primitives.ts:270-334` | 同上 |
| `spline.ts` / `terrain-splines.ts` | `packages/world/domain/` | mc-worldgen の責務（`responsibility.md` §3.1） |
| Simplex ノイズ | 存在しない | plan.md は「Perlin/Simplex系」と書くが参照実装に無い |
