# 移植元と実測 LOC

- 参照実装ルート: `<reference-impl>`（以下パスはこれ相対）
- 計測方法: `wc -l`（コメント・空行を含む物理行数）

**初期資料の LOC 見積もりは信頼できない。** 本書の数値はすべてこのリポジトリで
`wc -l` を実行して確認したものである。

## 1. 移植責務と実測

> **移植元**: `packages/world` の noise-primitives.ts / density-function.ts / octave群（756 LOC）

| ファイル | 実測 LOC |
| --- | --- |
| `packages/world/domain/noise-primitives.ts` | 335 |
| `packages/world/domain/density-function.ts` | 71 |
| **小計（初期資料が名指しした 2 ファイル）** | **406** |

**初期資料の 756 は誤りではなく、数え方が違う。** 756 の内訳を再現できた:

| ファイル | LOC |
| --- | --- |
| `packages/world/domain/noise-primitives.ts` | 335 |
| `packages/world/domain/density-function.ts` | 71 |
| `packages/world/domain/noise-service-port.ts` | 93 |
| `packages/world/application/noise-service.ts` | 175 |
| `packages/world/application/noise-port-factory.ts` | 82 |
| **合計** | **756** |

つまり初期資料の「octave群」は Port と Service レイヤを含んでいる。
ところが **`octave*.ts` というファイルは存在しない**。オクターブ / fBm のコードは
`noise-primitives.ts` の中の `computeOctaveNoise`（:74）と `signedFbm2D`（:105）である。

**本リポジトリが採る数字は 406 である。** Port / Service レイヤは移植対象ではない:

- `noise-service.ts` は `let currentSeed` を持つ可変サービスであり、`setSeed` で
  primitives バンドルごと差し替える（`:48-52`）。mc-noise は状態を持たない純粋関数の集合なので、
  この可変性は要らない。シードごとに `createNoiseField` を呼べばよい。
- `noise-service-port.ts` / `noise-port-factory.ts` は Effect の Layer 配線であり、
  必要なら消費側（mc-worldgen）が自分の Layer として書けばよい。

## 2. 移植したファイルの対応

| 参照実装 | 本リポジトリ | 備考 |
| --- | --- | --- |
| `packages/world/domain/noise-primitives.ts:15-23`（`mulberry32`） | `domain/seed.ts` | アルゴリズムそのまま。引数を branded に |
| `packages/world/domain/noise-primitives.ts:33-37`（Weyl 定数） | `domain/seed.ts` の `CHANNEL_SALT` | 4 値そのまま、`jaggedness` のみ差し替え（`public-api.md` §3） |
| `packages/world/domain/noise-primitives.ts:236-245`（チャンネル分岐） | `domain/seed.ts` の `deriveSeed` | XOR + Weyl 方式そのまま |
| `packages/world/domain/perlin.ts`（108 LOC） | `domain/perlin.ts` | `rand` を必須化（`design-notes.md` N-3） |
| `packages/world/domain/noise-primitives.ts:74-93`（`computeOctaveNoise`） | `domain/octaves.ts` の `computeOctaveNoise` / `octaveNoise2D` | 位置引数版は参照 API を維持し、`NoiseField` 向けにレコード版も提供。退化時はそれぞれ 0 / 0.5 |
| `packages/world/domain/noise-primitives.ts:105-130`（`signedFbm2D`） | `domain/octaves.ts` の `signedFbm2D` | `boost` を維持し、0 オクターブ保護を追加 |
| `packages/world/domain/noise-primitives.ts:215-268`（`NoisePrimitives` / `createNoisePrimitives`） | `domain/noise-primitives.ts` | raw / normalized noise、チャンネル、スケール済み `...At`、チャネルサンプルを束ねる |

## 3. 移植対象外と追加移植済みの API

前半は mc-noise の責務外として移植しないもの、後半は当初の一覧から追加で移植した API である。

