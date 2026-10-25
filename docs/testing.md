# 検証と完成条件

- 根拠: `package.json`、`vitest.config.ts`、`.ast-grep/`、現行テストと公開 API

## 1. コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm typecheck` | `tsconfig.build.json`（出荷ソース）と `tsconfig.test.json`（テスト・ツール）の両方 |
| `pnpm lint` | oxlint と AST-grep を実行する。oxlint は `--deny-warnings` 付きで、`warn` のルールも失敗になる（`.oxlintrc.json` は 5 カテゴリすべてと個別 58 ルールが `warn`、`error` は `no-eval` / `no-implied-eval` / `no-restricted-imports` の3つだけ）。続けて AST-grep の fixture test と scan を実行する。Prettier、Biome、`.editorconfig` は置かない |
| `ast-grep test --config .ast-grep/sgconfig.yml` | `.ast-grep/tests/` のルール fixture と snapshot を検査 |
| `ast-grep scan` | `.ast-grep/rules/` の構造ルールを、各ルールの `files` に一致するソースへ適用 |
| `pnpm test` | Vitest。純粋なテストと、`test/effect-test.ts` の `effectTest` helper を使う Effect テストを実行 |
| `pnpm test:coverage` | カバレッジ計測。4 指標 100% のしきい値ゲート付き（§3 参照） |
| `pnpm verify` | `typecheck` / `lint` / `test` を直列実行。カバレッジと配布物境界検査は別ステップ |
| `pnpm build` | `dist/` に JavaScript・宣言ファイル・source map を生成 |
| `pnpm package:verify` | ビルド済み公開 API と npm アーカイブの内容を検査 |
| `pnpm bench` | ベンチマーク（`scripts/bench-noise.ts`）。`verify` には入らない（§7） |
| `pnpm bench:density` | DensityFunction、NoiseRouter、Climate、Blender の workload を測る（`scripts/bench-density-function.ts`） |
| `pnpm bench:density:decoded` | decoded old-blended-noise の workload を測る（`scripts/bench-decoded-old-blended.ts`） |

セットアップには次のコマンドを実行する。

```console
$ direnv allow          # flake.nix の devShell で Node.js + corepack が入る
$ pnpm install
```

Nix を使わない場合は `package.json` の `engines` を満たす Node.js と、
`packageManager` が指定する pnpm が要る。
`package.json` の `packageManager` が版を pin しているので `corepack pnpm ...` でよい。

## 2. テストの方針

### Effect tests and ordinary `it`

Most mc-noise code is synchronous and pure, so use Vitest's ordinary `it` for value,
boundary, and determinism contracts. For tests written as Effects, use the `effectTest`
helper in `test/effect-test.ts`; it delegates execution to `@effect/vitest` 4's `it.effect`.

### Prefer property tests

Import `fast-check` directly. It is a direct development dependency, rather than an
Effect re-export. The workspace `.npmrc` keeps `fast-check` and `pure-rand` available to
the test toolchain.

mc-noise で最も価値が高いのは決定論のプロパティテストである
（同一シード → 同一値）。seed→値を凍結契約として扱う以上、
「凍結されている」ことが機械検査されていなければ宣言に意味がない。

比較は `===` ではなく `Object.is` を使う。`-0` と `0` の差は `===` を通り抜けたうえで、
後からゴールデン値テストを壊すからである。

決定論テストは定数関数でも成功する。
`different seeds disagree somewhere` がその防御である。

### 少数の誠実なテスト > 多数の自明なテスト

各テストは「何が壊れたら落ちるか」が一意に分かる名前を持つこと。
`design-notes.md` の各項目には回帰テスト名が振ってあり、ソースのコメントからも
同じ名前で参照している。テストを消すときは design-notes 側も同時に更新すること。

## 3. カバレッジ閾値

branches / functions / lines / statements の 4 指標すべてに **100%** のしきい値を設定している。
カバレッジしきい値は実行したコード経路を検査する。実装の質は別に評価する。

```typescript
// vitest.config.ts（有効化済み）
thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
```

`pnpm test:coverage` は、テスト件数が 0 でないことを確認したうえでこのしきい値を適用する。
未達時はしきい値を緩めず、未検証の分岐を特定して仕様テストまたは不要コードの削除で解消する。

## 4. 完成条件

mc-noise はプレビューを持たない。安定ライブラリ層は
「純粋関数・狭い界面」であって、ユーザが操作できるものではない。
プレビューを持つのは基盤層以上の責務である。

mc-noise の完成条件は次のとおりである。

- プロパティテスト（決定論・値域・連続性）が green
- **シード固定のゴールデン値**が固定されている。
  参照実装にリテラルなゴールデン値は存在しないので、これは新規に作る資産である（`porting.md` §6）
