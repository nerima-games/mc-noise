# mc-noise ドキュメント

このリポジトリを実装・検証するために必要な情報を、現行の公開 API、依存境界、
参照実装の file:line 根拠とともにまとめたもの。

参照実装（`takeokunn/ts-minecraft`）の記述には**すべて file:line の裏付け**を付けてある。
初期資料の数値のうち再検証で食い違ったものは `porting.md` に訂正として記録した。

## 表記

| 表記 | 意味 |
| --- | --- |
| `<reference-impl>` | **参照実装のチェックアウトのルート**。凍結された `takeokunn/ts-minecraft` の作業コピーを指す。本ドキュメント群では `<reference-impl>/packages/…` の形か、単に `packages/…`（同じくルート相対）で引用する。手元のどこに clone してあっても読み替えられるようにするためのプレースホルダである |
| `nerima-games/<repo>` | 同 org の兄弟リポジトリ。リンクは GitHub の URL で張る |

## 読む順番

| # | ドキュメント | 内容 | こんなときに読む |
| --- | --- | --- | --- |
| 1 | [`architecture.md`](./architecture.md) | 4 階層アーキテクチャ、16 リポジトリの依存グラフ（Mermaid）、このリポジトリの位置、名詞/動詞ルール、kit が devDependency 専用である理由、stage 順序表の所有者、依存ホワイトリスト CI | 最初に。全体像を掴む |
| 2 | [`responsibility.md`](./responsibility.md) | このリポジトリの責務、**明示的にスコープ外のもの**、親と子 | 「これはここに書くべきか」で迷ったとき |
| 3 | [`public-api.md`](./public-api.md) | 公開すべき API と、**参照実装の実コードによる検証**。実シグネチャの引用付き | 実装を書く前に |
| 4 | [`design-notes.md`](./design-notes.md) | 設計注意を証拠（file:line）付きで展開し、**名前付き回帰テスト**として書き下したもの | 実装中つねに。ソースのコメントからも参照している |
| 5 | [`porting.md`](./porting.md) | 移植元のパスと**実測 LOC**（`wc -l` で確認）、移植しないものとその理由、移植すべきテスト資産 | 参照実装のどこを見ればいいか探すとき |
| 6 | [`testing.md`](./testing.md) | 検証コマンド、テスト方針、カバレッジ閾値の扱い、**完成条件** | テストを書くとき／完成判定のとき |
| 7 | [`versioning.md`](./versioning.md) | 0.x → 1.0.0 の方針、公開手順、**何が破壊的変更か** | バージョンを上げるとき |

## 特に重要な項目への近道

- **なぜオクターブループが `let` + `for` なのか** → `design-notes.md` N-1
- **シードが引数ではなく factory 引数である理由** → `public-api.md` §1
- **何が破壊的変更か（seed→値 の凍結）** → `versioning.md` §5
- **既知のアーティファクト（半整数格子で 0 になる）** → `design-notes.md` N-8
- **portable DensityFunction と Minecraft 固有の地形式を分ける理由** → `responsibility.md` §3.1

## 関連資料

- `README.md` / `package.json` / `flake.nix` —— 実行可能なプロジェクト契約
- `nerima-games/mc-kernel` —— 共有語彙。全リポジトリの雛形
- `<reference-impl>` —— 参照実装（凍結。仕様書兼テストオラクル）

## 本ドキュメントの方針

- **日本語で書く。** ただし識別子・パス・フラグ・コマンドは英語のまま。
- **主張には証拠を付ける。** 参照実装の記述には file:line を、LOC には `wc -l` の実測値を。
- **裏が取れなかったものは、取れなかったと書く。** 推測を事実の顔で書かない。
