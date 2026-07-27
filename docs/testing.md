# 検証と完成条件

- 上位仕様: plan.md §3.2（検証）、§6 Step 2（完了条件）

## 1. コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm typecheck` | `tsconfig.build.json`（出荷ソース）と `tsconfig.test.json`（テスト・ツール）の両方 |
| `pnpm lint` | oxlint。このリポジトリ唯一の lint / format 設定（prettier も biome も .editorconfig も置かない）。**`--deny-warnings` 付きで走る**ため、`warn` のルールもビルドを落とす（`oxlint.json` は 5 カテゴリすべてと個別 66 ルールが `warn`、`error` は 4 つだけ。このフラグが無かった頃は実質その 4 つしかゲートになっていなかった） |
| `pnpm check:deps` | 依存ホワイトリスト + 循環検査 + `Date.now()` 禁止 |
| `pnpm api:check` | `api-lock.md` が実際の公開 API と食い違えば非ゼロ終了（[versioning.md](./versioning.md) §6） |
| `pnpm api:update` | `api-lock.md` を書き直す |
| `pnpm test` | vitest。`@effect/vitest` の `it.effect` が主 API |
| `pnpm test:coverage` | カバレッジ計測（閾値は未設定。§3 参照） |
| `pnpm verify` | `typecheck` / `lint` / `check:deps` / `api:check` / `test` を直列実行。**CI と同じ内容** |
| `pnpm bench` | ベンチマーク（`scripts/bench-noise.ts`）。**`verify` には入らない**（§7） |

セットアップ:

```console
$ direnv allow          # flake.nix の devShell で nodejs_22 + corepack が入る
$ pnpm install
```

Nix を使わない場合は Node.js 22 以上と pnpm 9.15.0 が要る。
`package.json` の `packageManager` が版を pin しているので `corepack pnpm ...` でよい。

> ツールチェーンは `devenv.nix` から `flake.nix` + `flake.lock` に移行済みである。
> `flake.lock` はコミットされているので、`nix develop`（`.envrc` は `use flake`）は
> 誰の手元でも同じ nixpkgs に解決される。`devenv.nix` / `devenv.lock` はもう存在しない。

## 2. テストの方針

### `it.effect` を使う

`@effect/vitest` の `it.effect` が主 API である。純粋な同期アサーションでも
`Effect.sync(() => { ... })` で包む。理由は一貫性であり、
Effect を要求するコードが後から入ったときにテストの書き方が変わらないためである。

**例外**（参照実装で確立済み、plan.md §3.13）: DOM イベントフローのテストで
`Effect.fork` + `Deferred.await` を `it.effect` の中に書くとデッドロックする。
そのときはプレーンな `it` + `Effect.runPromise` を使う。
mc-noise は DOM を触らないので現時点では該当しない。

### プロパティテストを優先する

`effect` の `FastCheck` re-export（`import { FastCheck } from 'effect'`）を使う。
`.npmrc` が `fast-check` と `pure-rand` を hoist しているのは、これの型解決と
Vite からの解決のためである。

mc-noise で最も価値が高いのは**決定論のプロパティテスト**である
（同一シード → 同一値）。plan.md §3.2 が seed→値 を凍結扱いにしている以上、
「凍結されている」ことが機械検査されていなければ宣言に意味がない。

比較は `===` ではなく `Object.is` を使う。`-0` と `0` の差は `===` を通り抜けたうえで、
後からゴールデン値テストを壊すからである。

決定論テストは**定数関数でも通る**ことに注意。
`different seeds disagree somewhere` がその防御である。

### 少数の誠実なテスト > 多数の自明なテスト

各テストは「何が壊れたら落ちるか」が一意に分かる名前を持つこと。
`design-notes.md` の各項目には**回帰テスト名**が振ってあり、ソースのコメントからも
同じ名前で参照している。テストを消すときは design-notes 側も同時に更新すること。

## 3. カバレッジ閾値は**まだ**有効化していない

参照実装は branches / functions / lines / statements すべてに **99%** を強制している。
本リポジトリは計測とレポートは常に動かしているが、**閾値は設定していない**。