- `design-notes.md` N-8（半整数格子での勾配退化）は、現行の既知事項としてテストで固定している
- `NoisePrimitives`、4 チャンネルのチャンクサンプル、プリミティブ batch API は本リポジトリの契約として検証済み
- Simplex 2D/3D と Minecraft Java 1.21.1 を共通ノードの照合基準にし、1.21.8 の静的ノード一覧を監査した portable DensityFunction のノード（`Shift` / `ShiftA` / `ShiftB` / `shiftedNoise2d` / `noiseInRange` / `map` / `mapRange` / `lerp` / `LinearOperation` / `WeirdScaledSampler` / `EndIslands` / `old_blended_noise` を含む）、runtime marker の `beardifier`、1.21.9 で追加された `find_top_surface`、境界値、評価器、公開 API を仕様テストで検証済み。`old_blended_noise` の octave source と `beardifier` の構造物由来値は callback 境界を仕様化している
- 汎用の 2D/3D batch、grid、補間、chunk sampling API も本リポジトリの契約として検証済みである
- portable な NoiseRouter / Climate / Blender の構造・評価 API と、context-aware な DensityFunction のキャッシュ・blend ノードは本リポジトリで検証し、設定済みの Minecraft NoiseRouter、キャッシュのライフサイクル、地形制御点は mc-worldgen 側の統合テストで検証する

現在は 4 指標 100% のハードゲートを有効化している。新しい分岐を追加する場合は、
実装と同じ変更で仕様テストを追加し、4 指標の 100% しきい値を維持する。

公開前の手順は maintainer が認証環境で確認する。ビルドと tarball 境界は
`versioning.md` §3 に記載する。`1.0.0` への昇格はこの変更の完了条件ではなく、
mc-worldgen が契約を実際に消費して確認した後に判断する（`versioning.md` §2）。

## 5. CI

`.github/workflows/ci.yaml` は org 標準の kernel 形である。依存の install と検査コマンドは
`nix develop --command` 経由で実行する。

1. Checkout（`actions/checkout` を commit SHA 固定で使用し、`persist-credentials: false` と `fetch-depth: 0` を指定）
2. Setup pnpm（`pnpm/action-setup` を commit SHA 固定で使用）
3. Setup Node.js（pnpm キャッシュを有効にし、`actions/setup-node` を commit SHA 固定で使用）
4. Set up Nix（`.github/actions/nix-setup`。Cachix 経由でバイナリキャッシュ）
5. Configure GitHub Packages authentication（`NODE_AUTH_TOKEN` を pnpm の user config に設定）
6. `nix develop --command pnpm install --frozen-lockfile`
7. `nix develop --command pnpm verify`（typecheck / lint / test の3段）
8. Changeset status（`pull_request` かつ `docs/` `.github/` 以外の変更があるときだけ）
9. `nix develop --command pnpm test:coverage` —— **ハードゲート**。4 指標 100% しきい値（§3）を下回ると非ゼロ終了する
10. `nix develop --command pnpm package:verify`
11. `nix develop --command pnpm audit`
12. カバレッジレポートを artifact に upload（`actions/upload-artifact` を commit SHA 固定で使用し、7 日保持）

`.github/workflows/release.yaml` は `main` への push を detect → publish → tag の3ジョブで処理する
（[versioning.md](./versioning.md) §3）。

依存関係の許可グラフは `package.json`、`pnpm-workspace.yaml`、`.oxlintrc.json`、CI
とレビューで維持する。`.oxlintrc.json` の `no-restricted-imports` と `pnpm lint`
が出荷ソースの import 境界を検査し、推移依存・循環・宣言の妥当性はレビューで確認する。
API の破壊的変更は `test/public-api.test.ts` のゴールデン値と人間のレビューで判定する
（[versioning.md](./versioning.md) §6）。

## 6. 現時点のテスト一覧

