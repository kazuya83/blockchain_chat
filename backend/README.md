# backend

Hono + Prisma + Zod の API。npm workspaces のルートで、現行実装は `chat/`。
レイヤ構成と設計規約は [AGENTS.md](AGENTS.md) を参照する。

## 起動

```sh
npm ci
npm run db:generate   # Prisma Client の生成（リポジトリに含めていない）
npm run dev           # http://localhost:4100
```

`chat/.env.example` を `chat/.env` へ写してから起動する。

## 必要な環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `PORT` | | 待ち受けポート（既定 4100） |
| `CORS_ORIGINS` | | カンマ区切り。既定 `http://localhost:3100` |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_DATABASE` | ✓ | MySQL の接続先。無いと起動時に落ちる |
| `DB_PASSWORD` / `DB_SSL` | | |
| `ANTHROPIC_API_KEY` | | 未設定でも `ant auth login` のプロファイルがあれば SDK が拾う。どちらも無いと最初のチャットで失敗する |
| `CHAT_DEFAULT_MODEL_ID` | | 既定 `claude-opus-5` |
| `CHAT_MAX_OUTPUT_TOKENS` | | 1 往復の出力上限（既定 64000）。残高がこれより少なければ残高側が優先される |
| `CHAIN_RPC_URL` | ✓ | 無いと起動時に落ちる |
| `CHAIN_ID` | | 既定 31337（ローカル）。80002 = Polygon Amoy、137 = Polygon |
| `CHAIN_CHAT_CREDIT_ADDRESS` | | 未設定なら入金の取り込みが無効になる（起動はする） |
| `CHAIN_CHAT_LOG_ANCHOR_ADDRESS` / `CHAIN_ANCHORER_PRIVATE_KEY` | | 両方そろって初めてアンカーが有効になる。片方でも欠ければ `POST /api/rooms/:id/anchors` は 503 |
| `CHAIN_WEI_PER_CREDIT` | | 入金 1 クレジットあたりの wei（既定 1e14） |
| `CHAIN_CONFIRMATIONS` | | 入金・アンカーを確定とみなす確認ブロック数（既定 5） |
| `CHAIN_DEPOSIT_FROM_BLOCK` | | 取り込みを開始するブロック。コントラクトのデプロイブロックを入れる |
| `SESSION_TTL_HOURS` | | セッションの有効期間（既定 720 = 30 日） |
| `SIGN_IN_DOMAIN` | | 署名文面に出すドメイン名 |

チェーン関連が未設定でも API は起動する。**アドレスや鍵が無いことを理由に起動を止めない**のは、
チャットだけ動かしたい環境があるため。

## コマンド

```sh
npm test         # node:test（libs のユニットテスト）
npm run typecheck
npm run build    # tsup。型チェックはしないので typecheck と併用する
npm start        # dist/router.js
npm run db:pull  # DB から prisma/schema.prisma を作り直す
```
