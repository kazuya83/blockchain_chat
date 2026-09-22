import type { Hex } from 'viem';
import { isVerified, type LogAnchor } from '../domains/anchors';
import type { Ulid } from '../domains/ids';
import { contentHashOf, messageLeaf, type ChatMessage } from '../domains/messages';
import { roomIdToBytes32 } from '../domains/rooms';
import { merkleProof, merkleRoot } from '../libs/merkle';
import { readIsAnchored } from '../integrations/chain/client';
import { findConfirmedAnchorCovering } from '../repositories/anchors';
import { findMessageInRoom, listMessagesUpTo } from '../repositories/messages';
import { findRoomOwnedBy } from '../repositories/rooms';
import { MessageNotFoundError, RoomNotFoundError } from './errors';

export type VerifyMessageResult = {
  message: ChatMessage;
  anchor: LogAnchor | null;
  leaf: Hex;
  proof: Hex[];
  verified: boolean;
  contentHashMatches: boolean;
  proofMatches: boolean;
  anchoredOnChain: boolean;
  /** アンカーがまだ無い場合の理由 */
  reason: string | null;
};

/**
 * メッセージ 1 件が「アンカー時点のログに、この内容で含まれていた」ことを確かめる。
 *
 * 3 つを別々に確認して並べる。どこで落ちたかが分からないと直しようがないため、
 * 1 つの boolean に畳まない。
 *
 *   1. DB の本文から計算し直したハッシュが content_hash と一致するか（DB 内部の整合）
 *   2. その葉が anchor の root に含まれるか（Merkle proof）
 *   3. その root がチェーン上に記録されているか（改ざんできない外部の証跡）
 */
export const verifyMessage = async (params: {
  accountId: Ulid;
  roomId: Ulid;
  messageId: Ulid;
}): Promise<VerifyMessageResult> => {
  const room = await findRoomOwnedBy({ roomId: params.roomId, accountId: params.accountId });
  if (room == null) throw new RoomNotFoundError();

  const message = await findMessageInRoom({
    roomId: params.roomId,
    messageId: params.messageId,
  });
  if (message == null) throw new MessageNotFoundError();

  const contentHashMatches = contentHashOf(message.content) === message.contentHash;

  const anchor = await findConfirmedAnchorCovering({
    roomId: room.id,
    messageSequence: message.sequence,
  });
  if (anchor == null) {
    return {
      message,
      anchor: null,
      leaf: messageLeaf(message),
      proof: [],
      verified: false,
      contentHashMatches,
      proofMatches: false,
      anchoredOnChain: false,
      reason: 'このメッセージを覆う確定済みのアンカーがまだ無い',
    };
  }

  const covered = await listMessagesUpTo({
    roomId: room.id,
    messageCount: anchor.messageCount,
  });
  const leaves = covered.map(messageLeaf);
  const index = covered.findIndex((m) => m.id === message.id);

  const leaf = messageLeaf(message);
  const proof = index < 0 ? [] : merkleProof(leaves, index);
  const recomputedRoot = leaves.length === 0 ? null : merkleRoot(leaves);
  const proofMatches =
    index >= 0 && recomputedRoot != null && recomputedRoot === anchor.merkleRoot;

  const anchoredOnChain = await readIsAnchored({
    roomKey: roomIdToBytes32(room.id),
    merkleRoot: anchor.merkleRoot,
  });

  const checks = { contentHashMatches, proofMatches, anchoredOnChain };

  return {
    message,
    anchor,
    leaf,
    proof,
    verified: isVerified(checks),
    ...checks,
    reason: null,
  };
};
