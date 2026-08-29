# 責務

- 根拠: 本リポジトリの公開 API と `mc-kernel` の依存境界
- 参照実装: `takeokunn/ts-minecraft`

## 1. 初期責務の要約

> ### 3.2 mc-noise
>
> - **責務**: シード付き決定論ノイズ（Perlin/Simplex系）・オクターブ合成・密度関数
> - **依存**: kernel
> - **主要な公開API**: `noise2d/3d(seed, x, y, z)`、fBm合成、密度関数コンビネータ。**seed→値のインターフェースは凍結扱い**（変更 = 全ワールドの地形が変わる破壊的変更）
> - **検証**: プロパティテスト（決定論・値域・連続性）+ シード固定のゴールデン値
> - **移植元**: `packages/world` の noise-primitives.ts / density-function.ts / octave群（756 LOC）
> - **設計注意**: オクターブループは `let` + `for` を維持（参照実装で実測確定したパフォーマンス例外。状態スレッドを配列foldに「修正」しない）

## 2. 責務の言い換え

**シードと座標だけを入力とし、決定論的な実数を返す純粋関数の集合。**

- シード付き PRNG（`mulberry32`）とチャンネル分岐（`deriveSeed`）
- Perlin 勾配ノイズカーネル 2D / 3D（`createPerlinNoise2D` / `createPerlinNoise3D`）
- オクターブ / fBm 合成（`octaveNoise2D` / `signedFbm2D`）
- 値ノイズと fBm（`valueNoise2D` / `fbm2D`）
- 地形チャンネルから独立した peaks-and-valleys 変換（`peaksAndValleysFromWeirdness`）
- Minecraft 向けのノイズ束（`createNoisePrimitives`）と raw / normalized / scaled channel API
- 4 チャンネルのチャンクサンプル材料（`computeTerrainChannels` / `sampleTerrainChannels`）
- Minecraft の気候サンプル、バイオーム分類、地形高、湖・水面・表面材質の純粋な定義
- チャンク状態へ書き込まずに 1 列を評価する `minecraftTerrainColumnAt`
- プリミティブ単位の座標配列・点配列 batch API
- 2D/3D の batch・grid・補間サンプリングと `mc-kernel` チャンク座標変換
- 制御点を検証して凍結できる汎用の区分線形スプライン（`createSpline` / `evaluateSpline`）
- シード付き Simplex ノイズカーネル（`createSimplexNoise2D` / `createSimplexNoise3D`）
- `mc-kernel` の `Position` を使う immutable な portable DensityFunction AST、境界値計算、評価器
- 上記をシード 1 個から束ねる `createNoiseField`

## 3. 明示的にスコープ外のもの

| 項目 | どこが所有するか | 理由 |
| --- | --- | --- |
| バイオーム分類と気候からの純粋な地形判定 | mc-noise | `classifyMinecraftBiomeFromClimate` は気候値を、`minecraftBiomeFor` などはシード・座標・地表条件を受け取り、再利用可能な値を返す。設定済みレジストリは mc-worldgen が所有する |
| 地形生成そのもの（`generateChunk`） | mc-worldgen | チャンク状態、ブロック配置順序、ワールド設定を変更する処理である |
| Minecraft 固有の DensityFunction の portable なノード・評価器 | mc-noise | ワールド設定を持たない AST・境界値・評価コンテキストとして再利用できる |
| 設定済みの DensityFunction / NoiseRouter と地形の密度式 | mc-worldgen | レジストリ、ワールド設定、地形スプライン、キャッシュの組み合わせに依存するため |
| 地形スプライン（`OFFSET_SPLINE` 等の制御点） | mc-worldgen | 汎用評価器ではなく地形チューニングデータであり、凍結対象ではない |
| チャンクへのブロック書き込み、カーバー、鉱石、植生、構造物 | mc-worldgen | ワールド状態・ブロック状態・配置順序を変更する生成処理である |
| カーバー（洞窟 / 渓谷） | mc-worldgen | ノイズを**使う**側 |
| 木の格子ジッター配置 | mc-worldgen | 同上 |
| ライトグリッド（BFS 光伝播） | mc-worldgen（データ）/ mc-render（適用） | ノイズと無関係 |
| ワールドシードの永続化 | mc-save | mc-noise は `NoiseSeed` を受け取るだけで、どこから来たかを知らない |

