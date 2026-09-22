import { keccak256, toHex } from 'viem';
import type { Hex } from 'viem';
import type { chat_roomsModel } from '../generated/prisma/models.js';
import { toUlid, type Ulid } from './ids';

export type ChatRoom = {
  id: Ulid;
  accountId: Ulid;
  title: string;
  modelId: string;
  systemPrompt: string | null;
  messageCount: number;
  anchoredMessageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export const toChatRoom = (row: chat_roomsModel): ChatRoom => ({
  id: toUlid(row.id),
  accountId: toUlid(row.account_id),
  title: row.title,
  modelId: row.model_id,
  systemPrompt: row.system_prompt,
  messageCount: row.message_count,
  anchoredMessageCount: row.anchored_message_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** チェーン上のキー。ULID は 26 文字で bytes32 に収まらないので keccak256 で畳む。 */
export const roomIdToBytes32 = (roomId: Ulid): Hex => keccak256(toHex(roomId));

/** まだアンカーされていないメッセージ件数。 */
export const unanchoredMessageCount = (room: ChatRoom): number =>
  room.messageCount - room.anchoredMessageCount;

/**
 * いまアンカーを打てるか。未アンカーのメッセージが 1 件も無ければ打つものが無い
 * （同じ件数の root はコントラクト側でも MessageCountNotIncreasing で弾かれる）。
 */
export const canAnchorRoom = (room: ChatRoom): boolean => unanchoredMessageCount(room) > 0;
