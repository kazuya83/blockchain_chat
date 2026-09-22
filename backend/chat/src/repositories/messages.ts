import { newUlid, type Ulid } from '../domains/ids';
import {
  contentHashOf,
  toChatMessage,
  type ChatMessage,
  type MessageRole,
} from '../domains/messages';
import { getPrisma, type Db } from './_client';

export const listMessages = async (
  params: { roomId: Ulid; limit?: number },
  db: Db = getPrisma(),
): Promise<ChatMessage[]> => {
  const rows = await db.chat_messages.findMany({
    where: { room_id: params.roomId },
    orderBy: { sequence: 'asc' },
    ...(params.limit == null ? {} : { take: params.limit }),
  });
  return rows.map(toChatMessage);
};

/** アンカーが覆う範囲（先頭から messageCount 件）だけを取る。 */
export const listMessagesUpTo = async (
  params: { roomId: Ulid; messageCount: number },
  db: Db = getPrisma(),
): Promise<ChatMessage[]> => {
  const rows = await db.chat_messages.findMany({
    where: { room_id: params.roomId, sequence: { lte: params.messageCount } },
    orderBy: { sequence: 'asc' },
  });
  return rows.map(toChatMessage);
};

export const findMessageInRoom = async (
  params: { roomId: Ulid; messageId: Ulid },
  db: Db = getPrisma(),
): Promise<ChatMessage | null> => {
  const row = await db.chat_messages.findFirst({
    where: { id: params.messageId, room_id: params.roomId },
  });
  return row == null ? null : toChatMessage(row);
};

/**
 * メッセージを追記する。sequence は chat_rooms.message_count をインクリメントして採番する。
 * ルーム行を先に更新することで、同じルームへの並行追記が直列化される
 * （uk_chat_messages_room_id_sequence があるので、すり抜けても重複は挿入されない）。
 */
export const appendMessage = async (
  params: {
    roomId: Ulid;
    role: MessageRole;
    content: string;
    modelId?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    creditsCharged?: number;
  },
  db: Db = getPrisma(),
): Promise<ChatMessage> => {
  const room = await db.chat_rooms.update({
    where: { id: params.roomId },
    data: { message_count: { increment: 1 } },
  });

  const row = await db.chat_messages.create({
    data: {
      id: newUlid(),
      room_id: params.roomId,
      sequence: room.message_count,
      role: params.role,
      content: params.content,
      content_hash: contentHashOf(params.content),
      model_id: params.modelId ?? null,
      input_tokens: params.inputTokens ?? 0,
      output_tokens: params.outputTokens ?? 0,
      credits_charged: params.creditsCharged ?? 0,
    },
  });

  return toChatMessage(row);
};
