# 設計注意と回帰テスト

参照実装と現行コードの「設計注意」を、証拠（file:line）付きで展開し、
**それぞれを名前付き回帰テストとして**書き下したもの。

各項目の見出しにある `code` 名がテスト名である。ソース側のコメントからも同じ名前で参照している。

---

## N-1 `noise-octave-loop-is-imperative`

### 初期責務の記述

> **設計注意**: オクターブループは `let` + `for` を維持（参照実装で実測確定したパフォーマンス例外。状態スレッドを配列foldに「修正」しない）

### 参照実装の証拠

`packages/world/domain/noise-primitives.ts:82-93`:

```typescript
  if (octaves < 1) return 0
  let total = 0
  let frequency = 1
  let amplitude = 1
  let maxValue = 0
  for (let i = 0; i < octaves; i++) {
    total += noiseFn(x * frequency, z * frequency) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }
  return normalizeNoise(total / maxValue)
```

`noise-primitives.ts:112-130`（`signedFbm2D`。振幅和ループがクロージャの**外**に巻き上げてある）:

```typescript
  let maxValue = 0
  let amp = 1
  for (let i = 0; i < octaves; i++) {
    maxValue += amp
    amp *= persistence
  }
  const scale = boost / maxValue
  return (x, z) => {
    let total = 0
    let amplitude = 1
    let frequency = 1
    for (let i = 0; i < octaves; i++) {
      total += noiseFn(x * frequency, z * frequency) * amplitude
      amplitude *= persistence
      frequency *= lacunarity
    }
    const v = total * scale
    return v < -1 ? -1 : v > 1 ? 1 : v
  }
```

同種の判断が明文化されている箇所:

- `packages/world/application/noise-service.ts:66-69`:
  `// Hot loop: kept as 'for' to match the previous performance ... The loop body stays imperative for throughput.`
- `packages/world/application/noise-service.ts:26-29`:
  ``// `let` here, not `Ref`: the surrounding methods are all `Effect.sync` / closures over this binding...``
- lint 側の許可: `.oxlintrc.json:190` に `"no-plusplus": "off"`

### なぜ「修正」してはいけないのか

スカラー 4 個（total / amplitude / frequency / maxValue）を数回のイテレーションで
スレッドしているだけである。慣用的な書き換えはすべて**結果を変えずにコストだけを変える**:

| 書き換え | 増えるコスト |
| --- | --- |
| `Array.from({length: octaves}).reduce(...)` | 配列 1 個 + クロージャ 1 個/呼び出し。かつ 4 値が 1 引数に入らないのでタプル（ヒープ）になる |
| `ReadonlyArray.reduce`（effect） | 上に加えてモジュール境界の呼び出し |
| `Effect.reduce` | さらにオクターブごとに fiber step 1 個 |

これは Effect への反対論ではない。**effect system の境界はこのモジュールの縁に置くべきであって、
内側のループに置くべきではない**という主張である。呼び出し側から観測できるものはすべて純粋かつ全域である。

### 回帰テスト

`test/octaves.test.ts`:

- `a constant kernel collapses to exactly the normalised constant, whatever the parameters`
  —— `total/maxValue` は振幅加重平均なので、定数入力は不変でなければならない。
  アキュムレータと正規化子が代数的に整合していることの検査であり、
  「賢い」書き換えが最初に壊すのはここである。
- `adding octaves changes the result — the loop really iterates`
- `stays inside [0, 1] for every parameter combination the API permits`
  —— `persistence >= 1` を意図的に含める。幾何級数の極限ではなく**実際の振幅和**で
  割っていることが、そこで値域を保つ理由だから。

### ベンチマーク（`pnpm bench`）—— 借用書は清算済み

**「先にベンチマークを書き、それをリポジトリに入れろ」——それが `scripts/bench-noise.ts` である。**
上の表に載っている 3 つの書き換えはすべてその場に実装してあり、出荷版と並べて計測される。
5 つの綴りが 1024 座標でビット単位一致することを計測前に確認したうえで、guard は同一プロセス内で
実装順をローテーションしながら交互に計測する。20 回の warm-up と 9 サンプルを使うため、単純な
実装順固定より共有ノイズを減らせるが、ホストと JIT に依存する点は変わらない。

ゲート本体は `octave-loop/shipped-vs-frozen-imperative`——出荷版を
**その現在の形の凍結コピー**と比べる guard である。workload は yardstick と各処理を同じサンプル内で
交互に測り、サンプルごとの比の中央値を使う。`scripts/bench-baseline.json` の数値は現行方式で保持する
保守的な履歴基準であり、Node や特定ハードウェアの普遍的な性能値ではない。詳細と計測手法は
`testing.md` §7。

