# 移植元と実測 LOC

- 参照実装ルート: `<reference-impl>`（以下パスはこれ相対）
- 計測日: 2026-07-26
- 計測方法: `wc -l`（コメント・空行を含む物理行数）

**plan.md の LOC 見積もりは信頼できない。** 本書の数値はすべてこのリポジトリで
`wc -l` を実行して確認したものである。

## 1. plan.md §3.2 の記述と実測

> **移植元**: `packages/world` の noise-primitives.ts / density-function.ts / octave群（756 LOC）

| ファイル | 実測 LOC |
| --- | --- |
| `packages/world/domain/noise-primitives.ts` | 335 |
| `packages/world/domain/density-function.ts` | 71 |
| **小計（plan.md が名指しした 2 ファイル）** | **406** |

**plan.md の 756 は誤りではなく、数え方が違う。** 756 の内訳を再現できた:

| ファイル | LOC |
| --- | --- |
| `packages/world/domain/noise-primitives.ts` | 335 |
| `packages/world/domain/density-function.ts` | 71 |
| `packages/world/domain/noise-service-port.ts` | 93 |
| `packages/world/application/noise-service.ts` | 175 |
| `packages/world/application/noise-port-factory.ts` | 82 |
| **合計** | **756** |

つまり plan.md の「octave群」は Port と Service レイヤを含んでいる。
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
| `packages/world/domain/noise-primitives.ts:74-93`（`computeOctaveNoise`） | `domain/octaves.ts` の `octaveNoise2D` | `let`+`for` 維持。パラメータをレコード化。退化時 0 → 0.5 |
| `packages/world/domain/noise-primitives.ts:105-130`（`signedFbm2D`） | `domain/octaves.ts` の `signedFbm2D` | `boost` を落とした。0 オクターブ保護を追加 |
| `packages/world/domain/noise-primitives.ts:215-268`（`NoisePrimitives` / `createNoisePrimitives`） | `domain/field.ts` の `NoiseField` / `createNoiseField` | 値域の命名を是正（`public-api.md` §7） |

## 3. 移植しなかったもの

| 参照実装 | LOC | 理由 |
| --- | --- | --- |
| `packages/world/domain/density-function.ts` | 71 | コンビネータ代数ではなく地形の式そのもの。mc-worldgen の責務（`responsibility.md` §3.1） |
| `packages/world/domain/spline.ts` | 42 | 同上 |
| `packages/world/domain/terrain-splines.ts` | 46 | 同上（スプライン制御点はチューニング対象であり凍結対象ではない） |
| `packages/world/domain/noise-service-port.ts` | 93 | Layer 配線。消費側の責務 |
| `packages/world/application/noise-service.ts` | 175 | 可変サービス。不要（§1） |
| `packages/world/application/noise-port-factory.ts` | 82 | 同上 |
| `computeTerrainChannels`（疎グリッド + 双線形補間） | `noise-primitives.ts:143-213` | 性能最適化。ベンチマークを用意してから入れる |
| バッチヘルパ 5 種 | `noise-primitives.ts:270-334` | 同上 |
| `toPV` | `noise-primitives.ts:48` | 地形の形の話。mc-worldgen 寄り |

## 4. plan.md の数値の訂正（実測で検証）

| plan.md の記述 | 実測 | 証拠 |
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

## 5. plan.md で正しかったこと（検証済み）

| 記述 | 検証 |
| --- | --- |
| 参照実装の `packages/world` は Three.js を import ゼロ | **確認**。`rg "from ['\"]three" packages/world -t ts` → 0 件。`packages/world/package.json` の依存は `@ts-minecraft/core` / `block` / `entity` / `inventory` / `worker` / `effect` のみ |
| オクターブループは `let` + `for` | **確認**。`design-notes.md` N-1 に原文引用 |

補強証拠として、参照実装は Three.js の Raycaster をわざわざ自前の voxel DDA で置き換えている
（`packages/world/domain/voxel-raycast.ts:3`:
`// Voxel ray traversal (Amanatides & Woo). Replaces three.js Raycaster for block`）。
`packages/world` の Three.js 非依存は偶然ではなく維持されてきた性質である。

## 6. 移植すべきテスト資産

plan.md §6 Step 2 は「各 Step で参照実装の対応テスト・fixture・E2E シナリオを
オラクルとして移植する」と定める。mc-noise に対応するもの:

| 参照実装のテスト | 内容 | 本リポジトリでの扱い |
| --- | --- | --- |
| `packages/world/domain/noise-primitives.test.ts`（100 行） | `normalizeNoise` の線形性、`toPV` の対称性、`mulberry32` の決定論、`computeOctaveNoise` の値域 | 移植済み（`test/octaves.test.ts`、`test/determinism.test.ts`） |
| `packages/world/domain/perlin.test.ts`（127 行） | 同一シードの決定論、異シードの分岐、値域、滑らかさ | 移植済み |
| `packages/world/test/noise-service.property.test.ts`（80 行） | P-01 値域、P-02 値域、P-03 決定論、P-04 空間連続性 | 移植済み（`test/octaves.test.ts` / `test/determinism.test.ts`） |
| `packages/world/test/noise-primitives-channels.test.ts`（137 行） | チャンネル分岐、双線形補間、バッチヘルパ | **一部のみ**。`computeTerrainChannels` 未移植のため |
| `packages/world/test/terrain-determinism.test.ts` | 同一シード → バイト同一チャンク | mc-worldgen の責務 |
| `packages/world/test/density-function.test.ts`（147 行） | 地形の意味論（深海 / 海岸 / 平原 / 山頂の Y） | mc-worldgen の責務 |

**参照実装にリテラルなゴールデン値は無い。** plan.md §3.2 が求める
「シード固定のゴールデン値」は本リポジトリで新規に作った資産である
（`test/public-api.test.ts` のインラインスナップショット）。