理由（`vitest.config.ts` のコメントにも記載）:
スケルトンに閾値を課しても意味がない。第一版のモジュール数個で自明に満たされてしまい、
実装の質については何も言わない数字になる。

**99% ゲートは完成条件（§4）に到達した時点で、`vitest.config.ts` と CI の両方で有効化する。**

```typescript
// vitest.config.ts に追加する行
thresholds: { branches: 99, functions: 99, lines: 99, statements: 99 },
```

## 4. 完成条件

plan.md §6 Step 2 の各リポジトリ完了条件は
「ユニット/シナリオテスト green + 内蔵プレビューが操作可能」である。

**mc-noise はプレビューを持たない。** 安定ライブラリ層（plan.md §2.2）は
「純粋関数・狭い界面」であって、ユーザが操作できるものではない。
plan.md §2.3-4 が「プレビューは検証対象と同居する」と定め、
§3.7 が「worldgen の地形プレビューが最初の遊べる成果物」と明示しているとおり、
プレビューを持つのは基盤層以上である。

したがって mc-noise の完成条件は:

- プロパティテスト（**決定論・値域・連続性**）が green —— plan.md §3.2 の要求そのまま
- **シード固定のゴールデン値**が固定されている —— 同上。
  参照実装にリテラルなゴールデン値は存在しないので、これは新規に作る資産である（`porting.md` §6）
- グリーディに追加すべき残件:
  - `design-notes.md` N-8（半整数格子での勾配退化）の解消、または恒久的な既知事項としての受理
  - `computeTerrainChannels` 相当（疎グリッド + 双線形補間）を入れるかどうかの判断。
    入れるならベンチマークを先にリポジトリに置くこと

到達時に行うこと:

1. `vitest.config.ts` と `.github/workflows/ci.yaml` で 99% 閾値を有効化
2. ビルド / publish パイプラインを追加（`versioning.md` §3）
3. `0.x` → `1.0.0`（mc-worldgen が実際に消費して契約を確認したら）

## 5. CI

`.github/workflows/ci.yaml` は `pnpm verify` と同じ内容を job のステップに展開したものである
（失敗箇所が step 名で分かるようにするため）:

1. Checkout
2. Setup pnpm（`pnpm/action-setup@v4`）
3. Setup Node.js 22（pnpm キャッシュ有効）
4. `pnpm install --frozen-lockfile`
5. `pnpm typecheck`
6. `pnpm lint`
7. `pnpm check:deps` —— **ハードゲート**。参照実装の `check-package-dag.ts` と違い、
   違反があれば必ず非ゼロ終了する
8. `pnpm api:check`（step 名は `API lock`）—— **ハードゲート**。`api-lock.md` が
   現在の公開 API と食い違えば非ゼロ終了する（[versioning.md](./versioning.md) §6）
9. `pnpm test`
10. `pnpm test:coverage`（閾値なし。§3）
11. カバレッジレポートを artifact に upload（7 日保持）

## 6. 現時点のテスト一覧

| ファイル | 内容 |
| --- | --- |
| `test/determinism.test.ts` | 決定論（同一シード → ビット同一）、状態非共有、シード分岐、チャンネル非相関、`mulberry32` のストリーム再現 |
| `test/octaves.test.ts` | `octaveNoise2D` の値域と退化ケース、定数カーネルの代数、`signedFbm2D` の符号保持と NaN 保護、`noise2d`/`noise3d` の正規化、空間連続性 |
| `test/public-api.test.ts` | barrel の export、**ゴールデン値**、格子点で 0、半整数格子の既知アーティファクト、チャンネル salt の固定 |
| `test/check-dependency-whitelist.test.ts` | 16 リポジトリ roster の完全性、非循環、体験モジュール間エッジ 0、kit の devDependency 専用性、推移閉包の拒否、`Date.now()` 禁止、import 抽出 |

## 7. ベンチマーク（`pnpm bench`）

### なぜ必要か

`domain/octaves.ts` の冒頭はこう終わっている:

