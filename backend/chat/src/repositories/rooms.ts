import { newUlid, type Ulid } from '../domains/ids';
import { toChatRoom, type ChatRoom } from '../domains/rooms';
import { getPrisma, type Db } from './_client';

export const listRoomsByAccount = async (
  accountId: Ulid,
  db: Db = getPrisma(),
): Promise<ChatRoom[]> => {
  const rows = await db.chat_rooms.findMany({
    where: { account_id: accountId },
    orderBy: { updated_at: 'desc' },
  });
  return rows.map(toChatRoom);
};

/** 所有者の絞り込みは repository 側で行う。route に書くと漏れる。 */
export const findRoomOwnedBy = async (
  params: { roomId: Ulid; accountId: Ulid },
  db: Db = getPrisma(),
): Promise<ChatRoom | null> => {
  const row = await db.chat_rooms.findFirst({
    where: { id: params.roomId, account_id: params.accountId },
  });
  return row == null ? null : toChatRoom(row);
};

export const createRoom = async (
  params: {
    accountId: Ulid;
    title: string;
    modelId: string;
    systemPrompt: string | null;
  },
  db: Db = getPrisma(),
): Promise<ChatRoom> => {
  const row = await db.chat_rooms.create({
    data: {
      id: newUlid(),
      account_id: params.accountId,
      title: params.title,
      model_id: params.modelId,
      system_prompt: params.systemPrompt,
    },
  });
  return toChatRoom(row);
};

export const updateRoomTitle = async (
  params: { roomId: Ulid; accountId: Ulid; title: string },
  db: Db = getPrisma(),
): Promise<number> => {
  const result = await db.chat_rooms.updateMany({
    where: { id: params.roomId, account_id: params.accountId },
    data: { title: params.title },
  });
  return result.count;
};

export const deleteRoom = async (
  params: { roomId: Ulid; accountId: Ulid },
  db: Db = getPrisma(),
): Promise<number> => {
  const result = await db.chat_rooms.deleteMany({
    where: { id: params.roomId, account_id: params.accountId },
  });
  return result.count;
};

/** アンカーが確定したときに「どこまで覆ったか」を進める。後戻りはさせない。 */
export const advanceAnchoredMessageCount = async (
  params: { roomId: Ulid; messageCount: number },
  db: Db = getPrisma(),
): Promise<void> => {
  await db.chat_rooms.updateMany({
    where: { id: params.roomId, anchored_message_count: { lt: params.messageCount } },
    data: { anchored_message_count: params.messageCount },
  });
};
