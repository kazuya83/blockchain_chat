# 環境構築手順

何も入っていない状態から `http://localhost:3100` でチャットが動くまでの手順。
仕様ではなく**手順**の正本なので、コマンドやポートを変えたらこのファイルも直す。

- 各パッケージの規約は [../AGENTS.md](../AGENTS.md)、仕様は [current/README.md](current/README.md)
- DB の中身とスキーマ運用は [../database/README.md](../database/README.md)

## 0. 必要なもの

| ツール | バージョン | 確認 | 備考 |
| --- | --- | --- | --- |
| Node.js | 24（`.node-version` / `mise.toml` が指定） | `node -v` | npm も同梱 |
| Docker | Desktop / Engine | `docker version` | MySQL 8.0 の開発 DB に必要 |
| Git | 任意 | `git --version` | |
| mise | 任意 | `mise --version` | **必須ではない**。下記を参照 |
| MetaMask | ブラウザ拡張 | 拡張機能一覧で確認 | **必須。** サインイン・入金は EIP-1193 プロバイダ（`window.ethereum`）
  前提で、フロントエンドはこれ以外のウォレット接続手段を持たない |

### mise は必須ではない

ルートの `mise.toml` はタスクランナーとして便利だが、要求するツールは `node = "24"` だけである。
**Node 24 が入っていれば mise なしで同じことができる。** `mise: 用語 'mise' は ... 認識されません`
（`CommandNotFoundException`）はツールの不在であって環境の不備ではない。

