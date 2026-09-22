import { hardhat, polygon, polygonAmoy } from 'viem/chains';
import type { Chain } from 'viem';
import { safeParseBigInt, safeParseInt } from '../../libs/parse';
import { validate } from '../../libs/validate';

const CHAIN_ID = safeParseInt(process.env.CHAIN_ID, 31337);

const knownChains: Record<number, Chain> = {
  [polygon.id]: polygon,
  [polygonAmoy.id]: polygonAmoy,
  [hardhat.id]: hardhat,
};

/** 既知でないチェーン ID でも RPC さえあれば動くようにしておく。 */
const resolveChain = (chainId: number, rpcUrl: string): Chain => {
  const known = knownChains[chainId];
  if (known != null) {
    return { ...known, rpcUrls: { default: { http: [rpcUrl] } } };
  }
  return {
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };
};

const rpcUrl = validate(process.env.CHAIN_RPC_URL, 'CHAIN_RPC_URL');

export const chainConfig = {
  chainId: CHAIN_ID,
  chain: resolveChain(CHAIN_ID, rpcUrl),
  rpcUrl,
  chatCreditAddress: (process.env.CHAIN_CHAT_CREDIT_ADDRESS ?? '').toLowerCase(),
  chatLogAnchorAddress: (process.env.CHAIN_CHAT_LOG_ANCHOR_ADDRESS ?? '').toLowerCase(),
  anchorerPrivateKey: process.env.CHAIN_ANCHORER_PRIVATE_KEY ?? '',
  weiPerCredit: safeParseBigInt(process.env.CHAIN_WEI_PER_CREDIT, 100_000_000_000_000n),
  confirmations: safeParseInt(process.env.CHAIN_CONFIRMATIONS, 5),
  depositFromBlock: safeParseBigInt(process.env.CHAIN_DEPOSIT_FROM_BLOCK, 0n),
} as const;

/** 入金の取り込みができる状態か（コントラクトのアドレスが設定済みか）。 */
export const isDepositSyncEnabled = (): boolean => chainConfig.chatCreditAddress !== '';

/** アンカーが打てる状態か。読み取りだけなら鍵は要らない。 */
export const isAnchoringEnabled = (): boolean =>
  chainConfig.chatLogAnchorAddress !== '' && chainConfig.anchorerPrivateKey !== '';