### 3.1 DensityFunction の境界

`mc-noise` は特定ワールドの地形式ではなく、複数のワールド実装が再利用できる
portable な DensityFunction の代数を所有する。公開する範囲は次のとおりである:

- constant / coordinate / noise / old-blended-noise / beardifier / shift / shift-a / shift-b / shifted-noise / shifted-noise-2d / noise-in-range
- linear-operation / weird-scaled-sampler / end-islands / map / map-range / lerp
- add / mul / min / max と abs / square / cube / squeeze / invert などの単項演算
- clamp / range-choice / find-top-surface / y-clamped-gradient / 地形データを持たない spline
- immutable な `minValue` / `maxValue` と `Position` ベースの評価器

共通する公式メソッドは Minecraft Java 1.21.1 を基本照合基準とし、1.21.8 の静的ノード一覧を監査する。
Minecraft Java 1.21.9 で追加された `find_top_surface` も mc-noise が提供する。portable な `NoiseRouter` / `Climate` /
`Blender` の構造と評価ヘルパは mc-noise が提供する。一方、Minecraft の公式実装にあるキャッシュ、
設定済みの NoiseRouter、登録済みの地形定数と制御点は、ワールド設定に依存するため mc-worldgen が所有する。
`EndIslands` は seed と座標だけで
評価できるため、portable な DensityFunction ノードとして mc-noise が提供する。
`old_blended_noise` は公式の係数と main / min / max octave の合成までを提供し、octave source は
呼び出し側の callback で解決する。`beardifier` は構造物データを所有せず、評価時に
`DensityEvaluationContext` の callback から影響値を受け取る runtime marker である。
参照実装の 4 チャンネルから高さを出す式も、引き続きその境界の外に置く。

公式 1.21.1 の `interpolated`、`flatCache`、`cache2d`、`cacheOnce`、`cacheAllInCell`、
`blendDensity`、`blendAlpha`、`blendOffset` は、セル幅・高さや blend callback を受け取る
context-aware な portable ノードとして含める。`DensityEvaluationContext` /
`DensityEvaluationSession` が評価に必要なセル情報と状態を保持し、設定済み NoiseRouter、
キャッシュのライフサイクル、Blender のワールド固有データ、地形定数・制御点を組み合わせる
統合は mc-worldgen が所有する。公式の `mapFromUnitTo` と `mapRange` は private なファクトリ
なので、公開 API ではそれらの挙動を表す `densityMapRange` を提供する。

## 4. 親と子

| 関係 | リポジトリ |
| --- | --- |
| 親（依存先） | `mc-kernel` のみ |
| 子（依存元） | `mc-worldgen` のみ |

`package.json` は `@nerima-games/mc-kernel` に依存し、`ChunkCoord`、`ChunkHeight`、チャンク幅の
共有定義を `src/domain/chunk-sampling.ts` で利用する。ノイズの seed・勾配・補間ロジックは本リポジトリが
所有する。ポータブルな 4 チャンネルのサンプル材料、気候・バイオーム・地形列・湖・表面材質の純粋定義、
DensityFunction の代数・評価器も本リポジトリが提供する。一方、密度関数を組み合わせた特定地形の式、
その制御点データ、設定済みの NoiseRouter とキャッシュ、チャンクへのブロック適用は `mc-worldgen` の責務として
移植しない。制御点を評価する汎用スプライン処理だけは `mc-noise` が提供する。
`architecture.md` §7 を参照。

## 5. 完成条件

`testing.md` に詳細。要約すると:

- プロパティテスト（決定論・値域・連続性）が green
- シード固定のゴールデン値が固定されている
- カバレッジ 100% ゲート有効化

mc-noise は**プレビューを持たない**。安定ライブラリ層は「操作できる成果物」を持たないので、
プレビューを要求する完了条件は適用されない。
最初の遊べる成果物は mc-worldgen の地形プレビューである。