さらに **Windows では `mise run dev` は動かない。** このタスクは `&` / `trap` / `wait` という
POSIX シェルの記法で書かれており、mise は Windows で `cmd` を使うため解釈できない。
Windows ではプロセスを 1 つずつ別ターミナルで起動する（[6](#6-サーバーを起動する) を参照）。

以降の手順は **npm / docker を直接叩く形**で書く。mise を使う場合の対応は
[コマンド対応表](#コマンド対応表) にある。

## 1. リポジトリを取得する

```powershell
git clone <このリポジトリの URL> D:\git\blockchain_chat
cd D:\git\blockchain_chat
```

## 2. 依存をインストールする

パッケージごとに独立した npm プロジェクトなので、**4 か所すべてで実行する**。
`backend` は Prisma Client の生成まで必要（生成物が無いと起動時に import が解決しない）。

```powershell
cd D:\git\blockchain_chat\contracts; npm ci
cd D:\git\blockchain_chat\frontend; npm ci
cd D:\git\blockchain_chat\backend;  npm ci; npm run db:generate
```

- `backend` / `frontend` は npm workspaces で、実装はそれぞれ `backend/chat/` `frontend/chat/` にある。
  ルートの `npm ci` が workspace ぶんまで入れるので、`chat/` で個別に `npm ci` はしない。
- `npm run db:generate` は `backend/chat/src/generated/prisma` を作る。**生成物なので手で編集しない。**

## 3. 開発 DB を用意する

Docker Desktop を起動してから実行する。エンジンが止まっていると
`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified` で失敗する。

```powershell
cd D:\git\blockchain_chat\database
docker build --no-cache -t blockchain-chat/db .
```

ビルドできたら起動する。**この `docker run` は前景で動き続けてターミナルを占有する**ので、
以降のコマンドは別のターミナルで打つ。

```powershell
docker run --rm --name blockchain-chat-db -p 33070:3306 blockchain-chat/db
```

> **複数行をまとめて貼り付けない。** `docker run ... blockchain-chat/db` の次の行が連結されると、
> イメージ名が `blockchain-chat/dbmysql` のようになり
> `pull access denied for blockchain-chat/dbmysql` で失敗する。1 行ずつ実行する。

- **ビルドは `database/` で実行する**（`database/chat/` ではない）。`Dockerfile` は `database/` にあり、
  `build/` と `chat/` を `COPY` するので、コンテキストが `database/` でないと読めない。
- **host port は 33070**（コンテナ内は 3306）。
- database 名は `blockchain_chat_local`（`database/chat/database.conf` が宣言）。
- 起動時に `sql/tables` → `sql/master` → `sql/seed` の順で流れる。
  **`--rm` なので停止すると中身は消え、起動ごとに作り直される。**
  スキーマを変えたら `docker build` からやり直す。
- 既に同名のコンテナが動いているなら**起動し直す必要はない**。`docker ps` で確認する。
  作り直したいときは `docker stop blockchain-chat-db` してから `docker run`。

接続確認（**別のターミナルで**）。コンテナの中の `mysql` を使うので、ホストへのインストールは要らない。

```powershell
docker exec blockchain-chat-db mysql -u root blockchain_chat_local -e "SHOW TABLES;"
```

10 テーブル（`accounts` 〜 `sessions`）が並べば初期化できている。
ホスト側のポート経由で確かめたいときは `Test-NetConnection -ComputerName 127.0.0.1 -Port 33070`。
ホストに `mysql` クライアントを入れてある場合のみ、
`mysql -h 127.0.0.1 -P 33070 -u root blockchain_chat_local -e "SHOW TABLES;"` でも同じことができる。

## 4. 環境変数を用意する

`.env.example` を写して `.env` を作る。**`.env` はコミットしない。**

```powershell
Copy-Item D:\git\blockchain_chat\backend\chat\.env.example D:\git\blockchain_chat\backend\chat\.env
```

- 既に `.env` がある場合は**上書きしない**。足りないキーだけ `.env.example` から補う。
- `contracts` の `.env` は**ローカル開発には要らない**。中身（`DEPLOYER_PRIVATE_KEY` や
  各 RPC URL）は `amoy` / `polygon` へデプロイするときだけ使う。
- `frontend/chat` に `.env` は要らない。Vite が `/api` を `http://localhost:4100` へ
  プロキシする（変えるなら `VITE_API_PROXY_TARGET`）。
- DB の既定値（`DB_PORT=33070` / `DB_DATABASE=blockchain_chat_local`）は [3](#3-開発-db-を用意する) と
  合っているのでそのままでよい。
- `ANTHROPIC_API_KEY` を設定する。`ant auth login` 済みなら未設定でも SDK が拾う。
- チェーン系（`CHAIN_*`）のアドレスと鍵は次の手順で埋める。**空でも backend は起動する**
  （チェーン機能が無効になり、該当 API が 503 を返す）。

## 5. ローカルチェーンへデプロイする

### 5-1. ローカルノードを起動する（このターミナルは開いたまま）

```powershell
cd D:\git\blockchain_chat\contracts
npm run node
```

`http://127.0.0.1:8545`、chainId 31337 で立ち上がり、**テスト用アカウントの秘密鍵が一覧表示される**。

> これは Hardhat が誰にでも同じ値を配る公開済みのテスト鍵である。ローカル専用に使い、
> **実資産のあるアドレスの鍵をここに入れない。**

### 5-2. デプロイする（別ターミナル）

```powershell
cd D:\git\blockchain_chat\contracts
npm run deploy:local
```

`ChatCredit` と `ChatLogAnchor` のアドレス、そして `deployer:` にデプロイ元アドレスが出力される。

- **`DEPLOYER_PRIVATE_KEY` は要らない。** `localhost` ネットワークには `accounts` の指定がなく
  （`hardhat.config.ts`）、ノードが公開するアカウントがそのまま使われる。先頭の **Account #0** が
  deployer になる。この変数は `amoy` / `polygon` 用。
- 出力された `deployer:` のアドレスが、5-1 のログの Account #0 と一致することを確かめる。

### 5-3. 出力を backend の `.env` へ写す

`backend/chat/.env` の 3 つを埋める。

| キー | 値 |
| --- | --- |
| `CHAIN_CHAT_CREDIT_ADDRESS` | デプロイ出力の `ChatCredit` |
| `CHAIN_CHAT_LOG_ANCHOR_ADDRESS` | デプロイ出力の `ChatLogAnchor` |
| `CHAIN_ANCHORER_PRIVATE_KEY` | **デプロイに使われたアカウント（Account #0）の秘密鍵** |

`CHAIN_ANCHORER_PRIVATE_KEY` は任意の鍵ではいけない。`ChatLogAnchor` のコンストラクタが
`isAnchorer[initialOwner] = true` を立て、`initialOwner` は deployer なので、**別のアカウントで
anchor TX を出すと `NotAnchorer` で revert する**。別の鍵を使いたいときは owner から
`setAnchorer(address, true)` を呼ぶ。

`CHAIN_ID=31337` / `CHAIN_RPC_URL=http://127.0.0.1:8545` は既定でローカル向き。

> **入金がすぐ反映されないとき**: 入金の取り込みは再編成を避けるため
> `最新ブロック - CHAIN_CONFIRMATIONS` までしか読まない（`usecases/syncDeposits.ts`）。
> ローカルノードは TX ごとに 1 ブロックしか進まないので、既定の `5` だと入金 TX の後に
> 追加のブロックが要る。ローカルで試すだけなら `CHAIN_CONFIRMATIONS=1` に下げてよい。
> **テストネット・本番で下げない。**

## 5-4. MetaMask を用意する

サインイン画面のボタンは `window.ethereum`（MetaMask などの EIP-1193 プロバイダ）を直接呼ぶだけで、
入っていないときのエラー表示は無い（押しても無反応に見える。既知の UI 上の問題、
[docs/setup.md](#よくある詰まり) の該当行を参照）。**拡張機能をインストールしていない場合は
先に入れる**：<https://metamask.io/download/>

### ローカルノードをネットワークとして追加する

MetaMask → ネットワーク選択 →「ネットワークを追加」→「ネットワークを手動で追加」。

| 項目 | 値 |
| --- | --- |
| ネットワーク名 | 任意（例: Hardhat Local） |
| RPC URL | `http://127.0.0.1:8545` |
| チェーン ID | `31337` |
| 通貨記号 | 任意（例: ETH） |

### Account #0 をインポートする

[seed](../database/chat/sql/seed/010-base.sql) は Account #0 に 100 万クレジットを最初から
割り当てている。これでサインインすると入金操作なしにすぐ試せる。

MetaMask → アカウントメニュー →「アカウントをインポート」→ 5-1 のログにある
**Account #0 の Private Key** を貼り付ける。

## 6. サーバーを起動する

ターミナルを分けて、それぞれ起動したままにする。

| # | ターミナル | コマンド | 用途 |
| --- | --- | --- | --- |
| 1 | `database` | `docker run --rm --name blockchain-chat-db -p 33070:3306 blockchain-chat/db` | MySQL（33070） |
| 2 | `contracts` | `npm run node` | ローカル EVM ノード（8545） |
| 3 | `backend` | `npm run dev` | API（<http://localhost:4100>） |
| 4 | `frontend` | `npm run dev` | 画面（<http://localhost:3100>） |

## 7. 動くことを確認する

- <http://localhost:3100> を開き、ウォレットでサインインする
- API: <http://localhost:4100/openapi.json>、非 production の API UI: <http://localhost:4100/docs>
- クレジット入金 → 発言 → アンカー → 真正性確認まで通せば一周である

パッケージごとの標準チェック（変更を入れたら完了前に実行する）:

```powershell
cd D:\git\blockchain_chat\contracts; npm test; npm run typecheck
cd D:\git\blockchain_chat\backend;   npm test; npm run typecheck; npm run build
cd D:\git\blockchain_chat\frontend;  npm run check; npm run build
```

`tsup` と `vite build` は型検査をしないので、`build` だけでなく `typecheck` も回す。

## コマンド対応表

| mise タスク | 直接実行 |
| --- | --- |
| `mise run setup` | [2](#2-依存をインストールする) + [3](#3-開発-db-を用意する) の `docker build` |
| `mise run dev` | [6](#6-サーバーを起動する) を別ターミナルで並行起動（**Windows では mise 版は動かない**） |
| `mise run database:setup` | `cd database; docker build --no-cache -t blockchain-chat/db .` |
| `mise run database:dev` | `docker run --rm --name blockchain-chat-db -p 33070:3306 blockchain-chat/db` |
| `mise run backend:dev` | `cd backend; npm run dev` |
| `mise run frontend:dev` | `cd frontend; npm run dev` |
| `mise run contracts:node` | `cd contracts; npm run node` |
| `mise run contracts:test` | `cd contracts; npm test` |

## よくある詰まり

| 症状 | 原因と対処 |
| --- | --- |
| `mise : 用語 'mise' は ... 認識されません` | mise が未インストール。Node 24 があれば不要なので、直接実行へ切り替える。使いたい場合は `winget install jdx.mise` |
| `mise run dev` が Windows で失敗する | タスクが POSIX シェル記法。[6](#6-サーバーを起動する) のように 1 つずつ起動する |
| `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified` | Docker Desktop が起動していない |
| `failed to read dockerfile` | `database/chat/` でビルドしている。`Dockerfile` は `database/` にある |
| `pull access denied for blockchain-chat/dbmysql` | `docker run` の行に次の行が連結されてイメージ名になっている。1 行ずつ実行する |
| `mysql` が認識されない | ホストに MySQL クライアントが無い。`docker exec blockchain-chat-db mysql ...` を使う |
| `Conflict. The container name "/blockchain-chat-db" is already in use` | 同名のコンテナが残っている。`docker ps -a --filter name=blockchain-chat-db` で確認し、動いているならそのまま使う（起動は不要）。作り直すなら `docker stop blockchain-chat-db`（停止していたら `docker rm`）してから `docker run` |
| DB は起動するが `Unknown database 'blockchain_chat_local'` | 初期化スクリプトが source されず実行されている。`Dockerfile` の `COPY --chmod=644` が消えていないか確認する（Windows は実行ビットを持たず 0755 を送るため、明示しないと 001 が無言で何もしない） |
| backend 起動時に Prisma Client が見つからない | `cd backend; npm run db:generate` を忘れている |
| backend が DB につながらない | DB コンテナが起動しているか、`.env` の `DB_PORT=33070` / `DB_DATABASE` が `database/chat/database.conf` と一致しているか |
| チェーン系 API が 503 を返す | `CHAIN_CHAT_*_ADDRESS` / `CHAIN_ANCHORER_PRIVATE_KEY` が未設定。**この状態でも起動は止まらない**仕様 |
| 入金してもクレジットが増えない | 確定ブロック待ち。[5-3](#5-3-出力を-backend-の-env-へ写す) の注記を参照 |
| アンカーが `NotAnchorer` で revert する | `CHAIN_ANCHORER_PRIVATE_KEY` が deployer（Account #0）以外。[5-3](#5-3-出力を-backend-の-env-へ写す) を参照 |
| サインインボタンを押しても無反応 | MetaMask 等の拡張が入っていない。`window.ethereum` が無いとエラーが画面に出ずに無言で終わる（フロントエンドの既知の UI 上の問題）。[5-4](#5-4-metamask-を用意する) を参照 |
| ポートが埋まっている | 3100 / 4100 / 33070 / 8545 を使う。`docker ps` と `netstat -ano \| findstr :4100` で確認 |
| DB を作り直したい | コンテナを停止して `docker run` し直す（`--rm` なので毎回初期化される） |

## テストネット・本番へ向ける場合

`CHAIN_ID` / `CHAIN_RPC_URL` を切り替え、`npm run deploy:amoy`（80002）または
`npm run deploy:polygon`（137）を使う。

- **TX は取り消せない。** テストネット・本番へ TX を出す前にユーザーへ確認する。
- `CHAIN_DEPOSIT_FROM_BLOCK` にデプロイ時のブロック番号を入れる（0 のままだと全履歴を走査する）。
- **デプロイ済みのコントラクトは書き換えられない。** 互換性のない変更は新アドレスへのデプロイに
  なるので、既存のアンカーを引き続き検証できるかを決めてから進める。
- チェーンの選択と切り替えの詳細は [current/01-architecture.md](current/01-architecture.md)。
