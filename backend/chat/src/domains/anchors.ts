import z from 'zod';
import type { Hex } from 'viem';
import type { log_anchorsModel } from '../generated/prisma/models.js';
import { toUlid, type Ulid } from './ids';

export const ZAnchorStatus = z.enum(['pending', 'confirmed', 'failed']);
export type AnchorStatus = z.infer<typeof ZAnchorStatus>;

export type LogAnchor = {
  id: Ulid;
  roomId: Ulid;
  sequence: number;
  merkleRoot: Hex;
  messageCount: number;
  chainId: number;
  contractAddress: string;
  txHash: string | null;
  blockNumber: bigint | null;
  status: AnchorStatus;
  failureReason: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
};

export const toLogAnchor = (row: log_anchorsModel): LogAnchor => ({
  id: toUlid(row.id),
  roomId: toUlid(row.room_id),
  sequence: row.sequence,
  merkleRoot: row.merkle_root as Hex,
  messageCount: row.message_count,
  chainId: row.chain_id,
  contractAddress: row.contract_address,
  txHash: row.tx_hash,
  blockNumber: row.block_number,
  status: ZAnchorStatus.parse(row.status),
  failureReason: row.failure_reason,
  createdAt: row.created_at,
  confirmedAt: row.confirmed_at,
});

/** 証明に使えるのは確定済みのアンカーだけ。pending の root はまだ覆らない可能性がある。 */
export const isProvable = (anchor: LogAnchor): boolean => anchor.status === 'confirmed';

/** 真正性確認の結果。どこで失敗したかを畳まずに並べる。 */
export type VerificationResult = {
  verified: boolean;
  /** DB の本文から計算し直したハッシュが、保存済みの content_hash と一致するか */
  contentHashMatches: boolean;
  /** 葉が anchor の merkle root に含まれるか */
  proofMatches: boolean;
  /** その root がチェーン上に記録されているか */
  anchoredOnChain: boolean;
};

export const isVerified = (result: Omit<VerificationResult, 'verified'>): boolean =>
  result.contentHashMatches && result.proofMatches && result.anchoredOnChain;
