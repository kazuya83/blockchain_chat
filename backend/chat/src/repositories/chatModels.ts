import { toChatModel, type ChatModel } from '../domains/chatModels';
import { getPrisma, type Db } from './_client';

export const listChatModels = async (db: Db = getPrisma()): Promise<ChatModel[]> => {
  const rows = await db.chat_models.findMany({ orderBy: { sort_order: 'asc' } });
  return rows.map(toChatModel);
};

export const findChatModel = async (
  id: string,
  db: Db = getPrisma(),
): Promise<ChatModel | null> => {
  const row = await db.chat_models.findUnique({ where: { id } });
  return row == null ? null : toChatModel(row);
};