> もし誰かがこのループの置換を提案したら、答えは「先にベンチマークを書き、それをリポジトリに入れろ」である。

**リポジトリにベンチマークが無かったので、この一文は借用書だった。**
plan.md §5.2 はこの例外を「実測で確定した」と書いているが、5 つの例外のうち
オクターブループは**コメント 1 つしか防護が無い**——最も弱い状態にあった。
`scripts/bench-noise.ts` はその借用書を清算する。コメントが名指しする書き換えは
**全部その場に実装してあり**、本物と並べて計測される。
fold を提案するレビュアーには、主張ではなく数字が返る。

### 何を測っているか

手法は参照実装の `scripts/bench-terrain.ts` のもの——**ウォームアップののち 9 回計測しその中央値**。
9 という数（メッシングの 7 ではなく）は、これが terrain 側のワークロードだからそのまま踏襲した。

チャンクという単位は mc-noise には無いので、per-chunk の単位は
**1 チャンク分の地形サンプリングが要求する 16×16 = 256 カラム**とした。
これは実在する量である（mc-worldgen の `generateChunk` はちょうどその回数だけカラムを引く）。
これにより x81（renderDistance=4）という枠組みが両リポジトリで同じ意味を持つ。

シードは定数 `20260726`。時計も未シードの PRNG も無い。

### 計測前に**等価性**を検査している

5 つの綴り（出荷版・凍結コピー・`Array.from().reduce`・effect の `Array.reduce`・`Effect.reduce`）が
1024 座標で**ビット単位で一致する**ことを、どれかを計測する前に確認する。
一致しない 2 つの関数を比べたベンチマークは何のベンチマークでもないし、
この検査は書き換えが「都合よく簡略化されていない」ことの担保でもある。

### 絶対値ではなく**比**を検査する

「0.0075 ms/chunk」という絶対値は記録した機械を写しているだけである。捕まえたいのは
**「3 倍遅くなった」**のほうなので、2 種類の比を使う:

| 種類 | 定義 | 機械依存性 | 既定 tolerance |
| --- | --- | --- | --- |
| **guard** | 同一プロセス・同一データ上での 2 実装の A/B 比 | **無い**（機械が約分される） | 1.30x。ただし shipped-vs-frozen は 1.15x |
| **workload** | 実測値 ÷ 同じ run 内で測った yardstick | 近似的にしか無い | 2.00x |

`scripts/bench-baseline.json` がコミットされた baseline で、記録は
**5 回の通し実行の中央値**であり 1 回の実行ではない。

### 実測値（Apple M4 Max / Node 22.23.1、5 回通しの中央値、4 オクターブ・20 万サンプル）

| guard | 比 |
| --- | --- |
| `octave-loop/effect-reduce-vs-imperative` | **6.6x** |
| `octave-loop/array-from-reduce-vs-imperative` | **2.8x** |
| `octave-loop/effect-array-reduce-vs-imperative` | **1.3x** |
| `octave-loop/shipped-vs-frozen-imperative` | 0.84（ゲート。詳細は下） |

**design-notes N-1 の表の訂正**: 3 つの書き換えは「すべてコストだけを増やす」という記述は正しいが、
**増え方が桁で違う**。`Effect.reduce`（オクターブごとに fiber step）は 6.6 倍、
`Array.from().reduce` は 2.8 倍、しかし **effect の `Array.reduce` は 1.3 倍にとどまる**。
1.3 倍は「無視してよい」という意味ではない——これはワールド生成の最内ループである——が、
「桁違いに遅い」ではない。数字を持っておくほうが、持たずに主張するより強い。

### ゲート（shipped-vs-frozen）が 1.00 ではなく 0.84 である理由

このゲートは出荷している `octaveNoise2D` を、**その現在の形をそのまま凍結したコピー**と比較する。
凍結コピーはこのモジュールのローカルにあり、V8 はモジュール境界を越える import より
ローカルのほうを少しよくインライン化する。0.84 はその差であって `octaveNoise2D` の性質ではない。
重要なのは**その値が安定していること**で、5 回通しの散らばりはファイル中で最小の **1%** である。

