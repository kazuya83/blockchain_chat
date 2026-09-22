# API

すべて `/api` 配下。正本は起動中の backend が返す `GET /openapi.json`（非 production では
`/docs` で閲覧できる）で、ここはその要約と、スキーマに書ききれない約束を残す場所。

レスポンスには常に `Cache-Control: no-store` を付ける（認証済みのレスポンスが CDN に
キャッシュされて他人へ返るのを防ぐ）。

## 認証と権限

- 認証は Cookie（`__SESSION`、HttpOnly）。Cookie を使えないクライアントは
  `Authorization: Bearer <token>` でもよい。
- 認証が要らないのは `/api/health-check`、`/api/chain`、`/api/auth/challenge`、
  `/api/auth/verify` の 4 つだけ。
- **ロールは無い。** 全員が同じ権限で、見えるのは自分のものだけ。絞り込みは repository が
  `account_id` で行う（route には書かない。書くと漏れる）。
- 他人のルームを指定した場合は 403 ではなく **404** を返す。存在の有無を漏らさないため。

## エンドポイント

### 公開

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/api/health-check` | `OK` を返すだけ |
| GET | `/api/chain` | このバックエンドが見ているチェーン・コントラクト・レート・機能の有効状態 |
| POST | `/api/auth/challenge` | 署名させる文面と nonce を発行する |
| POST | `/api/auth/verify` | 署名を検証してセッションを発行する。初回はアカウントも作る |

### アカウント

| メソッド | パス | 説明 |
| --- | --- | --- |
| POST | `/api/auth/sign-out` | セッションを失効させる |
| GET | `/api/me` | サインイン中のアカウント |
| PATCH | `/api/me` | 表示名の変更 |
| GET | `/api/me/credits` | 残高と入金の受け入れ条件（送金先アドレス・レート・確認ブロック数） |
| GET | `/api/me/credits/ledger` | クレジットの増減履歴（新しい順、100 件） |
| GET | `/api/me/credits/deposits` | 取り込み済みの入金（新しい順、100 件） |
| POST | `/api/me/credits/sync` | チェーンの入金イベントをいま取り込む |
| GET | `/api/models` | 選べるモデルと課金レート |

### チャット

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/api/rooms` | 自分のルーム一覧（更新の新しい順） |
| POST | `/api/rooms` | ルームを作る |
| GET | `/api/rooms/:roomId` | ルーム 1 件 |
| PATCH | `/api/rooms/:roomId` | タイトルの変更 |
| DELETE | `/api/rooms/:roomId` | ルームの削除（チェーン上のアンカーは消えない） |
| GET | `/api/rooms/:roomId/messages` | メッセージ一覧（古い順） |
| POST | `/api/rooms/:roomId/messages` | 発言して返答を得る |

### 真正性

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/api/rooms/:roomId/anchors` | アンカー履歴（新しい順） |
| POST | `/api/rooms/:roomId/anchors` | いまのログの root をチェーンへ記録する |
| GET | `/api/rooms/:roomId/messages/:messageId/verification` | メッセージ 1 件の真正性確認 |

## 約束ごと

### `POST /api/rooms/:roomId/messages`

`stream: true` を付けると SSE で返す。イベントは 4 種類。

| event | data |
| --- | --- |
| `thinking` | 思考の要約（プレーンテキストの差分） |
| `text` | 返答本文の差分 |
| `done` | `{ userMessage, assistantMessage, creditsCharged, balanceAfter }` の JSON |
| `error` | `{ message }` の JSON |

**SSE ではヘッダを送ったあとに失敗しうるので、エラーも HTTP ステータスではなく
`error` イベントで届く。** ステータスコードだけ見ていると失敗を取りこぼす。

`stream` を省略（または false）すると、完了後に `done` と同じ中身を 200 で返す。

### `POST .../anchors`

**確定を待ってから返すので時間がかかる**（`CHAIN_CONFIRMATIONS` ぶんのブロック生成時間）。
Polygon なら十数秒、ローカルなら即時。クライアントのタイムアウトに注意する。

確定待ちのアンカーがあるうちは 409 を返す。

### 実行可否のフラグ

ルームのレスポンスに `canAnchor` を載せている。**FE の動線を出し分けるためのもの**で、
BE 側のガード（403 / 409 / 503）は別に必ず残る。フラグは取得時点の値でしかない。

同じ判定は `domains/rooms.ts` の `canAnchorRoom` が持ち、**BE のガードとフラグの露出が
同じ関数を通る**。フラグだけ返してガードが別ロジックなら意味がない。

### `GET .../verification`

3 つのチェック（`contentHashMatches` / `proofMatches` / `anchoredOnChain`）を畳まずに返す。
まだアンカーされていないメッセージは 3 つとも false になり、`reason` に理由が入る
（改ざんの疑いではない）。

`leaf` と `proof` も返す。**ユーザーが自分でコントラクトを読んで検証し直せる**ようにするため。

## エラー

| ステータス | いつ |
| --- | --- |
| 402 | クレジット不足（`InsufficientCreditsError`） |
| 403 | 未認証、署名の検証失敗、nonce が使えない |
| 404 | 対象が無い、または自分のものではない。指定したモデルが無い |
| 409 | アンカーするものが無い、確定待ちのアンカーがある |
| 422 | モデルが応答を拒否した（`stop_reason: refusal`） |
| 503 | アンカーが無効（コントラクトのアドレスか署名鍵が未設定） |

対応付けは `routes/utils.ts` の `toHttpError` が唯一の場所。usecase は HTTP を知らない。
未知のエラーはここで握りつぶさず、500 として上へ投げる。
