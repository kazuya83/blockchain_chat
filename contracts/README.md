# contracts

Solidity + Hardhat 3。チェーンに載せるのは次の 2 つだけで、**会話の本文は載せない**。

| コントラクト | 役割 |
| --- | --- |
| `ChatCredit` | 利用料の前払い窓口。`deposit()` / `depositFor(address)` / 素の送金を受け、`Deposited(depositId, user, amount, payer)` を出す。残高の消費はオフチェーン |
| `ChatLogAnchor` | ルームごとの会話ログの Merkle root を記録する。`anchor(roomId, merkleRoot, messageCount)`。過去の root も `isAnchored` で検証できる |

## コマンド

```sh
npm ci
npm test              # node:test + hardhat-viem
npm run typecheck     # compile して artifacts の型を含めた tsc
npm run build         # hardhat compile
npm run abi:export    # backend が読む ABI を書き出す（生成物）
npm run node          # ローカル EVM ノード（chainId 31337）
```

**コントラクトを変えたら `npm test` と `npm run abi:export` を両方やり直す。**
ABI は `backend/chat/src/integrations/chain/abi/` へ出力される生成物で、手で編集しない。

## デプロイ

```sh
# ローカル
DEPLOYER_PRIVATE_KEY=0x... npm run deploy:local

# Polygon Amoy（テストネット）
DEPLOYER_PRIVATE_KEY=0x... npm run deploy:amoy

# Polygon（本番）
DEPLOYER_PRIVATE_KEY=0x... npm run deploy:polygon
```

出力されたアドレスを backend の `.env` に設定する。`.env.example` を写して `.env` を作り、
**秘密鍵はコミットしない**。

## 設計のメモ

- **入金 1 件 = イベント 1 件**。`depositId` はコントラクトが採番する連番で、backend はこれを
  冪等キーに使う。TX ハッシュではなく連番にしているのは、再編成で TX ハッシュが変わっても
  同じ入金を二重に取り込まないため（`(chain_id, contract_address, deposit_id)` で一意）。
- **アンカーは件数が増えるときだけ通る**。`MessageCountNotIncreasing` で弾くので、
  古い（短い）ログで上書きできない。
- **同じ root は二度記録できない**（`AlreadyAnchored`）。
- **root は消えない**。`latestRoot` を更新しても過去の root の記録は残るので、
  古い proof も検証し続けられる。
- `anchor` を呼べるのは `isAnchorer` のアドレスだけ。バックエンドの署名鍵を `setAnchorer` で
  登録する（デプロイ時の owner は最初から anchorer）。