| ファイル | 内容 |
| --- | --- |
| `test/determinism.test.ts` | 決定論（同一シード → ビット同一）、状態非共有、シード分岐、チャンネル非相関、`mulberry32` のストリーム再現 |
| `test/octaves.test.ts` | `octaveNoise2D` の値域と退化ケース、数値パラメータ検証、定数カーネルの代数、`signedFbm2D` の符号保持と NaN 保護、`noise2d`/`noise3d` の正規化、空間連続性 |
| `test/noise-primitives.test.ts` | `NoisePrimitives` の seed 分岐、raw / normalized 値域、チャンネル係数、チャンクサンプルの形状 |
| `test/terrain-channels.test.ts` | 4 チャンネルの疎サンプル、peaks-and-valleys 変換、双線形展開、座標検証 |
| `test/primitive-batches.test.ts` | 2D / 3D のプリミティブ batch、octave 引数、短い入力と sparse hole の扱い |
| `test/public-api.test.ts` | barrel の export、ゴールデン値、格子点で 0、canonical kernel の半整数サンプル、チャンネル salt の固定 |
| `test/noise-api-parity.test.ts` | mc-noise 0.4.0 の固定 seed 標本 39 件と、新しい公開 API の出力比較 |
| `test/interpolation.test.ts` | 疎サンプリング、双線形補間、評価回数、入力検証 |
| `test/chunk-sampling.test.ts` | `mc-kernel` の `ChunkCoord` を使ったチャンク原点・16×16 境界 |
| `test/chunk-volume-sampling.test.ts` | `ChunkHeight` を含む 16×高さ×16 の chunk volume sampling |
| `test/isotropic-field.test.ts` | 2D/3D フィールドの固定シード値と canonical kernel の契約 |
| `test/perlin-isotropic.test.ts` | 2D/3D Perlin の連続性・対称性・正規化前の値域 |
| `test/permutation.test.ts` | permutation table の決定論と入力範囲 |
| `test/sampling.test.ts` | 2D batch、grid、双線形補間、chunk sampling |
| `test/sampling-3d.test.ts` | 3D batch、grid、三線形補間、stride と入力検証 |
| `test/simplex.test.ts` | Minecraft 互換 Simplex の原点、permutation、2D/3D サンプリング |
| `test/java-random.test.ts` | Java Random の seed、符号拡張、`nextInt` / `nextFloat` 契約 |
| `test/end-islands.test.ts` | End Islands の seed、座標検証、値域 |
| `test/density-function.test.ts` | DensityFunction の AST、評価器、境界値、`find_top_surface`、portable helper |
| `test/density-function-codec.test.ts` / `test/density-function-transform.test.ts` | DensityFunction の codec 往復と子ノード変換、`find_top_surface` の再構成 |
| `test/density-function-context.test.ts` / `test/density-function-runtime.test.ts` | context-aware cache / blend と runtime の fill / map / 集約 |
| `test/density-function-node.test.ts` / `test/density-function-validation.test.ts` | 実行時 node wrapper とノード種別・入力検証 |
| `test/blender.test.ts` | identity の既定動作、`Result` callback、options と callback 出力の検証 |
| `test/climate.test.ts` | 6 次元 quantization、parameter point、距離・fitness、R-tree 検索、sampler と spawn search |
| `test/minecraft-biome-classifier.test.ts` | peaks-and-valleys 変換、気候からの biome 分類、biome と beach の refinement |
| `test/minecraft-biome.test.ts` | 気温・湿度による biome 分類と biome / block / surface / tree の定義表 |
| `test/minecraft-lakes.test.ts` | lake basin、surface 高さ、水位の優先順位、凍結、shore 判定 |
| `test/minecraft-surface.test.ts` | dry / underwater / shore / lake / snowy 条件ごとの surface material と filler depth |
| `test/minecraft-terrain-column.test.ts` | 気候・biome・lake・surface・water level を含む決定論的な地形 column |
| `test/minecraft-terrain.test.ts` | continentalness から surface height への変換、気候サンプル、biome 境界と値域検証 |
| `test/noise-router.test.ts` | 15 channel の契約、評価、map、runtime method、malformed router の検証 |
| `test/old-blended-noise.test.ts` | 公式 octave stack、clamp、source / option / sample 検証、overflow |
| `test/transforms.test.ts` | `Shift` / `ShiftA` / `ShiftB` の座標変換 |
| `test/spline.test.ts` | spline の制御点、補間、境界値 |
| `test/type-boundaries.test.ts` | absent value、乱数境界、decode 後の old-blended-noise callback 検証 |
| `test/value-noise.test.ts` | hash、lattice、value noise の決定論・補間・数値パラメータ検証 |
| `test/effect-test.ts` | Effect テストを `@effect/vitest` の `it.effect` に委譲する helper |

## 7. ベンチマーク（`pnpm bench`）

### なぜ必要か

`scripts/bench-noise.ts` は現在の `for` ループを凍結コピーと配列 `reduce` 版に対して測る。
ループを変更する提案では値の一致を確認したうえで、このベンチマークを実行する。

### 何を測っているか

`scripts/bench-density-function.ts` は固定座標で DensityFunction、NoiseRouter、Climate、
Blender の代表 workload を測り、noise/field とは独立した回帰観測を持つ。

mc-noise 自体はワールド生成チャンクを定義しないため、per-chunk の比較単位には
1 チャンク分の地形サンプリングが要求する 16×16 = 256 カラムを使う。
これは実在する量である（mc-worldgen の `generateChunk` はちょうどその回数だけカラムを引く）。
renderDistance=4 は 9×9 = 81 チャンクなので、x81 は 81 チャンク分の負荷を表す。
この負荷の定義は両リポジトリで同じである。

