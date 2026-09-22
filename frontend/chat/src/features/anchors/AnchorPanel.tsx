import { useCallback, useEffect, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { RoomView } from '@/features/chat/useRooms';

type AnchorView = {
  id: string;
  sequence: number;
  merkleRoot: string;
  messageCount: number;
  chainId: number;
  txHash: string | null;
  blockNumber: string | null;
  status: string;
  failureReason: string | null;
  confirmedAt: string | null;
};

/**
 * ルームのログをチェーンへ記録する操作と、その履歴。
 *
 * ボタンの出し分けは BE が返す canAnchor に従う。FE でルールを写経すると、
 * 条件を変えたときに片方だけ古くなる。
 */
export const AnchorPanel = ({
  room,
  onAnchored,
}: {
  room: RoomView;
  onAnchored: () => void;
}) => {
  const [anchors, setAnchors] = useState<AnchorView[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const list = unwrap(
      await api.GET('/api/rooms/{roomId}/anchors', {
        params: { path: { roomId: room.id } },
      }),
    ) as AnchorView[];
    setAnchors(list);
  }, [room.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント時のデータ取得。setState は await のあとで走る
    void reload();
  }, [reload]);

  const anchor = async () => {
    setRunning(true);
    setError(null);
    try {
      unwrap(
        await api.POST('/api/rooms/{roomId}/anchors', {
          params: { path: { roomId: room.id } },
        }),
      );
      await reload();
      onAnchored();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        className={cn(
          'rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium',
          (!room.canAnchor || running) && 'opacity-50',
        )}
        disabled={!room.canAnchor || running}
        onClick={() => void anchor()}
      >
        {running ? 'チェーンに記録中…' : 'ログをチェーンに記録'}
      </button>

      {error != null && <p className="mt-1 max-w-64 text-xs text-danger">{error}</p>}

      {anchors.length > 0 && (
        <details className="mt-1 text-xs text-ink-muted">
          <summary className="cursor-pointer">アンカー履歴 {anchors.length} 件</summary>
          <ul className="mt-1 space-y-1 text-left">
            {anchors.map((item) => (
              <li key={item.id} className="break-all">
                #{item.sequence} {item.status} ・ {item.messageCount} 件
                {item.txHash != null && <> ・ {item.txHash.slice(0, 12)}…</>}
                {item.failureReason != null && (
                  <span className="text-danger"> ・ {item.failureReason}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
