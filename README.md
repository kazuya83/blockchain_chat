# blockchain_chat

ウォレットでサインインし、前払いしたクレジットを消費して Claude と会話するチャットボット。
会話ログは Merkle root を Polygon 上のコントラクトへ記録するので、**あとから本文を書き換えても
その事実を検出できる**。

```
ユーザー ──署名──→ サインイン
        ──入金 TX─→ ChatCredit ──Deposited─→ backend がクレジットを付与
        ──発言────→ backend ──→ Claude API（ストリーミング）
                         └─→ 会話ログを DB へ追記（本文ハッシュ付き）
        ──記録────→ backend ──anchor TX──→ ChatLogAnchor（Merkle root のみ）
        ──確認────→ backend ──→ 本文ハッシュ / Merkle proof / チェーン上の root を突き合わせ
```

チェーンに載るのは **root だけ**で、会話の本文はチェーンへ送らない。

## リポジトリの構成

| パス | 役割 |
| --- | --- |
| `contracts/` | Solidity + Hardhat。`ChatCredit`（前払い）と `ChatLogAnchor`（ログのアンカー） |
| `backend/chat/` | Hono + Prisma + Zod の API。Claude API 連携とチェーン連携 |
| `frontend/chat/` | React 19 + Vite + Tailwind CSS のチャット画面 |
| `database/chat/` | MySQL 8.0 のテーブル定義・master・seed と開発用 Docker |
| `docs/current/` | 仕様の正本。入口は [docs/current/README.md](docs/current/README.md) |

開発の進め方と規約は [AGENTS.md](AGENTS.md) を参照する。

## セットアップ

Node.js 24 と Docker が要る。ルートでは mise タスクを使う。

```sh
mise run setup   # 依存のインストール + DB イメージのビルド
mise run dev     # DB + backend + frontend をまとめて起動
```

個別に起動する場合:

```sh
mise run database:dev    # MySQL 8.0（host port 33070）
mise run backend:dev     # http://localhost:4100
mise run frontend:dev    # http://localhost:3100
mise run contracts:node  # ローカル EVM ノード（http://127.0.0.1:8545）
```

- OpenAPI: `http://localhost:4100/openapi.json`、非 production の API UI: `http://localhost:4100/docs`
- 環境変数は各パッケージの `.env.example` を写して `.env` を作る
- mise は必須ではない。Node 24 があれば `npm` / `docker` を直接叩いてもよい
  （**Windows では `mise run dev` は動かない**）。対応表は [docs/setup.md](docs/setup.md)

## 最初に動かすまで

何も入っていない状態からの手順は [docs/setup.md](docs/setup.md) にまとめてある。
本番チェーン（Polygon）への切り替えは
[docs/current/01-architecture.md](docs/current/01-architecture.md) を参照する。