| 参照実装 | LOC | 理由 |
| --- | --- | --- |
| `packages/world/domain/density-function.ts` | 71 | 4 チャンネルから高さを出す地形固有の式は mc-worldgen の責務。portable な DensityFunction subset は `src/domain/density-function*.ts` に新規設計として追加 |
| Minecraft の DensityFunction 実装 | — | Minecraft Java 1.21.1 を共通ノードの照合基準とし、1.21.8 の静的ノード一覧を監査。portable な `Shift` / `ShiftA` / `ShiftB` / `shiftedNoise2d` / `noiseInRange` / `map` / `mapRange` / `lerp` / `LinearOperation` / `WeirdScaledSampler` / `EndIslands` / `old_blended_noise`、runtime marker の `beardifier`、および 1.21.9 で追加された `find_top_surface` は本リポジトリで提供。`old_blended_noise` の octave source は callback で解決し、`beardifier` の構造物由来の beardifying は context callback で受け取る。portable な `NoiseRouter` / `Climate` / `Blender` の構造・評価ヘルパも提供するが、NoiseConfig / registry、ワールド設定に結び付いたキャッシュ、設定済み NoiseRouter、地形定数・制御点は mc-worldgen の責務 |
| `packages/world/domain/spline.ts` | 42 | **移植済み**。地形データを持たない区分線形評価を `src/domain/spline.ts` に分離し、制御点の有限値・単調性を検証 |
| `packages/world/domain/terrain-splines.ts` | 46 | 地形固有の制御点データ。mc-worldgen のチューニング対象であり凍結対象ではない |
| `src/domain/biome.ts` / `src/domain/biome-classifier.ts` | — | **純粋部分を移管済み**。気候からのバイオーム分類、静的なバイオーム・表面材質・ブロック定義を `src/domain/minecraft-biome*.ts` に配置。登録済みバイオームレジストリは mc-worldgen が所有 |
| `src/domain/terrain.ts` / `src/domain/terrain-column.ts` | — | **純粋部分を移管済み**。大陸性、地表高、気候、地表バイオーム、1 列の合成を `src/domain/minecraft-terrain*.ts` に配置。チャンクへの書き込みは移管しない |
| `src/domain/lake-generator.ts` / `src/domain/surface-resolver.ts` | — | **純粋部分を移管済み**。湖盆、水面、湖岸、凍結判定、表面材質を `src/domain/minecraft-lakes.ts` / `minecraft-surface.ts` に配置。ブロック配置は mc-worldgen の責務 |
| `packages/world/domain/noise-service-port.ts` | 93 | Layer 配線。消費側の責務 |
| `packages/world/application/noise-service.ts` | 175 | 可変サービス。不要（§1） |
| `packages/world/application/noise-port-factory.ts` | 82 | 同上 |
| 疎サンプリング + 双線形 / 三線形補間 | `src/domain/sampling.ts` / `src/domain/sampling-3d-interpolation.ts`（`sampling-3d.ts` から再公開） | **移植済み**。`sampleNoise2DInterpolatedGrid` / `sampleNoise3DInterpolatedGrid` として公開し、直接サンプリングより少ない評価回数を検証 |
| チャンク向けサンプリング | `src/domain/chunk-sampling.ts` | **移植済み**。`ChunkCoord` / `ChunkHeight` を 2D/3D サンプル領域へ変換 |
| バッチヘルパ 5 種 | `noise-primitives.ts:270-334` | **移植済み**。`domain/primitive-batches.ts` に配置し、座標配列・点配列の両方を公開 |
| チャンクの terrain channel サンプル | `noise-primitives.ts:140-213` | **移植済み**。`domain/terrain-channels.ts` の疎グリッド + 双線形展開として公開 |
| `peaksAndValleysFromWeirdness` | `noise-primitives.ts:48` | **移植済み**。地形固有の配線から分離した純粋変換として `domain/transforms.ts` に配置 |

公式 DensityFunction の `interpolated`、`flatCache`、`cache2d`、`cacheOnce`、
`cacheAllInCell`、`blendDensity`、`blendAlpha`、`blendOffset` は未移植ではなく、セル幅・高さや
blend callback を `DensityEvaluationContext` / `DensityEvaluationSession` から受け取る
context-aware なノードとして `src/domain/density-function*.ts` に実装した。設定済み
NoiseRouter、キャッシュのライフサイクル、Blender のワールド固有データ、地形定数・制御点を
組み合わせる統合は `mc-worldgen` 側で行う。`mapFromUnitTo` と `mapRange` は公式の private
factory であり、本リポジトリでは公開可能な挙動として `densityMapRange` に集約する。

Minecraft の地形移植では、シード・座標・気候・地形レベルから値を返す純粋な分類・地形高・湖・表面材質の
定義までを mc-noise に移管した。カーバー、鉱石、植生、構造物、氷や雪を含むチャンクへのブロック適用は
ワールド状態と配置順序を必要とするため、mc-worldgen に残す。

## 4. 初期資料の数値を訂正（実測で検証）

