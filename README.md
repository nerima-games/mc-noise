# @nerima-games/mc-noise

## 責務

シード付き決定論ノイズ、Simplex / Perlin カーネル、オクターブ / fBm 合成、portable な Minecraft DensityFunction とサンプリング primitives。

**seed → 値の写像は凍結された契約である**（plan.md §3.2）。
変更すると過去に保存されたすべてのワールドの地形が変わる。
定数を触る前に [`docs/versioning.md`](./docs/versioning.md) を読むこと。

## 依存

`effect` と `@nerima-games/mc-kernel` に依存する。

`mc-kernel` からはチャンク座標の型と 16 ブロック幅の定数を利用する。
ノイズの seed・Perlin・オクターブ合成は、このパッケージの純粋な責務として管理する。
意図されたグラフは [`DEPENDENCY_POLICY.md`](https://github.com/nerima-games/.github/blob/main/DEPENDENCY_POLICY.md)
（実効機構は `.oxlintrc.json` の `no-restricted-imports`）と
[`docs/architecture.md`](./docs/architecture.md) に記録してある。

## このリポジトリの位置づけ

| 関係 | リポジトリ |
| --- | --- |
| 親（依存先） | `mc-kernel` のみ |
| 子（依存元） | `mc-worldgen` のみ |

4 階層アーキテクチャの**安定ライブラリ層**（plan.md §2.2）。
純粋関数・狭い界面・変更頻度が低い。相互独立で並行構築可能。

## ドキュメント

**[`docs/`](./docs/README.md) に実装に必要な情報をすべてまとめてある。**
plan.md を読み返さずに、また参照実装を再調査せずに実装できるようにしてある。

| ドキュメント | 内容 |
| --- | --- |
| [`docs/architecture.md`](./docs/architecture.md) | 4 階層、依存グラフ、依存ホワイトリスト CI |
| [`docs/responsibility.md`](./docs/responsibility.md) | 責務と、明示的にスコープ外のもの |
| [`docs/public-api.md`](./docs/public-api.md) | 公開 API と参照実装での裏付け |
| [`docs/design-notes.md`](./docs/design-notes.md) | 設計注意と、対応する名前付き回帰テスト |
| [`docs/porting.md`](./docs/porting.md) | 移植元パスと実測 LOC |
| [`docs/testing.md`](./docs/testing.md) | 検証と完成条件 |
| [`docs/versioning.md`](./docs/versioning.md) | バージョニングと配布境界 |

## 開発

### セットアップ

```console
$ direnv allow          # flake.nix の devShell で nodejs_24 + corepack が入る
$ pnpm install
```

Nix を使わない場合は Node.js 24 以上と pnpm 11 を用意する
（`package.json` の `packageManager` が版を pin しているので `corepack pnpm ...` でよい）。

> **注意**: ツールチェーンは `devenv.nix` から `flake.nix` + `flake.lock` に移行済みである。
> `flake.lock` はコミットされているので、`nix develop`（`.envrc` は `use flake`）は
> 誰の手元でも同じ nixpkgs に解決される。`devenv.nix` / `devenv.lock` はもう存在しない。

### コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm typecheck` | `tsconfig.build.json` と `tsconfig.test.json` の両方を型検査 |
| `pnpm lint` | oxlint（このリポジトリ唯一の lint / format 設定。prettier も biome も .editorconfig も置かない）。**`--deny-warnings` 付きで走る**ため、`warn` のルールもビルドを落とす（`.oxlintrc.json` は 5 カテゴリすべてと個別 58 ルールが `warn`、`error` は `no-eval` / `no-implied-eval` / `no-restricted-imports` の3つだけ。このフラグが無かった頃は実質その3つしかゲートになっていなかった） |
| `pnpm lint:fix` | oxlint の自動修正 |
| `pnpm test` | vitest（`@effect/vitest` の `it.effect` が主 API） |
| `pnpm test:watch` | vitest watch |
| `pnpm test:coverage` | カバレッジ計測。4 指標 100% のしきい値ゲート（`vitest.config.ts`）付き |
| `pnpm build` | `dist/` に JavaScript・宣言ファイル・source map を生成 |
| `pnpm package:verify` | ビルド済みの公開 API と npm アーカイブの内容を検査 |
| `pnpm verify` | `typecheck && lint && test`。カバレッジと配布物検査は別ステップ |

## 使い方

```typescript
import { createIsotropicNoiseField, NoiseSeed } from '@nerima-games/mc-noise'

// 新規 world は半整数格子の退化を避ける isotropic field を推奨する。
const field = createIsotropicNoiseField(NoiseSeed(20260726))

field.raw2d(12.37, -7.13)                   // 符号付き ≈[-1, 1]
field.noise2d(12.37, -7.13)                 // 正規化 [0, 1]
field.noise3d(1.3, 2.7, -3.1)               // 正規化 [0, 1]
field.octave2d(4.3, -6.9)                   // 正規化 [0, 1]、fBm 4 オクターブ
field.channel('continentalness')(100, 200)  // 符号付き [-1, 1]、スプライン用
```

**シードは 1 度、サンプルは何度でも。** `noise2d(seed, x, z)` という形にはしていない。
1 サンプルごとに 256 エントリの permutation table を作り直すことになるからである。
凍結された契約（(seed, 座標) → 値）は変わらない。詳細は
[`docs/public-api.md`](./docs/public-api.md) §1。

## 現在の契約と未確定事項

決定論的なノイズ・fBm・値ノイズ・2D/3D サンプリングに加え、Simplex、portable な
DensityFunction と NoiseRouter / Climate / Blender の構造 API、参照実装由来の
`NoisePrimitives` とそのチャンネル・バッチ API まで実装済みである。API とテスト契約は
実装と同じ変更で更新する。
以下は、実装の有無ではなく、生成ワールドの互換性や mc-worldgen の仕様が決まるまで確定できない事項である。

- **`CHANNEL_PARAMS` のチューニング値は暫定。** 参照実装から引き継いだ octaves / persistence /
  lacunarity をそのまま置いてあるが、地形の見た目に合わせて調整すべき値である。
  ただし**調整は破壊的変更である**（`docs/versioning.md` §5）。mc-worldgen が
  地形プレビューを持ったあとに、1 回で決めること。
- **`jaggedness` の salt だけ参照実装と違う。** 理由は
  [`docs/public-api.md`](./docs/public-api.md) §3。
- **legacyカーネルの既知のアーティファクト: 半整数格子で値が 0 になりやすい。**
  4 勾配の 2D Perlin の構造的な性質である。**ブロック中心は `.5` なので、
  「ブロック中心でノイズをサンプルする」と地形に格子模様が出る。**
  凍結された写像を保つため `createNoiseField` は維持し、8方向の
  `createIsotropicNoiseField` を新規world向けのopt-in APIとして提供する。
  低レベル利用には `createPerlinNoise2DIsotropic` も使える。world metadata には
  factory の選択を保存し、再生成時も同じものを選ぶこと。
  詳細と選択基準は [`docs/design-notes.md`](./docs/design-notes.md) N-8。
- **汎用の疎グリッド + 補間は実装済み。**
  `sampleNoise2DInterpolatedGrid` は双線形、`sampleNoise3DInterpolatedGrid` は三線形補間を行う。
  `sampleNoise2DChunk` は `mc-kernel` の `ChunkCoord` を 16×16 のサンプル領域へ、
  `sampleNoise3DChunk` は同じ座標系と `ChunkHeight` を体積サンプルへ変換する。
  `sampleNoise2DBatch` / `sampleNoise3DBatch` と `sampleNoise2DGrid` / `sampleNoise3DGrid` も提供する。
  `peaksAndValleysFromWeirdness` は参照式どおりの純粋な変換として提供する。
  `createNoisePrimitives` は raw / normalized noise、4 つの地形チャンネル、
  `sampleTerrainChannels` を提供し、`noise2DBatchXY` / `octaveNoise2DBatchXY` /
  `noise3DBatchXYZ` / `noise2DBatch` / `octaveNoise2DBatch` でプリミティブを一括評価できる。
  汎用の区分線形スプラインは `createSpline` / `evaluateSpline` として提供する。
  密度関数・地形スプライン制御点を組み合わせた地形の式は引き続き mc-worldgen 側の責務である。
- **Simplex ノイズを提供する。** `createSimplexNoise2D` / `createSimplexNoise3D` は
  Minecraft の初期化順に従うシード付きで決定論的な 2D / 3D Simplex 値を返す。原点は
  既定でシードから生成され、明示した原点は有限値として検証される。これは再利用可能なカーネルであり、
  特定バージョンの Minecraft の地形互換性を保証するものではない。
- **型付き DensityFunction の portable subset を提供する。** `constant` / `coordinate` /
  `noise` / `shift` / `shift-a` / `shift-b` / `shifted-noise` / `shifted-noise-2d` /
  `noise-in-range` / `linear-operation` / `weird-scaled-sampler` / `end-islands` /
  `map` / `map-range` / `lerp`、二項・単項演算、`clamp` / `range-choice` /
  `y-clamped-gradient` / `spline` を immutable なノードとして組み立てられる。
  `Shift` 系は公式の座標変換と境界値スケールを再現し、`evaluateDensityFunction` と
  `densityBounds` が `mc-kernel` の `Position` を入力境界に使う。
  公式メソッドとの照合基準は Minecraft Java 1.21.1 であり、バージョンごとのワールド生成変更は
  別の契約として扱う。
  portable な `NoiseRouter` / `Climate` / `Blender` の構造・評価ヘルパを提供する。
  context-aware なキャッシュ・blend ノードはセル幅・高さと blend callback を
  `DensityEvaluationContext` から受け取る。Minecraft 固有の設定済み `NoiseRouter`、
  キャッシュのライフサイクル、地形固有の定数・制御点は引き続き mc-worldgen 側の責務である。
- **配布用ビルドを持つ。** `pnpm build` は `dist/` を生成し、`package.json` の `exports` は
  その成果物だけを公開する。`pnpm package:verify` は実行時の公開 API と tarball の内容を検査する。
  registry への publish は認証とリリース承認を伴うため CI の自動処理には含めず、Changesets を使うリリース操作で行う。
  下流が契約を確認するまでは `version` は `0.x` に留める。
- **カバレッジ 4 指標 100% ゲートは有効化済み。** `pnpm test:coverage` が
  statements / branches / functions / lines を検査し、CI でも同じゲートを実行する。

## License

MIT
