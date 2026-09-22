# 全体構成

## 1. 何をするアプリか

ウォレットでサインインし、前払いしたクレジットを消費して Claude と会話する。会話ログは
Merkle root をチェーンへ記録するので、あとから本文を書き換えてもその事実を検出できる。

ブロックチェーンは 2 か所で使う。役割はまったく別なので、混ぜて考えない。

| 用途 | コントラクト | チェーンに載るもの |
| --- | --- | --- |
| 支払い | `ChatCredit` | 誰がいくら入金したか |
| 会話ログの真正性 | `ChatLogAnchor` | ルームごとの Merkle root |

## 2. 構成要素

```
                 ┌──────────────┐
  ウォレット ────→│ frontend/chat│  React 19 + Vite + Tailwind
   (EIP-1193)    └──────┬───────┘
        │               │ /api（開発中は vite の proxy）
        │               ↓
        │        ┌──────────────┐        ┌──────────────┐
        │        │ backend/chat │───────→│  Claude API  │
        │        │  Hono/Prisma │        └──────────────┘
        │        └──┬────────┬──┘
        │           │        │
        │           ↓        ↓
        │     ┌─────────┐  ┌──────────────────────────┐
        └────→│  EVM    │  │ MySQL 8.0                │
     入金 TX  │ ChatCredit│ │ accounts / chat_rooms /  │
              │ ChatLogAnchor│ chat_messages / ...     │
              └─────────┘  └──────────────────────────┘
```

| パッケージ | 責務 | 持たない責務 |
| --- | --- | --- |
| `contracts/` | 入金の受け口、root の台帳、アクセス制御 | 会話の中身、クレジットの計算 |
| `backend/chat/` | 認証、会話、課金、Claude 連携、チェーン連携、検証 | 画面の都合 |
| `frontend/chat/` | 画面、ウォレット操作（署名・送金）、BE の返す値の表示 | 課金・検証のルール判断 |
| `database/chat/` | スキーマの正、master、ローカル seed | |

**FE はチェーンの状態を自分で判断しない。** 残高もアンカーの可否も検証結果も BE が返す値を
表示するだけ。FE でルールを写経すると、条件を変えたときに片方だけ古くなる。
FE がチェーンに直接触るのは**ウォレットの署名と送金**だけで、これは鍵がブラウザ側にしか
無いため避けられない。

## 3. 認証

EIP-4361（Sign-In with Ethereum）に倣った署名ベース。パスワードもメールも持たない。

```
FE                          BE                         DB
│ POST /api/auth/challenge  │                          │
│─────────────────────────→ │ nonce を発行             │→ auth_nonces
│ ←──── message + nonce ─── │                          │
│ ウォレットに署名させる      │                          │
│ POST /api/auth/verify     │                          │
│─────────────────────────→ │ 1. 署名を検証            │
│                           │ 2. nonce を使用済みに     │→ auth_nonces (条件付き UPDATE)
│                           │ 3. アカウントを取得/作成  │→ accounts
│                           │ 4. セッションを発行       │→ sessions
│ ←──── Set-Cookie ──────── │                          │
```

順序が要点で、**署名を確かめてから nonce を使用済みにする**。逆にすると、署名が間違っている
だけで nonce を使い切ってしまう。使用済みにするのは条件付き UPDATE なので、同じ署名が同時に
2 回届いてもセッションは 1 つしかできない。

セッショントークンは平文で保存せず、SHA-256 のハッシュだけを `sessions.token_hash` に持つ。
Cookie（HttpOnly）で渡すが、Cookie を使えないクライアント向けに `Authorization: Bearer` も受ける。

## 4. 会話の流れ

`POST /api/rooms/:roomId/messages`。`stream: true` なら SSE。

```
発言
 → 入力トークンを数える（countTokens）
 → 残高から出力トークンの上限を決める
 → ユーザー発言を chat_messages へ追記（content_hash 付き）
 → 上限ぶんのクレジットを引き当てる（条件付き UPDATE）
 → Claude API へストリーミング（thinking / text を SSE で中継）
 → 返答を chat_messages へ追記（実績トークン数と請求クレジット）
 → 引き当てと実績の差額を戻す
```

課金の詳細は [03-credits.md](03-credits.md)、ログの真正性は [02-anchoring.md](02-anchoring.md)。

### thinking の扱い

Claude の adaptive thinking を有効にし、`display: "summarized"` で要約を受け取って SSE の
`thinking` イベントとして流す。既定（`omitted`）だと考えている間テキストが何も来ないので、
画面が長く止まって見える。

Haiku 系は adaptive thinking を受け付けない（旧来の `budget_tokens` 方式）ので、
そのモデルでは `thinking` を送らない。分岐は `integrations/claude/config.ts` の
`supportsAdaptiveThinking`。

## 5. チェーンの選択と切り替え

`CHAIN_ID` と `CHAIN_RPC_URL` で決まる。`integrations/chain/config.ts` が
viem の chain 定義に解決する。

| 環境 | `CHAIN_ID` | 用途 |
| --- | --- | --- |
| ローカル | 31337 | Hardhat のローカルノード。TX が即確定する |
| テスト | 80002 | Polygon Amoy |
| 本番 | 137 | Polygon |

既知でないチェーン ID でも、RPC さえあれば動くようにしてある。

**チェーンやコントラクトを切り替えたら、入金の取り込み位置もリセットされる。**
`chain_sync_states` は `chain_id` / `contract_address` が変わったら作り直す
（別のチェーンの取り込み位置を引き継ぐと、入金を取りこぼすか二重に見に行く）。
切り替え後は `CHAIN_DEPOSIT_FROM_BLOCK` にデプロイブロックを入れる。

**既にアンカーしたルームがある状態でコントラクトを差し替えると、過去の root は新しい
コントラクトには無い。** 検証はいま設定されているアドレスに対して行われるので、
`anchoredOnChain` が false になる。差し替えるなら、旧コントラクトを読み続ける仕組みが要る
（いまは持っていない）。

## 6. チェーンが無くても動く範囲

チェーンのアドレスと鍵は必須にしていない。

| 設定 | 無い場合の挙動 |
| --- | --- |
| `CHAIN_CHAT_CREDIT_ADDRESS` | 入金の取り込みが無効。`/api/me/credits/sync` は `enabled: false` を返す |
| `CHAIN_CHAT_LOG_ANCHOR_ADDRESS` または `CHAIN_ANCHORER_PRIVATE_KEY` | アンカーが無効。`POST .../anchors` は 503、`canAnchor` は false |
| `CHAIN_RPC_URL` | **起動しない**（必須） |

開発初期やチャットだけ試したい環境があるので、**アドレスや鍵が無いことを理由に起動を止めない**。
