import z from 'zod';
import type { Hex } from 'viem';
import type { chat_messagesModel } from '../generated/prisma/models.js';
import { keccakOfUtf8 } from '../libs/hash';
import { toUlid, type Ulid } from './ids';

export const ZMessageRole = z.enum(['user', 'assistant']);
export type MessageRole = z.infer<typeof ZMessageRole>;

export type ChatMessage = {
  id: Ulid;
  roomId: Ulid;
  sequence: number;
  role: MessageRole;
  content: string;
  contentHash: Hex;
  modelId: string | null;
  inputTokens: number;
  outputTokens: number;
  creditsCharged: number;
  createdAt: Date;
};

export const toChatMessage = (row: chat_messagesModel): ChatMessage => ({
  id: toUlid(row.id),
  roomId: toUlid(row.room_id),
  sequence: row.sequence,
  role: ZMessageRole.parse(row.role),
  content: row.content,
  contentHash: row.content_hash as Hex,
  modelId: row.model_id,
  inputTokens: row.input_tokens,
  outputTokens: row.output_tokens,
  creditsCharged: row.credits_charged,
  createdAt: row.created_at,
});

/** 本文の指紋。content を 1 文字変えれば必ず変わる。 */
export const contentHashOf = (content: string): Hex => keccakOfUtf8(content);

/**
 * Merkle 木の葉。
 *
 *   keccak256("<roomId>|<sequence>|<role>|<contentHash>|<createdAt ISO(ms)>")
 *
 * 本文そのものではなく contentHash を挟むのは、葉の計算に本文の長さを持ち込まないため。
 * createdAt を含めるので、あとから時刻だけ書き換えても root が合わなくなる。
 * **この式を変えると過去のアンカーが検証できなくなる**ので、変えるならバージョンを分ける。
 */
export const messageLeaf = (message: {
  roomId: string;
  sequence: number;
  role: MessageRole;
  contentHash: Hex;
  createdAt: Date;
}): Hex =>
  keccakOfUtf8(
    [
      message.roomId,
      String(message.sequence),
      message.role,
      message.contentHash.toLowerCase(),
      message.createdAt.toISOString(),
    ].join('|'),
  );
