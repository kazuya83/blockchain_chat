import { useCallback, useEffect, useState } from 'react';
import { api, unwrap } from '@/lib/api';

export type RoomView = {
  id: string;
  title: string;
  modelId: string;
  systemPrompt: string | null;
  messageCount: number;
  anchoredMessageCount: number;
  unanchoredMessageCount: number;
  canAnchor: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChatModelView = {
  id: string;
  displayName: string;
  inputCreditsPer1kTokens: number;
  outputCreditsPer1kTokens: number;
};

export const useRooms = (enabled: boolean) => {
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [models, setModels] = useState<ChatModelView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const [roomList, modelList] = await Promise.all([
        api.GET('/api/rooms', {}).then((r) => unwrap(r) as RoomView[]),
        api.GET('/api/models', {}).then((r) => unwrap(r) as ChatModelView[]),
      ]);
      setRooms(roomList);
      setModels(modelList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント時のデータ取得。setState は await のあとで走る
    void reload();
  }, [reload]);

  const createRoom = useCallback(
    async (params: { title: string; modelId: string }) => {
      const room = unwrap(
        await api.POST('/api/rooms', {
          body: { title: params.title, modelId: params.modelId },
        }),
      ) as RoomView;
      setRooms((prev) => [room, ...prev]);
      return room;
    },
    [],
  );

  const removeRoom = useCallback(async (roomId: string) => {
    await api.DELETE('/api/rooms/{roomId}', { params: { path: { roomId } } });
    setRooms((prev) => prev.filter((room) => room.id !== roomId));
  }, []);

  return { rooms, models, error, reload, createRoom, removeRoom };
};
