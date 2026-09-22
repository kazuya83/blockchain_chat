# blockchain_chat AI 開発ガイド

このファイルはリポジトリ全体に適用する常設の案内である。詳細をここへ複製せず、対象ディレクトリの
規約と正本を参照する。`backend/` では、より具体的な `backend/AGENTS.md` も適用する。

## 作業原則

- 依頼範囲を越えて変更を広げず、既存の近い実装を確認して最小の変更を行う。
- 実装前に対象機能の frontend、backend、DB、contracts、現行ドキュメントへの影響を確認する。
- 現行システムではコードを最終的な正とする。仕様・権限・画面・ワークフローを変えた場合は、
  該当する `docs/current/` も同じ変更で更新する。
- 生成物を直接編集しない。生成元を変更して、必要な生成コマンドを実行する。
- `.env` や秘密鍵を読み取り、変更、表示、コミットしない。環境依存で検証できない場合は、
  推測で成功扱いにせず未検証項目と理由を報告する。
- Issue、PR、リリース、デプロイ、**チェーンへの TX 送信**など外部状態を変える操作は、
  ユーザーから依頼された範囲で行う。

## リポジトリの地図

| パス | 役割・参照先 |
| --- | --- |
| `contracts/` | Solidity + Hardhat 3。`ChatCredit` / `ChatLogAnchor`。規約は `contracts/README.md` |
| `backend/` | Hono + Prisma + Zod の API。npm workspaces で、現行実装は `backend/chat/`。設計・配置規約は `backend/AGENTS.md` |
| `frontend/` | React 19 + Vite + Tailwind CSS。npm workspaces で、現行実装は `frontend/chat/` |
| `database/` | MySQL 8.0 のテーブル定義、master、seed、開発用 Docker。パッケージごとに 1 database。変更手順は `database/README.md` |
| `docs/current/` | 現行実装の仕様。入口は `docs/current/README.md` |

## 用語（混同しやすい概念）

- **クレジット**: アプリ内の課金単位（整数）。**チェーン上のトークンではない**。入金 TX の
  wei をレート（`CHAIN_WEI_PER_CREDIT`）で割って付与し、消費は DB の中だけで完結する。
  1 メッセージごとに TX は出さない。
- **アンカー（anchor）**: ルームの会話ログの Merkle root を `ChatLogAnchor` へ記録すること。
  記録するのは root だけで、**本文はチェーンに載らない**。
- **葉（leaf）**: Merkle 木の末端。`domains/messages.ts` の `messageLeaf` が正本で、
  `roomId | sequence | role | contentHash | createdAt` から作る。**この式を変えると
  過去のアンカーが検証できなくなる**ので、変えるならバージョンを分ける。
- **`content_hash`** と **葉** は別物。`content_hash` は本文だけの keccak256 で、葉はそれに
  位置と時刻を足したもの。前者だけ一致しても「この順番でこの時刻に記録された」ことは言えない。
- **確定（confirmed）**: アンカーの TX が `CHAIN_CONFIRMATIONS` ぶん確定した状態。
  **pending の root で真正性を主張しない**（再編成で消えうる）。

## セットアップと実行

Node.js 24 と npm を使用し、ルートでは mise タスクを優先する。

```sh
mise run setup
mise run dev
```

個別起動:

```sh
mise run contracts:node
mise run backend:dev
mise run frontend:dev
mise run database:dev
```

- frontend: `http://localhost:3100`
- backend: `http://localhost:4100`、OpenAPI: `/openapi.json`、非 production の API UI: `/docs`
- MySQL 8.0: host port `33070`
- ローカル EVM ノード: `http://127.0.0.1:8545`（chainId 31337）

## 実装規約

### contracts

- Solidity は `^0.8.28`。アクセス制御は OpenZeppelin の `Ownable` を使う。
- **コントラクトを変えたら必ず `npm test` と `npm run abi:export` を両方やり直す。**
  ABI は backend の `src/integrations/chain/abi/` へ書き出す生成物で、手で編集しない。
