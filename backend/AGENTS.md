# backend 開発ガイド

## パッケージ構成

`backend/` は npm workspaces のルートで、`package-lock.json` と `node_modules` はここに集約される。

| パッケージ | 内容 |
| --- | --- |
| `chat/` | 現行の API 実装。ルートの script（`dev` / `build` / `typecheck` / `test` / `db:*`）はここへ委譲する |

実行時依存（`dependencies`）は**各パッケージの package.json に書く**。**tsup は cwd の
package.json の `dependencies` を external にする**ため、ルートへ集約すると依存がすべてバンドルへ
取り込まれ、CJS のパッケージ（dotenv など）が実行時に `Dynamic require of "fs" is not supported` で
落ちる。ツールチェーン（tsup / tsx / typescript / prisma CLI）はルートに置く。

`.env` はパッケージごとに持つ（`backend/chat/.env`）。script の `--env-file` と
`prisma.config.ts` は自分のパッケージの `.env` を読む（npm workspaces の script は
パッケージディレクトリが cwd になる）。

## レイヤと依存方向

```
routes → usecases → (integrations | repositories) → domains ← generated(Prisma)
libs / middlewares は全層を横断
```

| ディレクトリ | 役割 |
| --- | --- |
| `domains/` | **業務オブジェクトのモデル層**。型（`Ulid` 等のブランド型）+ `toX(prismaRow): X` 変換 + enum + その**単体**のルール。複数ドメインをまたぐロジックは置かない |
| `repositories/` | **永続化層**。Prisma で DB を触り、`toX` で domain 型に変換して返す。DB アクセスはここに閉じる。**所有者の絞り込みもここ**（route に書くと漏れる） |
| `integrations/` | **外部連携クライアント**。連携先ごとにサブフォルダ（`integrations/claude/`、`integrations/chain/`）。このアプリのドメイン知識を持たない薄いトランスポート |
| `routes/` | **HTTP 層**（Hono）。`describeRoute`(OpenAPI) + 入力検証（zod）→ usecase / repository を呼ぶ → `c.json`。**HTTP 関心事に専念**（入力形式検証・ステータスコード・レスポンス整形・ドメインエラー→HTTP マッピング） |
| `usecases/` | **業務フロー層**。複数 repository / integration をまたぐ手続き＋補償（ロールバック）。HTTP を知らず、区別可能なドメインエラー（`usecases/errors.ts`）を throw する |
| `middlewares/` | Hono ミドルウェア（セッション検証・コンテキスト注入） |
| `libs/` | FW 非依存の純粋ユーティリティ（`merkle.ts`、`hash.ts` など） |
| `generated/` | Prisma 生成物。**触らない** |
| `integrations/chain/abi/` | contracts からの生成物。**触らない**（`cd contracts && npm run abi:export` で作り直す） |

## 設計判断の軸

- **domain（名詞: モデル・型・ルール）** か **それ以外（手続き・I/O）** か、で置き場所を決める。
- **単体オブジェクトの振る舞い → domain**。**複数オブジェクトの協調 → usecase**。
- **外部 API・チェーン → integrations**、**DB → repositories**。どちらも「外部 I/O のアダプタ」。
- `service` という語は多義的なので層名に使わない。
- **エラーの分担**: usecase はドメインエラーを throw（HTTP を知らない）。route の `toHttpError` が
  HTTP ステータスへマッピングする。未知のエラーは握りつぶさず 500 へ落とす。

## お金とチェーンの扱い（この API 固有の要点）

- **残高を減らすのは条件付き UPDATE だけ。** `consumeCredits` は
  `WHERE credit_balance >= ?` で更新し、更新できた場合にのみ台帳を書く。
  「読んでから書く」にすると同時実行で二重に使える。
- **出力の上限を先にクレジットで縛る。** `affordableOutputTokens` が残高から `max_tokens` を
  決めるので、実績が引き当てを超えない（＝残高がマイナスにならない）。
  実績が出たら差額を戻す。
- **チェーンのイベント取り込みは冪等に。** `credit_deposits` の
  `(chain_id, contract_address, deposit_id)` の unique 制約が唯一の判定で、
  同じ範囲を二度流しても残高は二重に増えない。
- **確認ブロックぶん手前までしか取り込まない。** 再編成で消えうるブロックの入金を先に付与すると
  取り消せない。
- **会話ログは追記のみ。** `chat_messages` を更新・削除すると `sequence` に穴が空き、
  アンカーと突き合わなくなる。送信に失敗してもユーザー発言の行は残す。

## Zod / スキーマ

- **命名**: `Z` prefix は**他ファイルから import されうる** Zod スキーマ変数に付ける
  （例 `ZWalletAddress`、`ZUlid`）。route ファイル内の Request/Response スキーマは
  そのファイルに閉じる前提なので prefix 不要（例 `createRoomSchema`）。
  `z.infer` で導出する型は素の名前にする。
- **enum**: `z.enum` で定義し、型は `z.infer` で導出。DB カラムは `varchar` のままにする
  （MySQL の ENUM 型にはしない）。**enum 値は DB 値と完全一致**させ、境界（DB 行 → domain）で
  `parse` して不正値を検出する。

## env

- **必須 env は module トップレベルで `validate()`** する（`libs/validate.ts`）。
  import された時点で検証され、欠落していれば throw する。
- **チェーンのアドレスと鍵は必須にしない。** 未設定でも起動でき、その機能だけ無効になる
  （`isDepositSyncEnabled` / `isAnchoringEnabled`）。開発初期やアンカーを使わない環境がある。

## ID

- 主キーは **ULID（`Char(26)`）**。チェーンへ渡すときは `keccak256` で `bytes32` に畳む
  （`roomIdToBytes32`）。

## コードスタイル

- **変数・定数はできるだけ初回利用箇所の直上に定義する**。ファイル先頭への一括宣言は避ける。
