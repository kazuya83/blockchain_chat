import { useCallback, useEffect, useState } from 'react';
import {
  createWalletClient,
  custom,
  numberToHex,
  toFunctionSelector,
  type Address,
  type EIP1193Provider,
  type Hex,
} from 'viem';

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export type WalletState = {
  available: boolean;
  address: Address | null;
  chainId: number | null;
};

/**
 * EIP-1193 のプロバイダ（MetaMask 等）を直接使う薄いフック。
 * 接続・署名・送金しか要らないので、ウォレット接続ライブラリは入れていない。
 */
export const useWallet = () => {
  const [state, setState] = useState<WalletState>({
    available: false,
    address: null,
    chainId: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = window.ethereum;
    // 初期 state が未接続なので、ここで setState する必要はない
    if (provider == null) return;

    let cancelled = false;

    const sync = async () => {
      const accounts = (await provider.request({ method: 'eth_accounts' })) as Address[];
      const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as Hex;
      if (cancelled) return;
      setState({
        available: true,
        address: accounts[0] ?? null,
        chainId: Number.parseInt(chainIdHex, 16),
      });
    };

    void sync();

    const onAccountsChanged = (accounts: unknown) => {
      const list = accounts as Address[];
      setState((prev) => ({ ...prev, address: list[0] ?? null }));
    };
    const onChainChanged = (chainId: unknown) => {
      setState((prev) => ({ ...prev, chainId: Number.parseInt(chainId as Hex, 16) }));
    };

    provider.on('accountsChanged', onAccountsChanged);
    provider.on('chainChanged', onChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener('accountsChanged', onAccountsChanged);
      provider.removeListener('chainChanged', onChainChanged);
    };
  }, []);

  const connect = useCallback(async (): Promise<Address | null> => {
    const provider = window.ethereum;
    if (provider == null) {
      setError('ウォレット拡張が見つからない');
      return null;
    }

    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as Address[];
      const address = accounts[0] ?? null;
      setState((prev) => ({ ...prev, available: true, address }));
      setError(null);
      return address;
    } catch (e) {
      setError(messageOf(e));
      return null;
    }
  }, []);

  const signMessage = useCallback(
    async (message: string): Promise<Hex | null> => {
      const provider = window.ethereum;
      if (provider == null || state.address == null) return null;

      try {
        const client = createWalletClient({ transport: custom(provider) });
        return await client.signMessage({ account: state.address, message });
      } catch (e) {
        setError(messageOf(e));
        return null;
      }
    },
    [state.address],
  );

  /** ChatCredit への入金。呼び出しデータは deposit() のセレクタだけ。 */
  const sendDeposit = useCallback(
    async (params: { to: Address; valueWei: bigint }): Promise<Hex | null> => {
      const provider = window.ethereum;
      if (provider == null || state.address == null) return null;

      try {
        const client = createWalletClient({ transport: custom(provider) });
        return await client.sendTransaction({
          account: state.address,
          to: params.to,
          value: params.valueWei,
          data: DEPOSIT_SELECTOR,
          chain: null,
        });
      } catch (e) {
        setError(messageOf(e));
        return null;
      }
    },
    [state.address],
  );

  /** 接続先チェーンを切り替える。追加が必要なチェーンまでは面倒を見ない。 */
  const switchChain = useCallback(async (chainId: number): Promise<boolean> => {
    const provider = window.ethereum;
    if (provider == null) return false;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: numberToHex(chainId) }],
      });
      return true;
    } catch (e) {
      setError(messageOf(e));
      return false;
    }
  }, []);

  return { ...state, error, connect, signMessage, sendDeposit, switchChain };
};

/** ChatCredit.deposit() のセレクタ。引数が無いので呼び出しデータはこれだけ。 */
const DEPOSIT_SELECTOR = toFunctionSelector('deposit()');

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
