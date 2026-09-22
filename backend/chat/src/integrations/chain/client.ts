import { createPublicClient, createWalletClient, http, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex, PublicClient, WalletClient } from 'viem';
import { chatLogAnchorAbi } from './abi/ChatLogAnchor';
import { chainConfig, isAnchoringEnabled } from './config';

let publicClient: PublicClient | null = null;

export const getPublicClient = (): PublicClient => {
  publicClient ??= createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });
  return publicClient;
};

let walletClient: WalletClient | null = null;

/** anchor TX を出すためのクライアント。鍵が無い環境では null。 */
export const getAnchorerWalletClient = (): WalletClient | null => {
  if (!isAnchoringEnabled()) return null;
  walletClient ??= createWalletClient({
    account: privateKeyToAccount(chainConfig.anchorerPrivateKey as Hex),
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });
  return walletClient;
};

const depositedEvent = parseAbiItem(
  'event Deposited(uint256 indexed depositId, address indexed user, uint256 amount, address payer)',
);

export type DepositedLog = {
  depositId: bigint;
  user: Address;
  amount: bigint;
  txHash: Hex;
  logIndex: number;
  blockNumber: bigint;
};

/** ChatCredit の Deposited を範囲指定で拾う。 */
export const fetchDepositedLogs = async (params: {
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<DepositedLog[]> => {
  const logs = await getPublicClient().getLogs({
    address: chainConfig.chatCreditAddress as Address,
    event: depositedEvent,
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
  });

  return logs.flatMap((log) => {
    // pending ログ（block が未確定）は取り込まない
    if (log.blockNumber == null || log.transactionHash == null || log.logIndex == null) {
      return [];
    }
    const { depositId, user, amount } = log.args;
    if (depositId == null || user == null || amount == null) return [];

    return [
      {
        depositId,
        user,
        amount,
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
      },
    ];
  });
};

export const getLatestBlockNumber = async (): Promise<bigint> =>
  getPublicClient().getBlockNumber();

/** ChatLogAnchor へ root を書く。TX ハッシュだけ返し、確定待ちは呼び出し側。 */
export const sendAnchorTransaction = async (params: {
  roomKey: Hex;
  merkleRoot: Hex;
  messageCount: number;
}): Promise<Hex> => {
  const wallet = getAnchorerWalletClient();
  if (wallet == null) {
    throw new Error('anchoring is disabled: CHAIN_ANCHORER_PRIVATE_KEY が無い');
  }
  const account = wallet.account;
  if (account == null) {
    throw new Error('anchoring is disabled: wallet に account が無い');
  }

  return wallet.writeContract({
    address: chainConfig.chatLogAnchorAddress as Address,
    abi: chatLogAnchorAbi,
    functionName: 'anchor',
    args: [params.roomKey, params.merkleRoot, BigInt(params.messageCount)],
    account,
    chain: chainConfig.chain,
  });
};

export const waitForAnchorReceipt = async (txHash: Hex) =>
  getPublicClient().waitForTransactionReceipt({
    hash: txHash,
    confirmations: chainConfig.confirmations,
  });

/** チェーン上に root が記録されているか。真正性確認の最後の 1 つ。 */
export const readIsAnchored = async (params: {
  roomKey: Hex;
  merkleRoot: Hex;
}): Promise<boolean> =>
  getPublicClient().readContract({
    address: chainConfig.chatLogAnchorAddress as Address,
    abi: chatLogAnchorAbi,
    functionName: 'isAnchored',
    args: [params.roomKey, params.merkleRoot],
  });
