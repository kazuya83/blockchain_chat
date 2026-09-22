import { useCallback, useEffect, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { useWallet } from '@/features/wallet/useWallet';

export type SessionAccount = {
  id: string;
  walletAddress: string;
  walletAddressChecksum: string;
  displayName: string | null;
  creditBalance: string;
};

/**
 * ウォレット署名によるサインイン。
 *
 * 1. backend が nonce と署名文面を発行する
 * 2. ウォレットに署名させる
 * 3. backend が署名を検証してセッション Cookie を張る
 */
export const useSession = () => {
  const wallet = useWallet();
  const [account, setAccount] = useState<SessionAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await api.GET('/api/me', {});
    if (result.error != null || result.data === undefined) {
      setAccount(null);
      return null;
    }
    setAccount(result.data as SessionAccount);
    return result.data as SessionAccount;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント時のデータ取得。setState は await のあとで走る
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);
    try {
      const address = wallet.address ?? (await wallet.connect());
      if (address == null) return;

      const challenge = unwrap(
        await api.POST('/api/auth/challenge', {
          body: { walletAddress: address },
        }),
      ) as { nonce: string; message: string };

      const signature = await wallet.signMessage(challenge.message);
      if (signature == null) return;

      const session = unwrap(
        await api.POST('/api/auth/verify', {
          body: { walletAddress: address, nonce: challenge.nonce, signature },
        }),
      ) as { account: SessionAccount };

      setAccount(session.account);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSigningIn(false);
    }
  }, [wallet]);

  const signOut = useCallback(async () => {
    await api.POST('/api/auth/sign-out', {});
    setAccount(null);
  }, []);

  return { wallet, account, loading, signingIn, error, signIn, signOut, refresh };
};
