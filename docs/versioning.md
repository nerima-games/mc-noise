# バージョニングと公開

- 上位仕様: plan.md §6 Step 0 / Step 3、§9

## 1. 現在のバージョン: `0.1.0`

**1.0.0 にするのは、上流の消費者が実際にこのリポジトリを消費して契約を確認したときである。**

| バージョン | 意味 |
| --- | --- |
| `0.x` | 界面が未確定。**破壊的変更を minor bump で行ってよい**（semver の 0.x 規定どおり） |
| `1.0.0` | mc-worldgen がこのリポジトリを実際に import し、公開 API が要求を満たすことを確認した |

「テストが green だから 1.0.0」ではない。テストは自分で書いた仮説を検証するだけであり、
界面が**使えるか**は消費者にしか分からない。plan.md §8 のリスク表が
「新規構築初期は全界面が高 churn」を挙げ、その対策として
「npm 公開を遅らせ dev-meta workspace で開発」を指定しているのはこの理由による。

## 2. なぜ今は publish しないのか（plan.md §6 Step 0-2）

**1.0.0 への昇格に、日数計測ベースの自動ゲートは存在しない。** かつては「4週間 API 無変更で凍結」
という freeze-clock 言語がここにあったが、その仕組み（`api-lock.md` + `scripts/api-lock.ts`）は
org 標準から撤去された（[API_STANDARD.md §4](https://github.com/nerima-games/.github/blob/main/API_STANDARD.md#4-自動-apiロックスナップショットツールは使わない)）。
1.0.0 への昇格は maintainer(take) の裁量判断のみで行う
（[RELEASE_STANDARD.md §4.2](https://github.com/nerima-games/.github/blob/main/RELEASE_STANDARD.md#42-新しい昇格ポリシー人間による裁量判断)）。
実質的なトリガーは「上位階層（`mc-worldgen`）が実際にこのリポジトリを消費し、動作確認を終える」ことだが、
それをもって自動的に 1.0.0 へ上がるわけではない。

16 リポジトリが互いを pin したバージョンで参照し合っている状態で界面が動くと、
1 つの変更が bump の連鎖を引き起こす。初期は全界面が高 churn なので、これは常時起きる。

対策は **mc-dev-meta workspace**（plan.md §6 Step 0-2）:
16 リポジトリの clone を `repos/` 配下に並べて 1 つの pnpm workspace として束ねる薄いリポジトリ。
開発中は `workspace:*` 解決でモノレポ同等の DX が得られ、bump 連鎖が構造的に発生しない。

したがって現在の `package.json` は:

- `dependencies` に `effect` だけを宣言する。`@nerima-games/*` は 1 つも入っていない。
- `exports` は **TypeScript ソースを直接指す**（`./src/index.ts`）。ビルド成果物ではない。
- ビルド / publish パイプラインは存在しない。バージョニングと CHANGELOG 生成は `@changesets/cli`
  に一本化されている（[RELEASE_STANDARD.md §1](https://github.com/nerima-games/.github/blob/main/RELEASE_STANDARD.md#1-changesets-導入)、`.changeset/config.json`）。

## 3. ビルドと publish は完成条件到達時に追加する

`tsconfig.base.json` は `"noEmit": true` である（コメントで理由を明記している）。
`.gitignore` の `dist/` には `# Build outputs (none yet — the build pipeline is added at completion)` と書いてある。

完成条件（`testing.md` §4）に到達した時点で追加するもの:

1. `tsconfig.build.json` の `noEmit` を外し、`dist/` に `.js` + `.d.ts` + source map を出す
2. `package.json` の `exports` を `dist/` に向ける（`files` も同様）
3. `prepublishOnly` で `pnpm verify` を強制
4. CI に publish job を追加（`.github/workflows/ci.yaml` は現在 typecheck / lint / test / coverage のみ）
5. changesets 運用に切り替え（plan.md §6 Step 3）

## 4. 公開先: GitHub Packages

`package.json`:

```json
"publishConfig": {
  "registry": "https://npm.pkg.github.com",
  "access": "restricted"
}
```

plan.md §9 の未決事項に「パッケージ公開先（GitHub Packages / private registry）」があるが、
Step 0 の実装として GitHub Packages を選んである。組織 `nerima-games` の下に 16 パッケージが並ぶ。

消費側は `.npmrc` に次を要する:

```
@nerima-games:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

（本リポジトリの `.npmrc` には**この設定は入っていない**。今は誰も `@nerima-games/*` を
解決しないためである。現在の `.npmrc` の中身は `fast-check` / `pure-rand` の hoist だけで、
これは `effect/FastCheck` の型解決のために必要な設定である。）

## 5. 何が破壊的変更なのか

> **`0.x` の間の読み替え（全 16 リポジトリ共通の方針）**
>
> 本リポジトリは `0.1.0` であり、下流が契約を実際に消費して確認するまで `0.x` から出ない。
> **semver では `0.x` の破壊的変更は major bump ではなく minor bump である**（`0.1.0` → `0.2.0`）。
> したがって以下の MAJOR / MINOR / PATCH は **`1.0.0` 到達後の分類**であり、
> `0.x` の間は次のように読み替える。
>
> | 分類 | `1.0.0` 到達後 | `0.x` の間（現在） |
> | --- | --- | --- |
> | MAJOR | major bump | **minor bump**（`0.1.0` → `0.2.0`） |
> | MINOR | minor bump | patch bump |
> | PATCH | patch bump | patch bump |
>
> 分類そのものは `0.x` でも意味を持つ。MAJOR に分類される変更は、
> bump の大きさに関わらず**下流に必ず影響するもの**であり、告知と協調リリースの対象である。
> `0.x` の間に major bump を切ることはない。

### MAJOR（1.0.0 到達後）

**seed → 値の写像を変えるものはすべて MAJOR である**（plan.md §3.2 が「凍結扱い」と宣言）。
具体的には、以下のいずれかを変えたら過去に保存されたすべてのワールドの地形が変わる:

- PRNG（`mulberry32`）
- チャンネル salt（`CHANNEL_SALT`）
- permutation の shuffle 手順（Fisher-Yates の向き、`buildPermutation`）
- fade 曲線（`6t^5 - 15t^4 + 10t^3`）
- 勾配集合（`gradient2d` / `gradient3d`）
- 振幅スケール（`Math.SQRT2` / `Math.sqrt(3)`）
- `CHANNEL_PARAMS` の octaves / persistence / lacunarity
- 値域の規約（`noise2d` を符号付きにする等）

`test/public-api.test.ts` のゴールデン値がこれを機械的に検出する。
**ビルドを通すためにゴールデン値を更新してはならない。** 更新するなら:

1. MAJOR bump
2. mc-save 側のマイグレーション方針（既存ワールドをどうするか）
3. mc-worldgen の地形ゴールデンテストの更新

がセットで必要である。

`design-notes.md` N-8（半整数格子での勾配退化）は既存写像を変更せず、8方向の
`createPerlinNoise2DIsotropic` を追加することで対処した。既存worldはlegacy APIを維持し、
新規worldだけが永続化したカーネル選択に基づいてopt-inするため、これは加算的変更である。

### MINOR

- 新しいチャンネルの追加（既存チャンネルのストリームは変わらない）
- 新しい合成ヘルパの追加
- Simplex カーネルの追加

### PATCH

- ドキュメント、コメント、テスト
- 観測可能な値を変えない内部リファクタ（**ゴールデン値テストが green のままであること**が判定基準）

## 6. API ロックファイルは廃止された

plan.md §6 Step 0-3 はかつて「初回コミットに ... APIロックファイル（公開APIのレポートを diff
レビュー）」を求めていたが、この自前の自動 API スナップショット/diff 機構（`api-lock.md` +
`scripts/api-lock.ts` + `pnpm api:check` / `api:update`）は org 標準から全廃された
（[API_STANDARD.md §4](https://github.com/nerima-games/.github/blob/main/API_STANDARD.md#4-自動-apiロックスナップショットツールは使わない)）。
`@microsoft/api-extractor` はかつて mc-kernel の実コードで試したうえで却下されている
（決め手は `Context.Tag` のサービスクラスが写らないこと）。今後この種の仕組みを復活させる提案は
まずこの経緯と API_STANDARD.md §4 の決定を踏まえること。

破壊的変更の判定は、今後は**人間のレビュー**（[API_STANDARD.md §3](https://github.com/nerima-games/.github/blob/main/API_STANDARD.md#3-破壊的変更-vs-加算的変更)）
と、機械的に検出できる部分については引き続き `test/public-api.test.ts` のゴールデン値に委ねる。

**`test/public-api.test.ts` は残っているし、消す理由もない。** barrel の export 名を明示的に
列挙してピン留めし、**名前の消失**を実行時に落とす役目はそのままである。上の §5 が MAJOR 一覧に
挙げる「seed → 値の写像」（PRNG・fade 曲線・勾配集合・振幅スケール・チャンネル salt・
`CHANNEL_PARAMS` の octaves / persistence / lacunarity）は、シグネチャの見た目を変えずに値だけが
変わりうるため、api-lock のような型シグネチャの diff では最初から検出できていなかった。
これを機械的に検出するのは一貫して `test/public-api.test.ts` のゴールデン値であり、その役割は
api-lock の廃止によって変わらない。**ゴールデン値は写像そのものを見る。**

mc-worldgen がこのリポジトリを pin する以上、公開シグネチャの破壊的変更はレビューで、
写像そのものの破壊的変更はゴールデン値で捕まえる、という二本立てになる。
