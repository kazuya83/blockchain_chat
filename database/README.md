# database

DB スキーマ管理兼、開発用 DB（Docker）。

## パッケージと database

`database/` は**パッケージごとのディレクトリ**に分かれる。backend の npm workspaces と対応し、
**1 パッケージ = 1 database**。

| パッケージ | 開発 Docker の database |
| --- | --- |
| `chat/` | `blockchain_chat_local` |

**database 名は環境ごとに違う。** 表の名前は**ローカルの開発 Docker だけ**のもので、
接続先はリポジトリではなく各環境の接続設定（backend の `DB_DATABASE`）が持つ。

各パッケージは自分の database 名を `<パッケージ>/database.conf` で宣言する。開発 Docker の初期化
（`build/docker-entrypoint-initdb.d/`）は**このファイルを置いたパッケージだけ**を対象にし、
database を作って `sql/tables` → `sql/master` → `sql/seed` の順に流す。

パッケージを増やしたときは `Dockerfile` の `COPY <パッケージ>/ <パッケージ>/` も足す。

## DB エンジン

**MySQL 8.0**（`Dockerfile` の `FROM mysql:8.0`）。CLI クライアントは `mysql`、環境変数は `MYSQL_*` 系。

## 起動

```sh
mise run database:setup   # イメージのビルド
mise run database:dev     # 起動（host port 33070）
```

**開発 Docker は毎回 `sql/tables` から作り直す。** スキーマを変えたらイメージをビルドし直す。

```sh
mysql -h 127.0.0.1 -P 33070 -u root blockchain_chat_local
```

## sql/ の中身

| ディレクトリ | 何を置くか |
| --- | --- |
| `sql/tables/` | テーブル定義。常に「あるべき最新形」を保つ |
| `sql/master/` | **全環境に適用される静的なデータ**。リポジトリが正を持つ語彙（モデルと課金レート） |
| `sql/seed/` | **ローカル開発の初期投入データ**。dev 専用でリモート環境へは流さない |
| `sql/migrations/` | 既存環境へ手で当てる SQL（下記の条件に当たる変更のみ） |

**master と seed はまったく別のもの。** master は流すたびに全環境へ同じ値を行き渡らせるので、
**画面から編集できるデータを master に置かない**（流すたびに現地の値を戻してしまう）。

## 手書き migration を書く状況

`sql/tables/*.sql` は常に最新形を保つ。ただし **開発 Docker は毎回作り直すため、既存環境に
変更が届いたかを dev では確認できない**。次のどれかに当たる変更は、`sql/tables` の更新に加えて
`sql/migrations/` に SQL を書く。

- **リネーム**（テーブル・列・インデックス・制約）: スキーマ差分ツールはリネームを検出できず
  DROP + ADD になるため、そのまま流すとデータが消える。
- **値の移行**: varchar に入っている enum 相当の値（`chat_messages.role` など）。
- **削除**（DROP TABLE / DROP COLUMN）: dev で 0 件でもリモートには実データがあり得るので、
  各環境で件数を確認してから書く。
- **既存データが新しい制約に違反しうる変更**: NOT NULL 化、UNIQUE / CHECK / FK の追加。
  ALTER が途中で止まる前提で、是正する UPDATE と、違反があれば DDL を 1 つも実行せずに止まる
  ガードを同じファイルに置く。
- **適用順に制約がある場合**: BE / FE のデプロイとの前後関係。手順をファイル先頭に書く。

migration ファイルは **ヘッダ → 1. 適用前バリデーション → 2. 適用 → 3. 適用後の確認** の順で書く。
**1 と 3 はコメントではなく実行される SQL にする**（コメントのチェックは読み飛ばされる）。

**その環境にまだ無いテーブルを前提にした migration を書かない。** 新規テーブルはリリース時に
最新形で作られるので、`sql/tables` を直すだけでよい。

純粋な追加（テーブル・列・インデックスの追加、コメントや型の緩和）で既存データが制約に
違反しないものは差分適用に任せてよい。

## この DB 固有の注意

- **`chat_messages` は追記のみ。** 更新・削除すると `sequence` に穴が空き、チェーン上の
  アンカーと突き合わなくなる。`ON DELETE CASCADE` でルームごと消すのは許す（証跡はチェーンに残る）。
- **`accounts.credit_balance` は `credit_ledger` の合計のキャッシュ**。両方を同じ処理で更新する。
  片方だけ書き換えない。
- **`credit_deposits` の `uk_credit_deposits_chain_contract_deposit` が二重付与の唯一の防壁**。
  この制約を外さない。
