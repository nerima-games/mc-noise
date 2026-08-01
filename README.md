# @nerima-games/mc-noise

## 責務

シード付き決定論ノイズ。PRNG・Perlin 勾配ノイズカーネル・オクターブ / fBm 合成。

**seed → 値の写像は凍結された契約である**（plan.md §3.2）。
変更すると過去に保存されたすべてのワールドの地形が変わる。
定数を触る前に [`docs/versioning.md`](./docs/versioning.md) を読むこと。

## 依存

`effect` のみ。`@nerima-games/*` のどのリポジトリにも依存しない。

将来的には `mc-kernel` に依存する（4 階層アーキテクチャの安定ライブラリ層）。
現時点で宣言していないのは、まだ何も publish されていないためである
（bottom-up に publish してから pin する方式）。
意図されたグラフは [`DEPENDENCY_POLICY.md`](https://github.com/nerima-games/.github/blob/main/DEPENDENCY_POLICY.md)
（実効機構は `oxlint.json` の `no-restricted-imports`）と
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
| [`docs/versioning.md`](./docs/versioning.md) | 0.x → 1.0.0 と publish |

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
| `pnpm lint` | oxlint（このリポジトリ唯一の lint / format 設定。prettier も biome も .editorconfig も置かない）。**`--deny-warnings` 付きで走る**ため、`warn` のルールもビルドを落とす（`oxlint.json` は 5 カテゴリすべてと個別 66 ルールが `warn`、`error` は 4 つだけ。このフラグが無かった頃は実質その 4 つしかゲートになっていなかった） |
| `pnpm lint:fix` | oxlint の自動修正 |
| `pnpm test` | vitest（`@effect/vitest` の `it.effect` が主 API） |
| `pnpm test:watch` | vitest watch |
| `pnpm test:coverage` | カバレッジ計測。4 指標 99% のしきい値ゲート（`vitest.config.ts`）付き |
| `pnpm verify` | `typecheck && lint && test`。CI の必須ゲートと同じ内容（カバレッジは別ステップ） |

## 使い方

```typescript
import { createNoiseField, NoiseSeed } from '@nerima-games/mc-noise'

const field = createNoiseField(NoiseSeed(20260726))

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

## 現状

**このリポジトリはまだ第一版（叩き台）である。** 以下は確定事項ではない。

- **`CHANNEL_PARAMS` のチューニング値は暫定。** 参照実装から引き継いだ octaves / persistence /
  lacunarity をそのまま置いてあるが、地形の見た目に合わせて調整すべき値である。
  ただし**調整は破壊的変更である**（`docs/versioning.md` §5）。mc-worldgen が
  地形プレビューを持ったあとに、1 回で決めること。
- **`jaggedness` の salt だけ参照実装と違う。** 理由は
  [`docs/public-api.md`](./docs/public-api.md) §3。
- **既知のアーティファクト: 半整数格子で値が 0 になりやすい。**
  4 勾配の 2D Perlin の構造的な性質である。**ブロック中心は `.5` なので、
  「ブロック中心でノイズをサンプルする」と地形に格子模様が出る。**
  修正（12 勾配化）は凍結された写像の変更なので、意図的な MAJOR bump まで保留している。
  詳細と回避策は [`docs/design-notes.md`](./docs/design-notes.md) N-8。
- **`toPV` / 疎グリッド + 双線形補間 / バッチヘルパは未移植。**
  前者は地形の形の話（mc-worldgen 寄り）、後者 2 つは性能最適化なので
  ベンチマークを用意してから入れる。
- **Simplex ノイズは無い。** plan.md は「Perlin/Simplex系」と書くが、
  参照実装に Simplex は存在しない。必要になってから入れる（追加は semver-minor）。
- **密度関数コンビネータは意図的に含めていない。**
  参照実装の `density-function.ts` はコンビネータ代数ではなく地形の式そのものであり、
  それは mc-worldgen の責務である。詳細は
  [`docs/responsibility.md`](./docs/responsibility.md) §3.1。
- **ビルド／publish はまだない。** `package.json` の `exports` は TypeScript ソースを直接指している。
  GitHub Packages への publish パイプラインは完成条件を満たした時点で追加する。
  それまで `version` は `0.x` に留める（mc-worldgen が実際に消費して契約を確認したら 1.0.0 にする）。
- **カバレッジ 4 指標 99% ゲートは有効化済み。** 組織としての即時・全リポジトリ一律の決定
  （TEST_STANDARD.md §3）により、猶予期間なく `vitest.config.ts` と CI の両方で有効化した。
  有効化時点の実測は statements 100%・lines 100%・**functions 95.45%（21/22）**・
  **branches 84.85%（56/66）**で、functions と branches が 99% 未達のため CI は赤くなる。
  これはしきい値を緩める理由ではなく、追跡対象の未完了作業として扱う
  （MIGRATION_RUNBOOK.md 手順7 が明示的に受容している既知の結果と同じ扱い）。

## License

MIT
