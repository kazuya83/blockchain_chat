import { useCallback, useEffect, useRef, useState } from 'react';
import { api, sendMessageStream, unwrap, type ChatMessageView } from '@/lib/api';
import { cn } from '@/lib/cn';
import { AnchorPanel } from '@/features/anchors/AnchorPanel';
import { VerificationBadge } from '@/features/anchors/VerificationBadge';
import type { RoomView } from './useRooms';

type Props = {
  room: RoomView;
  onRoomChanged: () => void;
  onBalanceChanged: (balance: string) => void;
};

export const ChatView = ({ room, onRoomChanged, onBalanceChanged }: Props) => {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState('');
  const [streaming, setStreaming] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const list = unwrap(
      await api.GET('/api/rooms/{roomId}/messages', {
        params: { path: { roomId: room.id } },
      }),
    ) as ChatMessageView[];
    setMessages(list);
  }, [room.id]);

  // App 側で room.id を key にしているので、ルームを切り替えると作り直される。
  // ここで state をリセットする必要はない。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント時のデータ取得。setState は await のあとで走る
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const send = async () => {
    const content = draft.trim();
    if (content === '' || sending) return;

    setSending(true);
    setError(null);
    setDraft('');
    setThinking('');
    setStreaming('');

    try {
      const done = await sendMessageStream({
        roomId: room.id,
        content,
        onEvent: (event) => {
          if (event.type === 'thinking') setThinking((prev) => prev + event.text);
          if (event.type === 'text') setStreaming((prev) => prev + event.text);
        },
      });

      setMessages((prev) => [...prev, done.userMessage, done.assistantMessage]);
      setStreaming('');
      setThinking('');
      onBalanceChanged(done.balanceAfter);
      onRoomChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // 失敗してもユーザー発言は記録済みなので、履歴を取り直して表示を合わせる
      await loadMessages();
      setStreaming('');
      setThinking('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{room.title}</h2>
          <p className="truncate text-xs text-ink-muted">
            {room.modelId} ・ {room.messageCount} 件（うちアンカー済み{' '}
            {room.anchoredMessageCount} 件）
          </p>
        </div>
        <AnchorPanel room={room} onAnchored={onRoomChanged} />
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && streaming === '' && (
          <p className="text-sm text-ink-muted">まだ発言がない。下の入力欄から話しかける。</p>
        )}

        {messages.map((message) => (
          <MessageRow key={message.id} roomId={room.id} message={message} />
        ))}

        {thinking !== '' && (
          <div className="rounded-lg border border-dashed border-border-subtle px-4 py-3">
            <p className="mb-1 text-xs font-medium text-ink-muted">考えている…</p>
            <p className="whitespace-pre-wrap text-sm text-ink-muted">{thinking}</p>
          </div>
        )}

        {streaming !== '' && (
          <div className="rounded-lg bg-surface-muted px-4 py-3">
            <p className="mb-1 text-xs font-medium text-ink-muted">assistant</p>
            <p className="whitespace-pre-wrap text-sm">{streaming}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error != null && (
        <p className="border-t border-border-subtle px-5 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="border-t border-border-subtle p-4">
        <div className="flex items-end gap-2">
          <textarea
            className="min-h-20 flex-1 resize-y rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="メッセージを入力（Ctrl+Enter で送信）"
            value={draft}
            disabled={sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            className={cn(
              'rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white',
              (sending || draft.trim() === '') && 'opacity-50',
            )}
            disabled={sending || draft.trim() === ''}
            onClick={() => void send()}
          >
            {sending ? '送信中…' : '送信'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageRow = ({ roomId, message }: { roomId: string; message: ChatMessageView }) => {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'rounded-lg px-4 py-3',
        isUser ? 'bg-accent-soft' : 'bg-surface-muted',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ink-muted">
          #{message.sequence} {message.role}
        </span>
        <VerificationBadge roomId={roomId} messageId={message.id} />
      </div>
      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
      {message.creditsCharged > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          {message.inputTokens} in / {message.outputTokens} out ・ {message.creditsCharged}{' '}
          クレジット
        </p>
      )}
    </div>
  );
};
