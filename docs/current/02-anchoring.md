# 会話ログの真正性（アンカー）

「この会話は、この内容で、この順番で、この時刻に記録された」ことをあとから示すための仕組み。
実装は `backend/chat/src/libs/merkle.ts`、`domains/messages.ts`、`usecases/anchorRoom.ts`、
`usecases/verifyMessage.ts`、`contracts/contracts/ChatLogAnchor.sol`。

## 1. 何をチェーンに載せ、何を載せないか

チェーンに載るのは **Merkle root（32 バイト）だけ**。会話の本文・本文のハッシュ・
ウォレットアドレス・トークン数はいずれも載せない。

理由は 2 つ。

- **費用**: 1 メッセージごとに TX を出すと、返答 1 回ごとにガスとレイテンシが乗る。
  root なら何件でも 1 TX で覆える。
- **秘匿**: パブリックチェーンに書いたものは消せない。会話の本文はもちろん、本文ごとの
  ハッシュを並べるだけでも「いつ何件やりとりしたか」が外から読める。

代わりに、**本文は DB にあり、その正しさは root との突き合わせで示す**。DB の管理者が本文を
書き換えれば root が合わなくなるので、改ざん自体は防げないが**検出できる**。

## 2. ハッシュの段階

3 段ある。混同しやすいので分けて書く。

```
content（本文）
  │ keccak256(utf8)
  ↓
content_hash        ← chat_messages.content_hash に保存
  │ keccak256(utf8("roomId|sequence|role|contentHash|createdAt"))
  ↓
leaf（葉）           ← 保存しない。必要なとき計算し直す
  │ ソート済みペアの keccak256 を繰り返す
  ↓
merkle root         ← log_anchors.merkle_root に保存し、チェーンへ送る
```

### content_hash

本文だけの指紋。`domains/messages.ts` の `contentHashOf`。
**これだけ一致しても「その順番でその時刻に記録された」ことは言えない**。

### leaf

`domains/messages.ts` の `messageLeaf` が正本。

```
keccak256("<roomId>|<sequence>|<role>|<contentHash>|<createdAt ISO(ms)>")
```

- 本文そのものではなく `contentHash` を挟むのは、葉の計算に本文の長さを持ち込まないため。
- `sequence` を含めるので、メッセージの**並べ替え**が検出できる。
- `createdAt` を含めるので、**時刻だけの書き換え**も検出できる。
- `role` を含めるので、user の発言を assistant の発言に付け替えることもできない。

**この式を変えると過去のアンカーが検証できなくなる。** 変えるならバージョンを分け、
アンカーごとにどの式で作ったかを持たせる（現状は 1 種類しかないので持っていない）。

### merkle root

`libs/merkle.ts`。ソート済みペア（小さい方 → 大きい方の順で連結）の keccak256 で畳む。
要素が奇数のときは余った 1 つをそのまま次の段へ繰り上げる。

ペアの順序を固定しているので、proof に左右の情報を持たせずに済む。これは OpenZeppelin の
`MerkleProof.verify` と同じ計算なので、**将来オンチェーン検証へ回せる**。

## 3. アンカーを打つ

`POST /api/rooms/:roomId/anchors` → `usecases/anchorRoom.ts`。

1. アンカーが有効か確認する（`CHAIN_CHAT_LOG_ANCHOR_ADDRESS` と
   `CHAIN_ANCHORER_PRIVATE_KEY` の両方がある）。無ければ 503。
2. ルームの所有者か確認する。
3. 未アンカーのメッセージが 1 件以上あるか確認する（`canAnchorRoom`）。
4. **確定待ちのアンカーが無いか確認する。** あれば 409 で断る。
5. 先頭から現在の件数までのメッセージを取り、葉を作り、root を計算する。
6. `log_anchors` に `pending` で行を作る。
7. `ChatLogAnchor.anchor(roomId, root, messageCount)` を送る。
8. `CHAIN_CONFIRMATIONS` ぶん確定を待ち、`confirmed` にして
   `chat_rooms.anchored_message_count` を進める。

root は**先頭から現在の件数まで**を覆う（差分ではない）。過去のアンカーは残したままなので、
古い root に対する proof も引き続き検証できる。

### なぜ pending 中は受け付けないか

TX を出したあと確定を待つ間に別のアンカーを始めると、2 本目の `messageCount` が 1 本目と
同じか小さくなることがあり、コントラクト側の `MessageCountNotIncreasing` で片方が必ず失敗する。
失敗を後から説明するより、待たせる方が分かりやすい。

### 失敗したとき

- TX の送信に失敗 → `failed` にして理由を残し、例外を投げる。
- TX が revert → `failed` にして返す（例外にはしない。ユーザーには「記録できなかった」が伝わる）。

どちらも `anchored_message_count` は進めないので、次に打ち直せる。

## 4. 検証する

`GET /api/rooms/:roomId/messages/:messageId/verification` → `usecases/verifyMessage.ts`。

**3 つを別々に確認して並べて返す。1 つの boolean に畳まない。**

| チェック | 何を見るか | 失敗が意味すること |
| --- | --- | --- |
| `contentHashMatches` | DB の本文から計算し直したハッシュが `content_hash` と一致するか | 本文だけが書き換えられた（DB 内部で既に矛盾している） |
| `proofMatches` | 葉がアンカーの root に含まれるか | 本文・順番・時刻・role のどれかが、アンカー時点と違う |
| `anchoredOnChain` | その root がチェーン上に記録されているか | `log_anchors` の行が捏造された、または見ているチェーンが違う |

3 つとも真のときだけ `verified: true`。畳まないのは、**「検証できない」と「改ざんされている」が
まったく違う状態**だから。まだアンカーされていないメッセージは `reason` に理由が入る
（改ざんの疑いではない）。

検証に使うのは**確定済み（`confirmed`）のアンカーだけ**。pending の root は再編成で
消えうるので、真正性の根拠にしない。

## 5. この仕組みが示せないこと

正直に書いておく。

- **本文がチェーンにあるわけではない。** DB のデータが失われれば、root だけ残っても
  内容は復元できない。
- **運営が最初から嘘のログを書き込むことは防げない。** アンカーは「記録したあとに変えていない」
  ことしか示さない。記録の時点で正しかったかは別の問題。
- **アンカーを打つまでの間は無防備。** 打っていないメッセージは、いつでも書き換えられる。
  どれくらいの頻度で打つかは運用の判断で、いまは手動（画面のボタン）。
- **`isAnchored` を見るのは backend**。ユーザーが自分で確かめたい場合は、レスポンスに含まれる
  `leaf` / `proof` / `merkleRoot` と、コントラクトのアドレスを使って自分で計算し直せる。
  そのために proof をレスポンスへ含めている。
