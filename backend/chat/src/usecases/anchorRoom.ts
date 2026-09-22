import type { LogAnchor } from '../domains/anchors';
import type { Ulid } from '../domains/ids';
import { messageLeaf } from '../domains/messages';
import { canAnchorRoom, roomIdToBytes32 } from '../domains/rooms';
import { merkleRoot } from '../libs/merkle';
import { chainConfig, isAnchoringEnabled } from '../integrations/chain/config';
import { sendAnchorTransaction, waitForAnchorReceipt } from '../integrations/chain/client';
import {
  attachTxHash,
  createPendingAnchor,
  hasPendingAnchor,
  settleAnchor,
} from '../repositories/anchors';
import { listMessagesUpTo } from '../repositories/messages';
import { advanceAnchoredMessageCount, findRoomOwnedBy } from '../repositories/rooms';
import {
  AnchorInProgressError,
  AnchoringDisabledError,
  NothingToAnchorError,
  RoomNotFoundError,
} from './errors';

/**
 * ルームの会話ログの Merkle root をチェーンへ記録する。
 *
 * root は**先頭から現在のメッセージ件数まで**を覆う。過去のアンカーは残したままなので、
 * 古い root に対する proof も引き続き検証できる。
 *
 * TX を出したあと確定を待つ間に別のアンカーを始めると、コントラクト側の
 * MessageCountNotIncreasing で片方が必ず失敗する。待たせる方が分かりやすいので、
 * pending があるうちは受け付けない。
 */
export const anchorRoom = async (params: {
  accountId: Ulid;
  roomId: Ulid;
}): Promise<LogAnchor> => {
  if (!isAnchoringEnabled()) throw new AnchoringDisabledError();

  const room = await findRoomOwnedBy({ roomId: params.roomId, accountId: params.accountId });
  if (room == null) throw new RoomNotFoundError();
  if (!canAnchorRoom(room)) throw new NothingToAnchorError();
  if (await hasPendingAnchor(room.id)) throw new AnchorInProgressError();

  const messages = await listMessagesUpTo({
    roomId: room.id,
    messageCount: room.messageCount,
  });
  if (messages.length === 0) throw new NothingToAnchorError();

  const root = merkleRoot(messages.map(messageLeaf));

  const anchor = await createPendingAnchor({
    roomId: room.id,
    merkleRoot: root,
    messageCount: messages.length,
    chainId: chainConfig.chainId,
    contractAddress: chainConfig.chatLogAnchorAddress,
  });

  let txHash: `0x${string}`;
  try {
    txHash = await sendAnchorTransaction({
      roomKey: roomIdToBytes32(room.id),
      merkleRoot: root,
      messageCount: messages.length,
    });
  } catch (error) {
    await settleAnchor({
      anchorId: anchor.id,
      status: 'failed',
      failureReason: truncate(error),
    });
    throw error;
  }

  await attachTxHash({ anchorId: anchor.id, txHash });

  const receipt = await waitForAnchorReceipt(txHash);
  if (receipt.status !== 'success') {
    return settleAnchor({
      anchorId: anchor.id,
      status: 'failed',
      failureReason: `tx reverted: ${txHash}`,
    });
  }

  const settled = await settleAnchor({
    anchorId: anchor.id,
    status: 'confirmed',
    blockNumber: receipt.blockNumber,
  });

  await advanceAnchoredMessageCount({
    roomId: room.id,
    messageCount: messages.length,
  });

  return settled;
};

const truncate = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 255);