| 初期資料の記述 | 実測 | 証拠 |
| --- | --- | --- |
| `SEA_LEVEL=48`（§3.7） | **63** | `packages/core/domain/constants.ts:17` — `export const SEA_LEVEL = 63`。直前のコメントは `// Phase 2.1 MC 1.18-aligned. Ocean biome water fills up to this height.` |
| `LAKE_LEVEL=62`（§3.7） | **63** | `packages/core/domain/constants.ts:20` — `export const LAKE_LEVEL = SEA_LEVEL` |
| noise 756 LOC | **406**（名指し 2 ファイル） / 756（Port・Service 込み） | §1 |

### 4.1 `LAKE_LEVEL` についての注意（本作業で見つかった二重の誤り）

本作業の指示書は「`LAKE_LEVEL` は SEA_LEVEL と同一で、独立した定数ではない」と訂正していたが、
**これも正確ではない**。実測:

```typescript
// packages/core/domain/constants.ts:19-20
// Phase 2.1 MC 1.18-aligned. Inland lake water surface matches sea level.
export const LAKE_LEVEL = SEA_LEVEL
```

`LAKE_LEVEL` は**独立した export された束縛として実在する**。その**値**が `SEA_LEVEL` に
別名付けされているだけである。両者の区別はテストでも保持されている
（`packages/core/domain/constants.test.ts:49-70`: `LAKE_LEVEL === SEA_LEVEL`（:60-61、
"for lake surface alignment"）、`SEA_LEVEL === 63`（:64）、`LAKE_LEVEL === 63`（:68））。

したがって正しい記述は「**別名だが独立した定数**」である。
mc-worldgen が移植するときは、両者を 1 つに畳んではならない。
「内陸湖の水面は海面に一致する」という設計判断が名前として残っていることに意味がある。

**62 という数字の出所も特定した**: `packages/world/test/generator-pipeline-model.test.ts:48` に
ファイルローカルな `const LAKE_LEVEL = 62` がある。テストフィクスチャであり、
export された定数とは無関係で、しかも値が食い違っている。62 を正典として扱ってはならない。

## 5. 初期資料で正しかったこと（検証済み）

| 記述 | 検証 |
| --- | --- |
| 参照実装の `packages/world` は Three.js を import ゼロ | **確認**。`rg "from ['\"]three" packages/world -t ts` → 0 件。`packages/world/package.json` の依存は `@ts-minecraft/core` / `block` / `entity` / `inventory` / `worker` / `effect` のみ |
| オクターブループは `let` + `for` | **確認**。`design-notes.md` N-1 に原文引用 |

補強証拠として、参照実装は Three.js の Raycaster をわざわざ自前の voxel DDA で置き換えている
（`packages/world/domain/voxel-raycast.ts:3`:
`// Voxel ray traversal (Amanatides & Woo). Replaces three.js Raycaster for block`）。
`packages/world` の Three.js 非依存は偶然ではなく維持されてきた性質である。

## 6. 移植すべきテスト資産

初期資料の完了条件は「各 Step で参照実装の対応テスト・fixture・E2E シナリオを
オラクルとして移植する」と定める。mc-noise に対応するもの:

| 参照実装のテスト | 内容 | 本リポジトリでの扱い |
| --- | --- | --- |
| `packages/world/domain/noise-primitives.test.ts`（100 行） | `normalizeNoise` の線形性、peaks-and-valleys 変換の対称性、`mulberry32` の決定論、`computeOctaveNoise` の値域 | 移植済み（`test/octaves.test.ts`、`test/determinism.test.ts`、`test/transforms.test.ts`） |
| `packages/world/domain/perlin.test.ts`（127 行） | 同一シードの決定論、異シードの分岐、値域、滑らかさ | 移植済み |
| `packages/world/test/noise-service.property.test.ts`（80 行） | P-01 値域、P-02 値域、P-03 決定論、P-04 空間連続性 | 移植済み（`test/octaves.test.ts` / `test/determinism.test.ts`） |
| `packages/world/test/noise-primitives-channels.test.ts`（137 行） | チャンネル分岐、双線形補間、バッチヘルパ | **移植済み**。`test/noise-primitives.test.ts` / `test/terrain-channels.test.ts` / `test/primitive-batches.test.ts` と、2D/3D の汎用サンプリングテストで検証 |
| `packages/world/test/terrain-determinism.test.ts` | 同一シード → バイト同一チャンク | mc-worldgen の責務 |
| `packages/world/test/density-function.test.ts`（147 行） | 地形の意味論（深海 / 海岸 / 平原 / 山頂の Y） | mc-worldgen の責務 |

**参照実装にリテラルなゴールデン値は無い。** 初期責務が求める
「シード固定のゴールデン値」は本リポジトリで新規に作った資産である
（`test/public-api.test.ts` のインラインスナップショット）。
