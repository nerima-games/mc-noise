# 責務

- 出典: plan.md（**非公開**）§3.2
- 参照実装: `takeokunn/ts-minecraft`

## 1. plan.md §3.2 の記述（原文）

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
- 上記をシード 1 個から束ねる `createNoiseField`

## 3. 明示的にスコープ外のもの

| 項目 | どこが所有するか | 理由 |
| --- | --- | --- |
| バイオーム分類 | mc-worldgen | 気候 → バイオームは**分類ルール**であり、ノイズの値域の話ではない |
| 地形生成そのもの（`generateChunk`） | mc-worldgen | チャンクを作るにはブロックテーブルとバイオームが要る。どちらも mc-noise は知らない |
| 密度関数の「地形式」 | mc-worldgen | 後述 §4 |
| 地形スプライン（`OFFSET_SPLINE` 等の制御点） | mc-worldgen | チューニング対象であり、凍結対象ではない。同じ場所に置くと凍結の意味が壊れる |
| カーバー（洞窟 / 渓谷） | mc-worldgen | ノイズを**使う**側 |
| 木の格子ジッター配置 | mc-worldgen | 同上 |
| ライトグリッド（BFS 光伝播） | mc-worldgen（データ）/ mc-render（適用） | ノイズと無関係 |
| ワールドシードの永続化 | mc-save | mc-noise は `NoiseSeed` を受け取るだけで、どこから来たかを知らない |
| Simplex ノイズ | 未実装 | plan.md は「Perlin/Simplex系」と書くが、参照実装に Simplex は存在しない。必要になってから入れる（追加は semver-minor） |

### 3.1 「密度関数」という語について（重要）

plan.md §3.2 は「密度関数コンビネータ」を mc-noise の公開 API に挙げているが、
**参照実装の `density-function.ts` はコンビネータ代数ではない。**

実測（`packages/world/domain/density-function.ts`、71 LOC）:

- `DensityFunction` という型は存在しない。
- `add` / `mul` / `clamp` のようなノード ADT も存在しない。
- 中身は 4 チャンネル（continentalness / erosion / pv / jaggedness）から
  カラム Y を出す**ハードコードされた 1 本の式**である
  （`density-function.ts:48-55`、スプライン 4 本のブレンド）。
- 出力は整数 `[1, 250]` にクランプされる（`density-function.ts:17-18, 54`。
  `MIN_Y` / `MAX_Y` は非公開）。

つまり「密度関数」は**地形の式**であって、汎用のノイズコンビネータではない。
地形の式は mc-worldgen の責務（バイオーム・スプライン制御点と一緒に調整される）なので、
**mc-noise には置かない。**

mc-noise が提供するのはその式の**材料**である:

- 相関のないチャンネル（`field.channel('continentalness')` など）
- 符号付き `[-1, 1]` を保つ fBm（スプラインの定義域が `[-1, 1]` だから）
- 正規化ヘルパ（`normalizeNoise` / `clampSigned`）

もし将来「本物の密度関数コンビネータ」（3D ノイズを組み合わせる代数）が必要になったら、
それは**新規設計**であり移植ではない。参照実装に元ネタは存在しない。

## 4. 親と子

| 関係 | リポジトリ |
| --- | --- |
| 親（依存先） | `mc-kernel` のみ |
| 子（依存元） | `mc-worldgen` のみ |

現時点では `mc-kernel` すら `package.json` に入っていない（まだ publish されていないため）。
`architecture.md` §7 を参照。

## 5. 完成条件

`testing.md` に詳細。要約すると:

- プロパティテスト（決定論・値域・連続性）が green
- シード固定のゴールデン値が固定されている
- カバレッジ 99% ゲート有効化

mc-noise は**プレビューを持たない**。安定ライブラリ層は「操作できる成果物」を持たないので、
plan.md §6 Step 2 の完了条件のうち「内蔵プレビューが操作可能」は適用されない。
最初の遊べる成果物は mc-worldgen の地形プレビューである。