- 既にデプロイ済みのコントラクトは書き換えられない。互換性のない変更は新しいアドレスへの
  デプロイになるので、**既存のアンカーが引き続き検証できるか**（旧コントラクトを読み続けるか）を
  決めてから進める。
- テストは `node:test` + `hardhat-viem`。revert は `viem.assertions.revertWithCustomError*` で
  カスタムエラー名まで確かめる。

### backend / API / DB

- backend のレイヤ、依存方向、Zod、ID、env の規約は `backend/AGENTS.md` に従う。
- API スキーマを変更した場合は backend を起動し、`cd frontend && npm run apigen` で
  `frontend/chat/src/types/gen/` を再生成する。
- DB 構造の変更では `database/chat/sql/tables/`、`backend/chat/prisma/schema.prisma`、
  影響する domain / repository / docs の整合を確認する。
- **`database/chat/sql/master/` と `sql/seed/` はまったく別のもの。** master は
  **全環境に適用される静的なデータ**（モデルと課金レートなど、リポジトリが正を持つ語彙）、
  seed は **ローカル開発の初期投入データ**。**画面から編集できるデータを master に置かない**。
  適用順は tables → master → seed。詳細は `database/README.md`。
- チェーン連携（`integrations/chain/`）は **アドレスと鍵が未設定でも起動できる**ようにする。
  未設定なら機能を無効にして 503 を返す。起動そのものを止めない。

### frontend

- TypeScript strict mode を維持する。`frontend/eslint.config.js` と `frontend/package.json` の
  Prettier 設定を正とする。
- `frontend/chat/src/` 内の import は `@/` alias を使う。
- **チェーンの状態を FE で判断しない。** 残高・アンカーの可否・検証結果はすべて BE が返す値を
  表示する（`canAnchor` など）。FE でルールを写経すると、条件を変えたときに片方だけ古くなる。
- 真正性確認の結果は **3 つのチェックを畳まずに並べて出す**。「検証できない」と
  「改ざんされている」はまったく違う状態で、畳むとユーザーが区別できない。

## 検証

変更範囲に応じて、まず対象を絞った確認を行い、完了前に該当パッケージの標準チェックを実行する。

```sh
cd contracts && npm test && npm run typecheck
cd backend  && npm test && npm run typecheck && npm run build
cd frontend && npm run check && npm run build
```

- 同じ内容を PR で `.github/workflows/ci.yml` が実行する。ローカルで通してから push する。
- `tsup` と `vite build` は型チェックをしないため、build だけでなく `typecheck` も実行する。
- UI 変更は可能なら実画面でも確認する。
- **チェーンを使う検証はローカルノード（chainId 31337）で行う。** テストネット・本番へ TX を
  出す必要がある場合は、実行前にユーザーへ確認する。TX は取り消せない。
- DB・チェーン・Claude API が必要な検証を省略した場合は、実行できなかった確認と理由を明記する。
- 完了時は、変更内容、実行した検証と結果、残る未検証事項を簡潔に報告する。

## AI ツールの探索対象

通常のコード探索・レビューでは、次の生成物や大容量ファイルを初期探索対象から除外する。

- 依存物・ビルド成果物: `node_modules/`、`*/dist/`、`contracts/artifacts/`、`contracts/cache/`、`coverage/`
- 生成物・ロックファイル: `backend/chat/src/generated/`、
  `backend/chat/src/integrations/chain/abi/`、`frontend/chat/src/types/gen/`、`package-lock.json`
- ログ・一時ファイル: `*.log`、`tmp/`

ただし、ユーザーが明示した場合、依存関係・生成結果・テスト失敗を調べる場合は除外しない。
このルールは初期探索を絞るものであり、ビルド・テスト・生成コマンドの実行を妨げない。

## GitHub 運用

- PR と Issue の関連付けには `Refs #NN` または本文中の `#NN` を使い、`Closes #NN` は使わない。
