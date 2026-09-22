import { useCallback, useEffect, useState } from 'react';
import { parseEther, type Address } from 'viem';
import { api, unwrap } from '@/lib/api';
import { useWallet } from '@/features/wallet/useWallet';

type CreditInfo = {
  balance: string;
  chainId: number;
  chatCreditAddress: string;
  weiPerCredit: string;
  confirmations: number;
};

/**
 * クレジットの残高と入金。
 *
 * 入金は「ウォレットから ChatCredit へ送金 → backend がイベントを取り込む」の 2 段。
 * 送金が通っても確認ブロックぶん待つので、残高への反映には間がある。
 */
export const CreditPanel = ({
  balance,
  onBalanceChanged,
}: {
  balance: string;
  onBalanceChanged: (balance: string) => void;
}) => {
  const wallet = useWallet();
  const [info, setInfo] = useState<CreditInfo | null>(null);
  const [amount, setAmount] = useState('0.1');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const data = unwrap(await api.GET('/api/me/credits', {})) as CreditInfo;
    setInfo(data);
    onBalanceChanged(data.balance);
  }, [onBalanceChanged]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント時のデータ取得。setState は await のあとで走る
    void reload();
  }, [reload]);

  const deposit = async () => {
    if (info == null || info.chatCreditAddress === '') return;

    setBusy(true);
    setStatus(null);
    try {
      if (wallet.chainId !== info.chainId) {
        const switched = await wallet.switchChain(info.chainId);
        if (!switched) {
          setStatus(`チェーンを ${info.chainId} に切り替える必要がある`);
          return;
        }
      }

      const txHash = await wallet.sendDeposit({
        to: info.chatCreditAddress as Address,
        valueWei: parseEther(amount),
      });
      if (txHash == null) {
        setStatus(wallet.error ?? '送金できなかった');
        return;
      }

      setStatus(
        `送金した: ${txHash.slice(0, 14)}… ${info.confirmations} ブロック確定後に「取り込む」を押す`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = unwrap(await api.POST('/api/me/credits/sync', {})) as {
        enabled: boolean;
        recordedDeposits: number;
        balance: string;
      };
      onBalanceChanged(result.balance);
      setStatus(
        result.enabled
          ? `取り込み ${result.recordedDeposits} 件`
          : '入金の取り込みが無効（コントラクトのアドレスが未設定）',
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2 border-t border-border-subtle px-4 py-4 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-muted">クレジット残高</span>
        <span className="font-mono text-base">{Number(balance).toLocaleString()}</span>
      </div>

      {info != null && info.chatCreditAddress === '' ? (
        <p className="text-xs text-ink-muted">
          入金コントラクトが未設定。contracts をデプロイして backend の
          CHAIN_CHAT_CREDIT_ADDRESS を設定する。
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              className="w-24 rounded-md border border-border-subtle bg-surface px-2 py-1 text-sm"
              value={amount}
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
              aria-label="入金額"
            />
            <button
              type="button"
              className="flex-1 rounded-md bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              disabled={busy || wallet.address == null}
              onClick={() => void deposit()}
            >
              入金する
            </button>
          </div>
          <button
            type="button"
            className="w-full rounded-md border border-border-subtle px-3 py-1 text-xs disabled:opacity-50"
            disabled={busy}
            onClick={() => void sync()}
          >
            チェーンから取り込む
          </button>
        </>
      )}

      {status != null && <p className="text-xs break-all text-ink-muted">{status}</p>}
    </section>
  );
};