---

## N-2 `noise-determinism-same-seed`

### 初期責務の記述

> **主要な公開API**: ... **seed→値のインターフェースは凍結扱い**（変更 = 全ワールドの地形が変わる破壊的変更）
>
> **検証**: プロパティテスト（決定論・値域・連続性）+ シード固定のゴールデン値

### 参照実装の証拠

- `packages/world/test/noise-service.property.test.ts` P-03: 固定シードでの決定論、100 runs、seed ∈ [0, 4294967295]
- `packages/world/test/terrain-determinism.test.ts:22`:
  `it('same seed + coord → byte-identical chunk (save/reload reproducibility)')`
- ただし **リテラルなゴールデン値は参照実装にコミットされていない**。
  シード固定のゴールデン値は参照実装には存在せず、本リポジトリで新規に作る資産である。

### 回帰テスト

`test/determinism.test.ts`:

- `same seed and same coordinate produce exactly the same value, bit for bit`
  —— `===` ではなく `Object.is` で比較する。`-0` と `0` の差は `===` を通り抜けて
  後からゴールデン値テストを壊すからである。
- `determinism holds for the 3D kernel, the normalised wrappers and the octave stack too`
- `every named channel is deterministic under its seed`
- `two fields built from one seed do not share mutable state, so sampling order cannot matter`
  —— サンプリング順を変えて突き合わせる。可変キャッシュが混入したら落ちる。
- `different seeds disagree somewhere — a constant field would pass every determinism test`
  —— 決定論テストは定数関数でも通ることへの防御。

`test/public-api.test.ts`:

- `reproduces its golden samples exactly` —— インラインスナップショットのゴールデン値。
- `pins the channel salts, because changing one re-rolls that channel for every world`

---

## N-3 `noise-determinism-required-prng`

### 参照実装の証拠（バグの証拠）

`packages/world/domain/perlin.ts:41` および `:75`:

```typescript
export const createPerlinNoise2D = (rand?: RandFn): NoiseFn2D => {
export const createPerlinNoise3D = (rand?: RandFn): NoiseFn3D => {
```

`rand` 省略時は `Math.random` にフォールバックする（`perlin.ts:42`, `:76`）。
参照実装にはそのパスを通るテストまである（`perlin.test.ts:67`, `:108`）。

### 何が問題か

引数を 1 つ書き忘れると、**型エラーもテスト失敗もなしに**、ロードのたびに違う地形が出る。
決定論を宣言しているリポジトリに、決定論を静かに壊す既定値がある。

### 対処

`domain/perlin.ts` では `rand: RandFn` を**必須**にした。このバグ全体がコンパイルエラーになる。

### 回帰テスト

型レベルで保証されるので実行時テストはない。`pnpm typecheck` が守る。
`test/determinism.test.ts` の全プロパティが実質的な傍証になる。

---

## N-4 `noise-determinism-channel-decorrelation`

### 参照実装の証拠

`packages/world/domain/noise-primitives.ts:236-245`。
マスターシードをチャンネルごとに異なる奇数 32bit Weyl 定数と XOR している（`public-api.md` §3 に引用）。

### なぜ加算ではいけないか

mulberry32 の状態は固定の奇数増分（`0x6d2b79f5`）で進む。
`seed + 1` / `seed + 2` は目に見えて相関したストリームを出し、
地形では「continentalness と erosion が同じ形をしている」という形で現れる。

### 回帰テスト

`test/determinism.test.ts`:

- `channels derived from one seed are decorrelated, not adjacent streams`
  —— 6 チャンネルの派生シードが全て相異なり、かつ同一座標でのサンプル値も全て相異なることを検査。

---

## N-5 `noise-octave-degenerate-params`

### 参照実装との差分

参照実装 `noise-primitives.ts:82` は `octaves < 1` で **0** を返す。

`computeOctaveNoise` の値域は `[0, 1]` なので、0 は「最も深い谷」を意味する正当な値である。
つまり参照実装では「オクターブ 0」と「最深の谷」が下流から区別できない。

### 対処

本リポジトリの `octaveNoise2D` は **0.5**（中点）を返す。

同様に `signedFbm2D` は `octaves <= 0` のとき定数 0 を返す。
参照実装ではこのとき `maxValue = 0` になり `boost / 0 = Infinity`、
掛けた結果が `NaN` になる。**NaN が地形生成に漏れると、原因の痕跡を残さず虚空のチャンクになる。**

### 回帰テスト

