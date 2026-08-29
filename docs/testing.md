# 検証と完成条件

- 根拠: `package.json`、`vitest.config.ts`、現行テストと公開 API

## 1. コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm typecheck` | `tsconfig.build.json`（出荷ソース）と `tsconfig.test.json`（テスト・ツール）の両方 |
| `pnpm lint` | oxlint。このリポジトリ唯一の lint / format 設定（prettier も biome も .editorconfig も置かない）。**`--deny-warnings` 付きで走る**ため、`warn` のルールもビルドを落とす（`.oxlintrc.json` は 5 カテゴリすべてと個別 58 ルールが `warn`、`error` は `no-eval` / `no-implied-eval` / `no-restricted-imports` の3つだけ。このフラグが無かった頃は実質その3つしかゲートになっていなかった） |
| `pnpm test` | Vitest。純粋なテストと `test/effect-test.ts` の同期 Effect テストを実行 |
| `pnpm test:coverage` | カバレッジ計測。4 指標 100% のしきい値ゲート付き（§3 参照） |
| `pnpm verify` | `typecheck` / `lint` / `test` を直列実行。カバレッジと配布物境界検査は別ステップ |
| `pnpm build` | `dist/` に JavaScript・宣言ファイル・source map を生成 |
| `pnpm package:verify` | ビルド済み公開 API と npm アーカイブの内容を検査 |
| `pnpm bench` | ベンチマーク（`scripts/bench-noise.ts`）。**`verify` には入らない**（§7） |

セットアップ:

```console
$ direnv allow          # flake.nix の devShell で Node.js + corepack が入る
$ pnpm install
```

Nix を使わない場合は `package.json` の `engines` を満たす Node.js と、
`packageManager` が指定する pnpm が要る。
`package.json` の `packageManager` が版を pin しているので `corepack pnpm ...` でよい。

> ツールチェーンは `devenv.nix` から `flake.nix` + `flake.lock` に移行済みである。
> `flake.lock` はコミットされているので、`nix develop`（`.envrc` は `use flake`）は
> 誰の手元でも同じ nixpkgs に解決される。`devenv.nix` / `devenv.lock` はもう存在しない。

## 2. テストの方針

### Effect テストと純粋な `it`

mc-noise の大半は同期的な純粋関数なので、その値・境界値・決定論の契約テストには
Vitest のプレーンな `it` を使う。Effect を要求するコードを検証するときは
`test/effect-test.ts` の `effectTest` を使い、同期 Effect を `Effect.runSync` で実行する。

非同期 Effect を追加する場合は、テスト本体で `Effect.runPromise` を使い、
Vitest の非同期テスト契約に合わせる。

### プロパティテストを優先する

`effect` の `FastCheck` re-export（`import { FastCheck } from 'effect'`）を使う。
`.npmrc` が `fast-check` と `pure-rand` を hoist しているのは、これの型解決と
Vite からの解決のためである。

mc-noise で最も価値が高いのは**決定論のプロパティテスト**である
（同一シード → 同一値）。seed→値を凍結契約として扱う以上、
「凍結されている」ことが機械検査されていなければ宣言に意味がない。

比較は `===` ではなく `Object.is` を使う。`-0` と `0` の差は `===` を通り抜けたうえで、
後からゴールデン値テストを壊すからである。

決定論テストは**定数関数でも通る**ことに注意。
`different seeds disagree somewhere` がその防御である。

### 少数の誠実なテスト > 多数の自明なテスト

各テストは「何が壊れたら落ちるか」が一意に分かる名前を持つこと。
`design-notes.md` の各項目には**回帰テスト名**が振ってあり、ソースのコメントからも
同じ名前で参照している。テストを消すときは design-notes 側も同時に更新すること。

## 3. カバレッジ閾値

branches / functions / lines / statements の 4 指標すべてに **100%** のしきい値を設定している。
しきい値は実装の質を先取りするものではなく、実際に実行されたコード経路を検査するゲートである。

```typescript
// vitest.config.ts（有効化済み）
thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
```

`pnpm test:coverage` は、テスト件数が 0 でないことを確認したうえでこのしきい値を適用する。
未達時はしきい値を緩めず、未検証の分岐を特定して仕様テストまたは不要コードの削除で解消する。

## 4. 完成条件

各リポジトリの完了条件は「ユニット/シナリオテスト green」である。

**mc-noise はプレビューを持たない。** 安定ライブラリ層は
「純粋関数・狭い界面」であって、ユーザが操作できるものではない。
プレビューを持つのは基盤層以上の責務である。

したがって mc-noise の完成条件は:

- プロパティテスト（**決定論・値域・連続性**）が green
- **シード固定のゴールデン値**が固定されている。
  参照実装にリテラルなゴールデン値は存在しないので、これは新規に作る資産である（`porting.md` §6）
- `design-notes.md` N-8（半整数格子での勾配退化）は、現行の既知事項としてテストで固定している
- `NoisePrimitives`、4 チャンネルのチャンクサンプル、プリミティブ batch API は本リポジトリの契約として検証済み
- Simplex 2D/3D と Minecraft Java 1.21.1 を共通ノードの照合基準にし、1.21.8 の静的ノード一覧を監査した portable DensityFunction のノード（`Shift` / `ShiftA` / `ShiftB` / `shiftedNoise2d` / `noiseInRange` / `map` / `mapRange` / `lerp` / `LinearOperation` / `WeirdScaledSampler` / `EndIslands` / `old_blended_noise` を含む）、runtime marker の `beardifier`、1.21.9 で追加された `find_top_surface`、境界値、評価器、公開 API を仕様テストで検証済み。`old_blended_noise` の octave source と `beardifier` の構造物由来値は callback 境界を仕様化している
- 汎用の 2D/3D batch、grid、補間、chunk sampling API も本リポジトリの契約として検証済みである
- portable な NoiseRouter / Climate / Blender の構造・評価 API と、context-aware な DensityFunction のキャッシュ・blend ノードは本リポジトリで検証し、設定済みの Minecraft NoiseRouter、キャッシュのライフサイクル、地形制御点は mc-worldgen 側の統合テストで検証する

現在は 4 指標 100% のハードゲートを有効化している。新しい分岐を追加する場合は、
実装と同じ変更で仕様テストを追加し、ゲートを維持する:

1. publish 手順を maintainer の認証環境で確認（ビルドと tarball 境界は `versioning.md` §3 で実装済み）
2. `0.x` → `1.0.0`（mc-worldgen が実際に消費して契約を確認したら、maintainer の裁量判断で。
   `versioning.md` §2）

## 5. CI

`.github/workflows/ci.yaml` は `pnpm verify` と同じ内容を job のステップに展開したものである
（失敗箇所が step 名で分かるようにするため）:

1. Checkout（`actions/checkout` — commit SHA 固定、`persist-credentials: false`）
2. Setup pnpm（`pnpm/action-setup` — commit SHA 固定）
3. Setup Node.js（pnpm キャッシュ有効。`actions/setup-node` — commit SHA 固定）
4. `pnpm install --frozen-lockfile --ignore-scripts`
5. `pnpm typecheck`
6. `nix develop --command pnpm lint`
7. `pnpm test`
8. `pnpm package:verify`
9. `pnpm test:coverage` —— **ハードゲート**。4 指標 100% しきい値（§3）を下回ると非ゼロ終了する
10. カバレッジレポートを artifact に upload（`actions/upload-artifact` — commit SHA 固定、7 日保持）

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
| `test/public-api.test.ts` | barrel の export、**ゴールデン値**、格子点で 0、canonical kernel の半整数サンプル、チャンネル salt の固定 |
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
| `test/transforms.test.ts` | `Shift` / `ShiftA` / `ShiftB` の座標変換 |
| `test/spline.test.ts` | spline の制御点、補間、境界値 |
| `test/value-noise.test.ts` | hash、lattice、value noise の決定論・補間・数値パラメータ検証 |

## 7. ベンチマーク（`pnpm bench`）

### なぜ必要か

`domain/octaves.ts` の冒頭はこう終わっている:

> もし誰かがこのループの置換を提案したら、答えは「先にベンチマークを書き、それをリポジトリに入れろ」である。

**リポジトリにベンチマークが無かったので、この一文は借用書だった。**
初期資料はこの例外を「実測で確定した」と書いているが、5 つの例外のうち
オクターブループは**コメント 1 つしか防護が無い**——最も弱い状態にあった。
`scripts/bench-noise.ts` はその借用書を清算する。コメントが名指しする書き換えは
**全部その場に実装してあり**、本物と並べて計測される。
fold を提案するレビュアーには、主張ではなく数字が返る。

### 何を測っているか

`scripts/bench-noise.ts` は**ウォームアップののち複数回計測し中央値を採る**。
`scripts/bench-density-function.ts` は固定座標で DensityFunction、NoiseRouter、Climate、
Blender の代表 workload を測り、noise/field とは独立した回帰観測を持つ。