書き換え版と比較するだけでは不十分である: 比はどちらの辺が変わっても同じ向きに動くので、
`octaveNoise2D` 自身が fold になったら「書き換えは N 倍遅い」という比は
すべて 1 に近づくだけで、tolerance の内側に収まってしまいうる。

### ゲートが実際に落ちることの確認

`domain/octaves.ts` の `octaveNoise2D` を effect の `Array.reduce` で書き換えて実行した:

```
REGRESSED  octave-loop/shipped-vs-frozen-imperative       observed 0.629  baseline 0.841  (0.75x)
REGRESSED  octave-loop/effect-array-reduce-vs-imperative  observed 0.971  baseline 1.309  (0.74x)
REGRESSED  octave-loop/effect-reduce-vs-imperative        observed 5.022  baseline 6.560  (0.77x)
REGRESSED  sample/octave2d-per-chunk-columns              observed 3.500  baseline 1.458  (2.40x)
```

4 件の regression と exit 1。**これは 3 つの書き換えのうち最も安いもの**（1.3 倍）であり、
guard tolerance が 1.30 のままなら 0.79x でぎりぎり通過していた。
shipped-vs-frozen に専用の 1.15 を与えているのはこのためである
（そのゲートの散らばりは 1% なので、締めても揺れない）。
なお workload `sample/octave2d-per-chunk-columns` は独立に 2.4 倍で捕まえており、
2 系統の冗長性が実際に効いている。

### ベンチが**できない**こと

wall-clock は粗い道具である。tolerance より安い書き換えはすり抜けうるし、
閾値をどう選んでも線が動くだけでその性質は消えない。
**綴りの不変条件は型システムと design-notes の名前付き回帰テストの仕事**であって、
このファイルはそれに値札を付ける。どちらか一方を他方の理由で消してはならない。

### `verify` に入っていない理由と、CI について

これらのリポジトリは public で、CI は **`pull_request` ごとに**走る。
ベンチマークは 8 秒前後だが、共有ランナーの実時間は負荷で揺れる——
つまり workload 比は CI ではここで測ったより不安定になる。

**推奨**: 現時点で CI ジョブを足す必要は無い。
`domain/` に触る PR で人間が走らせるものとして扱い、
足すとしても `push` on `main` か nightly（`pull_request` ではなく）にして、
guard だけを見る形が妥当である。
mc-noise はゲートとして最も筋がよい（散らばりが小さく、シードが定数で、
ワークロードが数秒で終わる）ので、3 リポジトリのうち最初に CI に載せるならここである。

### baseline の更新手順

```console
$ pnpm bench --update-baseline
```

`BENCH_MACHINE` 環境変数に機械の説明を入れると `recordedOn` に記録される。
**更新は必ず、何がどう動いたかをコミットメッセージに書いて行うこと。**
baseline を黙って上書きするのは、ベンチマークを削除するのと同じである。

## 直前のカバレッジ拡張について — コミットメッセージの数字が誤っている

`test: cover the code the suites were walking past` のコミットメッセージは
「added 107 tests」と書いているが、**正しくは 27 本**である
(mc-noise 8 + mc-meshing 13 + mc-physics 6)。本リポジトリの実測は **79 → 87**。

107 は 1 日古いレビューの baseline (53/53/68) から引いた差であり、
その時点から 3 リポジトリはすでに 79/79/96 まで育っていた。
16 リポジトリ合計も 2,771 → 2,798 で、差は 27 と一致する。

**この誤りをここに残すのは、それが本プロジェクトで最も多く記録されている欠陥だからである** ——
「結論は正しく、証拠が間違っている」。`CONTINENTALNESS_CONTRAST`、`SETTLE_TICK_LIMIT`、
mc-meshing の HashSet 主張、`setDayLength → setTimeOfDay` の作業例に続く 5 例目で、
しかも**テストカバレッジを説明する文章の中で**やっている。
default branch は `non_fast_forward` で保護されているため履歴は書き換えられない。
書き換えられないこと自体は正しい設計であり、だから訂正はここに置く。