シードは定数 `20260726`。時計も未シードの PRNG も無い。

`scripts/bench-noise.ts` の測定対象は `octaveNoise2D`、`createNoiseField`、および
noise/field の hot loop である。DensityFunction、NoiseRouter、Climate、Blender、
context-aware な cache / blend は `scripts/bench-density-function.ts` で別に測定する。

### 計測前に等価性を検査している

複数の実装形（出荷版・スクリプト内の凍結コピー・配列 reduce 版など）が
1024 座標で**ビット単位で一致する**ことを、どれかを計測する前に確認する。
一致しない 2 つの関数を比べたベンチマークは何のベンチマークでもないし、
この検査は書き換えが「都合よく簡略化されていない」ことの担保でもある。

### 絶対値ではなく**比**を検査する

「0.0075 ms/chunk」という絶対値は記録した機械を写しているだけである。捕まえたいのは
「**3 倍遅くなった**」という変化なので、実装差を比較する guard と、処理量を比較する workload
の 2 種類を使う。

| 種類 | 定義 | 機械依存性 | 既定 tolerance |
| --- | --- | --- | --- |
| guard | 同一プロセス・同一データ上で複数実装を交互に測る比 | ノイズを減らすが、ホストと JIT に依存する | 1.30x。ただし shipped-vs-frozen は 1.15x |
| workload | workload と yardstick を隣接サンプルで交互に測った比 | guard より大きく依存する | 2.00x |

`yardstick` は workload と比べる基準処理である。`shipped-vs-frozen` は出荷関数と、
現行の関数形を保つスクリプト内コピーとの guard を指す。

`scripts/bench-baseline.json` の数値は特定の Node やハードウェアの性能を示さない。現行の測定方式に
対して保持する保守的な履歴基準である。基準や tolerance を揺れた実行に合わせて下げてはならない。

### 現行の計測方式

- guard は 20 回の warm-up 後、9 サンプルを同一プロセス内で測る。各サンプルで実装の先頭を
  ローテーションし、測定順の偏りを減らす。
- workload は yardstick と各 workload を同じサンプル内で交互に測り、サンプルごとの比の中央値で
  判定する。表示する絶対値は診断用である。
- 計測前に、出荷版・凍結コピー・3 つの書き換え（`Array.from().reduce`、`effect` の `Array.reduce`、`Effect.reduce`）が 1024 座標でビット単位に一致することを確認する。

shipped-vs-frozen は出荷実装と現在の形の凍結コピーを比較する主判定である。出荷実装と書き換え版を
比較するだけでは、両方が変わったときに差が隠れるため、この独立した比較を残している。

### ベンチで分からないこと

wall-clock は粗い道具である。tolerance より安い書き換えはすり抜けうるし、
閾値をどう選んでも線が動くだけでその性質は消えない。
綴りの不変条件は型システムと design-notes の名前付き回帰テストで検査する。
このファイルはそれに値札を付ける。どちらか一方を他方の理由で消してはならない。

### `verify` に入っていない理由と、CI について

これらのリポジトリは public で、CI は `pull_request` ごとに走る。
共有ランナーの実時間は負荷で揺れるため、benchmark の workload 比は通常のテストより不安定になる。

現時点では CI ジョブを追加しない。
`src/domain/` に触る PR で人間が走らせるものとして扱い、
足すとしても `push` on `main` か nightly（`pull_request` ではなく）にして、
guard だけを見る形が妥当である。
mc-noise は入力を固定できるため benchmark の候補にはなるが、現状は人間が変更時に実行する
診断用の判定として扱う。

### baseline の更新手順

```console
$ pnpm bench --update-baseline
```

`BENCH_MACHINE` 環境変数に値を入れると `recordedOn` に記録されるが、公開リポジトリへ
ホスト名・会社名・個人情報を記録してはならない。
**更新は必ず、何がどう動いたかをコミットメッセージに書いて行うこと。**
baseline を黙って上書きするのは、ベンチマークを削除するのと同じである。

## 8. 変更後の最終確認

実装または依存境界を変更したときは、1–5 を実行する。6 は flake を変更した場合、7 は性能に関わる hot loop を変更した場合に追加する。

1. `nix develop --command pnpm typecheck`
2. `nix develop --command pnpm lint`
3. `nix develop --command pnpm test`
4. `nix develop --command pnpm test:coverage`
5. `nix develop --command pnpm package:verify`
6. flake を変更した場合は `nix flake check --all-systems`
7. 性能の hot loop を変更した場合は `nix develop --command pnpm bench`

benchmark が赤い場合は基準や tolerance を弱めず、同じ条件で再実行して測定器と実装のどちらに
原因があるかを切り分ける。
