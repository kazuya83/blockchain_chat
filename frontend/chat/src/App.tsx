import { useCallback, useState } from 'react';
import { cn } from '@/lib/cn';
import { useSession } from '@/features/auth/useSession';
import { ChatView } from '@/features/chat/ChatView';
import { useRooms } from '@/features/chat/useRooms';
import { CreditPanel } from '@/features/credits/CreditPanel';

export const App = () => {
  const session = useSession();
  const signedIn = session.account != null;
  const { rooms, models, reload, createRoom, removeRoom } = useRooms(signedIn);

  // 選択と残高は「まだ選んでいない / まだ動かしていない」を null で表し、
  // 既定値はレンダー時に導出する。effect で state を同期させると、
  // 読み込みのたびに 1 往復よけいに描画が走る。
  const [pickedRoomId, setPickedRoomId] = useState<string | null>(null);
  const [movedBalance, setMovedBalance] = useState<string | null>(null);

  const selectedRoomId = pickedRoomId ?? rooms[0]?.id ?? null;
  const balance = movedBalance ?? session.account?.creditBalance ?? '0';

  const onRoomChanged = useCallback(() => {
    void reload();
  }, [reload]);

  if (session.loading) {
    return <Centered>読み込み中…</Centered>;
  }

  if (!signedIn) {
    return (
      <Centered>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">blockchain chat</h1>
          <p className="text-sm text-ink-muted">
            ウォレットで署名してサインインする。署名にガスはかからない。
          </p>
          <button
            type="button"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={session.signingIn}
            onClick={() => void session.signIn()}
          >
            {session.signingIn ? '署名を待っている…' : 'ウォレットでサインイン'}
          </button>
          {!session.wallet.available && (
            <p className="text-xs text-warn">
              ウォレット拡張が見つからない。MetaMask などを入れる。
            </p>
          )}
          {session.error != null && <p className="text-xs text-danger">{session.error}</p>}
        </div>
      </Centered>
    );
  }

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;

  return (
    <div className="grid h-full grid-cols-[18rem_1fr]">
      <aside className="flex min-h-0 flex-col border-r border-border-subtle">
        <header className="border-b border-border-subtle px-4 py-3">
          <p className="text-sm font-semibold">blockchain chat</p>
          <p className="truncate font-mono text-xs text-ink-muted">
            {session.account?.walletAddressChecksum}
          </p>
        </header>

        <RoomList
          rooms={rooms}
          models={models}
          selectedRoomId={selectedRoomId}
          onSelect={setPickedRoomId}
          onCreate={async (params) => {
            const room = await createRoom(params);
            setPickedRoomId(room.id);
          }}
          onDelete={async (roomId) => {
            await removeRoom(roomId);
            if (pickedRoomId === roomId) setPickedRoomId(null);
          }}
        />

        <CreditPanel balance={balance} onBalanceChanged={setMovedBalance} />

        <button
          type="button"
          className="border-t border-border-subtle px-4 py-3 text-left text-xs text-ink-muted"
          onClick={() => void session.signOut()}
        >
          サインアウト
        </button>
      </aside>

      <main className="min-h-0">
        {selectedRoom == null ? (
          <Centered>左のリストからルームを選ぶか、新しく作る。</Centered>
        ) : (
          <ChatView
            key={selectedRoom.id}
            room={selectedRoom}
            onRoomChanged={onRoomChanged}
            onBalanceChanged={setMovedBalance}
          />
        )}
      </main>
    </div>
  );
};

type RoomListProps = {
  rooms: ReturnType<typeof useRooms>['rooms'];
  models: ReturnType<typeof useRooms>['models'];
  selectedRoomId: string | null;
  onSelect: (roomId: string) => void;
  onCreate: (params: { title: string; modelId: string }) => Promise<void>;
  onDelete: (roomId: string) => Promise<void>;
};

const RoomList = ({
  rooms,
  models,
  selectedRoomId,
  onSelect,
  onCreate,
  onDelete,
}: RoomListProps) => {
  const [title, setTitle] = useState('');
  const [pickedModelId, setPickedModelId] = useState<string | null>(null);
  const modelId = pickedModelId ?? models[0]?.id ?? '';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-border-subtle px-4 py-3">
        <input
          className="w-full rounded-md border border-border-subtle bg-surface px-2 py-1 text-sm"
          placeholder="新しいルーム名"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="w-full rounded-md border border-border-subtle bg-surface px-2 py-1 text-xs"
          value={modelId}
          onChange={(e) => setPickedModelId(e.target.value)}
          aria-label="モデル"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}（in {model.inputCreditsPer1kTokens} / out{' '}
              {model.outputCreditsPer1kTokens} per 1k）
            </option>
          ))}
        </select>
        <button
          type="button"
          className="w-full rounded-md bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          disabled={title.trim() === '' || modelId === ''}
          onClick={() => {
            void onCreate({ title: title.trim(), modelId }).then(() => setTitle(''));
          }}
        >
          ルームを作る
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rooms.map((room) => (
          <li key={room.id} className="group flex items-center">
            <button
              type="button"
              className={cn(
                'min-w-0 flex-1 px-4 py-2 text-left text-sm',
                room.id === selectedRoomId ? 'bg-accent-soft font-medium' : 'hover:bg-surface-muted',
              )}
              onClick={() => onSelect(room.id)}
            >
              <span className="block truncate">{room.title}</span>
              <span className="block text-xs text-ink-muted">
                {room.messageCount} 件
                {room.unanchoredMessageCount > 0 && ` ・ 未記録 ${room.unanchoredMessageCount}`}
              </span>
            </button>
            <button
              type="button"
              className="px-2 text-xs text-ink-muted opacity-0 group-hover:opacity-100"
              aria-label={`${room.title} を削除`}
              onClick={() => void onDelete(room.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-full items-center justify-center p-8 text-sm text-ink-muted">
    {children}
  </div>
);