`test/octaves.test.ts`:

- `returns the midpoint 0.5 for a degenerate octave count, never the extreme 0`
- `degenerates to the constant 0 rather than to NaN when there are no octaves`

---

## N-6 `noise-signed-fbm-stays-signed`

### 根拠

地形スプラインの定義域は `[-1, 1]` である。
参照実装のコメント `noise-primitives.ts:102-104` が明示している
（fBm を符号付きのまま保つ理由は「the [-1,1] spline domain」）。

チャンネル出力を「親切に」`[0, 1]` に正規化すると、スプラインの定義域が静かに半分になる。

### 回帰テスト

`test/octaves.test.ts`:

- `stays signed and inside [-1, 1], because terrain splines are defined over [-1, 1]`
- `actually produces negative values, so "signed" is not vacuously true`
  —— 「符号付き」が空虚に真になるのを防ぐ。

---

## N-7 `noise-spatial-continuity`

### 参照実装の証拠

`packages/world/test/noise-service.property.test.ts` P-04:
`|noise2d(x+0.01, z) - noise2d(x, z)| < 0.1`（200 runs）。
参照実装で唯一の Lipschitz 的な境界。

### なぜ値域テストでは足りないか

permutation table のインデックス計算や fade 曲線が壊れると、値域は保たれたまま
**ノイズが不連続になる**（地形にタイル状の段差が出る）。連続性は最初に壊れる性質であり、
値域チェックは気づかない。

### 回帰テスト

`test/octaves.test.ts`:

- `is spatially continuous: a small step in x produces a small step in the value`

---

## N-8 `noise-half-integer-gradient-degeneracy`（canonical kernel の設計根拠）

### 事実

2D Perlin が 4 つの対角勾配 `{(1,1), (-1,1), (1,-1), (-1,-1)}` だけを使うと、
オフセットがちょうど `±0.5` のとき各コーナーの内積は `{-1, 0, 1}` にしか落ちず、
`fade(0.5)` はちょうど `0.5` なので、結果はその 4 値の**単純平均**になる。
これがちょうど 0 になる頻度が、偶然では説明できないほど高い。

この現象は、ブロック中心を直接サンプルするワールドで格子状のアーティファクトに
なる。現行の `test/public-api.test.ts` は、canonical kernel が半整数格子で十分な
値の多様性を保つことを固定している。

### 影響

影響の小さい順に:

1. ゴールデンサンプルを `.5` で取ってはいけない（実際、最初に書いたゴールデン値の
   いくつかは 0 や 0.5 になり無意味だった）。
2. `.5` でサンプルしたオクターブスタックは第 1 オクターブに退化する。
   より高い周波数はすべて整数格子に乗るからである。
3. **ブロック中心は `.5` である。** 「ブロック中心でノイズをサンプルする」という
   素直な呼び出し方をすると、地形に格子状のアーティファクトが見える。

### 対処

現行の 2D Perlin kernel は、軸 4 方向と正規化した対角 4 方向からなる 8 勾配を均等に
選ぶ。これにより半整数格子の高頻度なゼロ退化と方向バイアスを抑える。canonical
kernel への変更は意図的な seed → 値の契約変更として反映済みであり、別 kernel を
選ぶための公開 API や保存形式は設けない。

### 回帰テスト

`test/public-api.test.ts`:

- `keeps half-integer samples varied with the canonical gradient set`
  —— canonical 勾配集合を変えると値の分布が変わるため、契約変更のレビューが必要になる。
- `is exactly 0 at every lattice point, which is what gradient noise means`
  —— 整数格子で 0 になるのは正常（構造的事実）。ここが落ちたら勾配ノイズではなく値ノイズになっている。

`test/perlin-isotropic.test.ts`:

- canonical 2D/3D Perlin の決定性、256セル周期、実用値域を固定する。
- 半整数サンプルがゼロへ退化しないことを固定する。
- 軸方向と対角方向で方向微分の平均二乗値を比較し、方向別の統計的偏りを検出する。

---

## 参照実装の数値の訂正

初期資料には参照実装の実測値がいくつか書かれているが、**再検証したところ一致しないものがある**。
本リポジトリでは検証済みの値を使う。詳細は `porting.md` を参照。

| 初期資料の記述 | 実測 |
| --- | --- |
| `SEA_LEVEL=48` | **63**（`packages/core/domain/constants.ts:17`） |
| `LAKE_LEVEL=62` | **63**。ただし「独立した定数ではない」という訂正も不正確。詳細は `porting.md` §4 |
| noise-primitives + density-function 756 LOC | **406** |
