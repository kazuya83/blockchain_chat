import type { Hex } from 'viem';
import { toLogAnchor, type AnchorStatus, type LogAnchor } from '../domains/anchors';
import { newUlid, type Ulid } from '../domains/ids';
import { getPrisma, type Db } from './_client';

export const listAnchorsByRoom = async (
  roomId: Ulid,
  db: Db = getPrisma(),
): Promise<LogAnchor[]> => {
  const rows = await db.log_anchors.findMany({
    where: { room_id: roomId },
    orderBy: { sequence: 'desc' },
  });
  return rows.map(toLogAnchor);
};

/** そのメッセージ件数を覆う、いちばん小さい確定済みアンカー。 */
export const findConfirmedAnchorCovering = async (
  params: { roomId: Ulid; messageSequence: number },
  db: Db = getPrisma(),
): Promise<LogAnchor | null> => {
  const row = await db.log_anchors.findFirst({
    where: {
      room_id: params.roomId,
      status: 'confirmed',
      message_count: { gte: params.messageSequence },
    },
    orderBy: { message_count: 'asc' },
  });
  return row == null ? null : toLogAnchor(row);
};

export const findAnchorById = async (
  id: Ulid,
  db: Db = getPrisma(),
): Promise<LogAnchor | null> => {
  const row = await db.log_anchors.findUnique({ where: { id } });
  return row == null ? null : toLogAnchor(row);
};

export const hasPendingAnchor = async (
  roomId: Ulid,
  db: Db = getPrisma(),
): Promise<boolean> => {
  const count = await db.log_anchors.count({
    where: { room_id: roomId, status: 'pending' },
  });
  return count > 0;
};

export const createPendingAnchor = async (
  params: {
    roomId: Ulid;
    merkleRoot: Hex;
    messageCount: number;
    chainId: number;
    contractAddress: string;
  },
  db: Db = getPrisma(),
): Promise<LogAnchor> => {
  const last = await db.log_anchors.findFirst({
    where: { room_id: params.roomId },
    orderBy: { sequence: 'desc' },
  });

  const row = await db.log_anchors.create({
    data: {
      id: newUlid(),
      room_id: params.roomId,
      sequence: (last?.sequence ?? 0) + 1,
      merkle_root: params.merkleRoot,
      message_count: params.messageCount,
      chain_id: params.chainId,
      contract_address: params.contractAddress,
      status: 'pending',
    },
  });
  return toLogAnchor(row);
};

export const attachTxHash = async (
  params: { anchorId: Ulid; txHash: string },
  db: Db = getPrisma(),
): Promise<void> => {
  await db.log_anchors.update({
    where: { id: params.anchorId },
    data: { tx_hash: params.txHash },
  });
};

export const settleAnchor = async (
  params: {
    anchorId: Ulid;
    status: Extract<AnchorStatus, 'confirmed' | 'failed'>;
    blockNumber?: bigint;
    failureReason?: string;
  },
  db: Db = getPrisma(),
): Promise<LogAnchor> => {
  const row = await db.log_anchors.update({
    where: { id: params.anchorId },
    data: {
      status: params.status,
      block_number: params.blockNumber ?? null,
      failure_reason: params.failureReason ?? null,
      confirmed_at: params.status === 'confirmed' ? new Date() : null,
    },
  });
  return toLogAnchor(row);
};
