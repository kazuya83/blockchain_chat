import { useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { cn } from '@/lib/cn';

type Verification = {
  verified: boolean;
  contentHashMatches: boolean;
  proofMatches: boolean;
  anchoredOnChain: boolean;
  reason: string | null;
  leaf: string;
  proof: string[];
  anchor: { merkleRoot: string; txHash: string | null; messageCount: number } | null;
};

/**
 * メッセージ 1 件の真正性確認。
 *
 * 3 つのチェックを畳まずに並べて出す。「検証できない」と「改ざんされている」は
 * まったく違う状態なので、どこで落ちたかが見えないと判断できない。
 */
export const VerificationBadge = ({
  roomId,
  messageId,
}: {
  roomId: string;
  messageId: string;
}) => {
  const [result, setResult] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = unwrap(
        await api.GET('/api/rooms/{roomId}/messages/{messageId}/verification', {
          params: { path: { roomId, messageId } },
        }),
      ) as Verification;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (result == null) {
    return (
      <button
        type="button"
        className="text-xs text-ink-muted underline underline-offset-2 disabled:opacity-50"
        disabled={loading}
        onClick={() => void verify()}
      >
        {loading ? '確認中…' : error ?? '真正性を確認'}
      </button>
    );
  }

  return (
    <details className="text-xs">
      <summary
        className={cn(
          'cursor-pointer font-medium',
          result.verified ? 'text-verified' : 'text-warn',
        )}
      >
        {result.verified ? '検証済み' : '未検証'}
      </summary>
      <ul className="mt-2 space-y-1 text-ink-muted">
        <Check ok={result.contentHashMatches} label="本文ハッシュが保存値と一致" />
        <Check ok={result.proofMatches} label="Merkle proof が root と一致" />
        <Check ok={result.anchoredOnChain} label="root がチェーンに記録済み" />
        {result.reason != null && <li>{result.reason}</li>}
        {result.anchor != null && (
          <li className="break-all">
            root: {result.anchor.merkleRoot}
            {result.anchor.txHash != null && (
              <>
                <br />
                tx: {result.anchor.txHash}
              </>
            )}
          </li>
        )}
      </ul>
    </details>
  );
};

const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <li className={ok ? 'text-verified' : 'text-warn'}>
    {ok ? '✓' : '×'} {label}
  </li>
);
