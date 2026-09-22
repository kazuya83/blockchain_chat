# 前払いクレジット

チャットの利用料。実装は `domains/credits.ts`、`domains/chatModels.ts`、
`repositories/credits.ts`、`usecases/syncDeposits.ts`、`usecases/sendMessage.ts`、
`contracts/contracts/ChatCredit.sol`。

## 1. クレジットとは何か

**アプリ内の課金単位（整数）で、チェーン上のトークンではない。** 入金はチェーンで受けるが、
消費は DB の中だけで完結する。

1 クレジット = 0.0001 USD 相当として、Claude API の公開価格をそのまま換算している
（`database/chat/sql/master/010-chat_models.sql`）。

| モデル | 入力 / 1k トークン | 出力 / 1k トークン |
| --- | --- | --- |
| Claude Opus 5 | 50 | 250 |
| Claude Sonnet 5 | 20 | 100 |
| Claude Haiku 4.5 | 10 | 50 |

レートを変えるときは master の SQL を直し、全環境に流し直す。**画面からは編集できない。**

## 2. なぜ 1 メッセージごとに TX を出さないのか

出すとこうなる。

- 返答のたびにガスがかかる。1 往復あたりの原価より高くつくこともある。
- 返答のたびにブロック確定を待つ（Polygon でも数秒）。会話のテンポが壊れる。
- 失敗した TX の扱い（返答は返したのに課金できていない）を毎回考えることになる。

なので**入金だけチェーン、消費は DB** にしている。チェーンに残るのは
「誰がいくら入れたか」で、何に使ったかは残らない。

## 3. 入金

```
ウォレット ──deposit() + value──→ ChatCredit
                                    │ Deposited(depositId, user, amount, payer)
                                    ↓
            backend（syncDeposits）──→ credit_deposits へ 1 行 + credit_ledger + 残高加算
```

- `deposit()` / `depositFor(address)` / **素の送金**のいずれでも受ける。
  ウォレットから直接送られた分を取りこぼさないため。
- `depositId` はコントラクトが採番する連番。backend はこれを冪等キーに使う。
- 換算は `weiToCredits(amountWei, CHAIN_WEI_PER_CREDIT)`。**端数は切り捨て**。
  レートを env に置いているのは、トークン価格が動くため。

### 二重付与を防いでいるもの

`credit_deposits` の `(chain_id, contract_address, deposit_id)` の unique 制約**だけ**。
挿入が `P2002` で弾かれたら「取り込み済み」として残高に触らない。
**この制約を外すと、同じ範囲を二度流したときに残高が二重に増える。**

TX ハッシュではなく連番を使っているのは、再編成で TX ハッシュが変わっても同じ入金を
同じキーで識別できるようにするため。

### 再編成への備え

`CHAIN_CONFIRMATIONS`（既定 5）ぶん手前までしか読まない。消えうるブロックの入金を先に
付与すると、あとから取り消せない。

### 未知のアドレスからの入金

アカウントを作って受ける。入金者がまだサインインしていないことはふつうにある。
そのアドレスで初めてサインインしたとき、既に残高が入っている状態になる。

### 取り込みの起動

いまは `POST /api/me/credits/sync`（画面の「チェーンから取り込む」）だけ。
定期実行のワーカーは置いていない。**入金してもボタンを押すまで残高に反映されない**ので、
運用に載せるなら cron なり常駐なりで `syncDeposits()` を回す。

## 4. 消費

`usecases/sendMessage.ts`。順序がすべてで、次のように「使いすぎ」を構造的に防いでいる。

1. **入力トークンを実際に数える**（`countTokens`。見積もりではない）
2. **残高から、この往復で出せる出力トークンの上限を決める**（`affordableOutputTokens`）
3. **その上限ぶんを先に引き当てる**（`consumeCredits`）
4. **上限を `max_tokens` として送る**ので、実績が引き当てを超えない
5. **実績が出たら差額を戻す**

### なぜ「残高を見てから減らす」ではないのか

読んでから書くと、同時に 2 本走ったときに両方が「足りる」と判断して二重に使える。
`consumeCredits` は `WHERE credit_balance >= ?` の条件付き UPDATE で、更新できた場合にのみ
台帳を書く。**更新 0 件 = 残高不足**として扱う。

### なぜ出力の上限を先に縛るのか

先に縛らないと、実績が引き当てを超えたときに残高がマイナスになる。マイナスを許すと
「取り立て」の仕組みが要る。上限を `max_tokens` として送れば、超えようがない。

副作用として、**残高が少ないユーザーは短い返答しか得られない**。残高が
`MIN_OUTPUT_TOKENS`（256）ぶんも無ければ 402 を返して断る。

### 失敗したとき

引き当てを全額戻す。**ユーザー発言の行は残す**。消すと `chat_messages.sequence` に穴が空き、
アンカーと突き合わなくなる。

## 5. 台帳と残高

- `credit_ledger` が増減の記録、`accounts.credit_balance` はその合計のキャッシュ。
  **両方を同じ処理で更新する。片方だけ書き換えない。**
- `kind` は `deposit`（入金） / `consume`（消費） / `adjust`（差額の戻し・手動調整）。
- `(reference_type, reference_id)` が unique なので、同じ入金・同じメッセージで
  二重に台帳が積まれない。

## 6. 引き出し

`ChatCredit.withdraw(to)` を owner が呼ぶと、コントラクトの残高がまとめて出る。
**アプリ側のクレジット残高とは連動しない**（未消費のクレジットが残っていても引き出せる）。
運用としては、未消費ぶんを負債として別に把握する必要がある。