チャンクという単位は mc-noise には無いので、per-chunk の単位は
**1 チャンク分の地形サンプリングが要求する 16×16 = 256 カラム**とした。
これは実在する量である（mc-worldgen の `generateChunk` はちょうどその回数だけカラムを引く）。
これにより x81（renderDistance=4）という枠組みが両リポジトリで同じ意味を持つ。

シードは定数 `20260726`。時計も未シードの PRNG も無い。

`scripts/bench-noise.ts` の測定対象は `octaveNoise2D`、`createNoiseField`、および
noise/field の hot loop である。DensityFunction、NoiseRouter、Climate、Blender、
context-aware な cache / blend は `scripts/bench-density-function.ts` で別に測定する。

### 計測前に**等価性**を検査している

複数の実装形（出荷版・凍結コピー・配列 reduce 版など）が
1024 座標で**ビット単位で一致する**ことを、どれかを計測する前に確認する。
一致しない 2 つの関数を比べたベンチマークは何のベンチマークでもないし、
この検査は書き換えが「都合よく簡略化されていない」ことの担保でもある。

### 絶対値ではなく**比**を検査する

「0.0075 ms/chunk」という絶対値は記録した機械を写しているだけである。捕まえたいのは
**「3 倍遅くなった」**のほうなので、実装差を比較する guard と、処理量を比較する workload
の 2 種類を使う。

| 種類 | 定義 | 機械依存性 | 既定 tolerance |
| --- | --- | --- | --- |
| **guard** | 同一プロセス・同一データ上で複数実装を交互に測る比 | ノイズを減らすが、ホストと JIT に依存する | 1.30x。ただし shipped-vs-frozen は 1.15x |
| **workload** | workload と yardstick を隣接サンプルで交互に測った比 | guard より大きく依存する | 2.00x |

`scripts/bench-baseline.json` の数値は、Node やハードウェアを代表する値ではなく、現行の測定方式で
保持している保守的な履歴基準である。基準や tolerance を、揺れた実行に合わせて下げてはならない。

### 現行の計測方式

- guard は 20 回の warm-up 後、9 サンプルを同一プロセス内で測る。各サンプルで実装の先頭を
  ローテーションし、測定順の偏りを減らす。
- workload は yardstick と各 workload を同じサンプル内で交互に測り、サンプルごとの比の中央値を
  ゲートに使う。表示する絶対値は診断用であり、ゲート値ではない。
- 計測前に、出荷版・凍結コピー・3 つの書き換えが 1024 座標でビット単位に一致することを確認する。

shipped-vs-frozen は出荷実装と現在の形の凍結コピーを比較する主ゲートである。出荷実装と書き換え版を
比較するだけでは、両方が変わったときに差が隠れるため、この独立した比較を残している。

### ベンチが**できない**こと

wall-clock は粗い道具である。tolerance より安い書き換えはすり抜けうるし、
閾値をどう選んでも線が動くだけでその性質は消えない。
**綴りの不変条件は型システムと design-notes の名前付き回帰テストの仕事**であって、
このファイルはそれに値札を付ける。どちらか一方を他方の理由で消してはならない。

### `verify` に入っていない理由と、CI について

これらのリポジトリは public で、CI は **`pull_request` ごとに**走る。
共有ランナーの実時間は負荷で揺れるため、benchmark の workload 比は通常のテストより不安定になる。

**推奨**: 現時点で CI ジョブを足す必要は無い。
`domain/` に触る PR で人間が走らせるものとして扱い、
足すとしても `push` on `main` か nightly（`pull_request` ではなく）にして、
guard だけを見る形が妥当である。
mc-noise は入力を固定できるため benchmark の候補にはなるが、現状は人間が変更時に実行する
診断ゲートとして扱う。

### baseline の更新手順

```console
$ pnpm bench --update-baseline
```

`BENCH_MACHINE` 環境変数に値を入れると `recordedOn` に記録されるが、公開リポジトリへ
ホスト名・会社名・個人情報を記録してはならない。
**更新は必ず、何がどう動いたかをコミットメッセージに書いて行うこと。**
baseline を黙って上書きするのは、ベンチマークを削除するのと同じである。

## 8. 変更後の最終確認

実装や依存境界を変更したときは、変更範囲に応じて次の確認を行う。

1. `corepack pnpm typecheck`
2. `nix develop --command corepack pnpm lint`
3. `corepack pnpm test`
4. `nix develop --command corepack pnpm test:coverage`
5. `corepack pnpm package:verify`
6. flake を変更した場合は `nix flake check --all-systems`
7. 性能の hot loop を変更した場合は `corepack pnpm bench`

benchmark が赤い場合は基準や tolerance を弱めず、同じ条件で再実行して測定器と実装のどちらに
原因があるかを切り分ける。
