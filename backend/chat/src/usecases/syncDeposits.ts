import { toWalletAddress } from '../domains/accounts';
import { weiToCredits } from '../domains/credits';
import { chainConfig, isDepositSyncEnabled } from '../integrations/chain/config';
import { fetchDepositedLogs, getLatestBlockNumber } from '../integrations/chain/client';
import { createAccount, findAccountByWalletAddress } from '../repositories/accounts';
import { recordDeposit } from '../repositories/credits';
import { advanceChainSyncState, getChainSyncState } from '../repositories/chainSync';

const SYNC_ID = 'chat_credit_deposits';

/** 1 回の getLogs で見る最大ブロック幅。RPC 側の上限に当たらない程度に抑える。 */
const MAX_BLOCK_RANGE = 2_000n;

export type SyncDepositsResult = {
  enabled: boolean;
  fromBlock: bigint;
  toBlock: bigint;
  scannedLogs: number;
  recordedDeposits: number;
};

/**
 * ChatCredit の Deposited を取り込み、クレジットを付与する。
 *
 * - 確認ブロック数（CHAIN_CONFIRMATIONS）ぶん手前までしか読まない。再編成で消えうる
 *   ブロックの入金を先に付与すると、取り消せない。
 * - 取り込み済みかは (chain_id, contract_address, deposit_id) の unique 制約が判定する。
 *   同じ範囲を二度流しても残高は二重に増えない。
 * - 未知のアドレスからの入金はアカウントを作って受ける。入金者がまだサインインしていない
 *   ことはふつうにある。
 */
export const syncDeposits = async (): Promise<SyncDepositsResult> => {
  if (!isDepositSyncEnabled()) {
    return {
      enabled: false,
      fromBlock: 0n,
      toBlock: 0n,
      scannedLogs: 0,
      recordedDeposits: 0,
    };
  }

  const state = await getChainSyncState({
    id: SYNC_ID,
    chainId: chainConfig.chainId,
    contractAddress: chainConfig.chatCreditAddress,
    fromBlock: chainConfig.depositFromBlock,
  });

  const latest = await getLatestBlockNumber();
  const safeHead = latest - BigInt(chainConfig.confirmations);
  const fromBlock = state.lastSyncedBlock + 1n;

  if (safeHead < fromBlock) {
    return {
      enabled: true,
      fromBlock,
      toBlock: state.lastSyncedBlock,
      scannedLogs: 0,
      recordedDeposits: 0,
    };
  }

  const toBlock = safeHead - fromBlock > MAX_BLOCK_RANGE ? fromBlock + MAX_BLOCK_RANGE : safeHead;

  const logs = await fetchDepositedLogs({ fromBlock, toBlock });

  let recorded = 0;
  for (const log of logs) {
    const walletAddress = toWalletAddress(log.user);
    const account =
      (await findAccountByWalletAddress(walletAddress)) ?? (await createAccount(walletAddress));

    const inserted = await recordDeposit({
      accountId: account.id,
      deposit: {
        walletAddress,
        chainId: chainConfig.chainId,
        contractAddress: chainConfig.chatCreditAddress,
        depositId: log.depositId,
        txHash: log.txHash,
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
        amountWei: log.amount,
        creditsGranted: weiToCredits(log.amount, chainConfig.weiPerCredit),
      },
    });
    if (inserted) recorded += 1;
  }

  await advanceChainSyncState({ id: SYNC_ID, lastSyncedBlock: toBlock });

  return {
    enabled: true,
    fromBlock,
    toBlock,
    scannedLogs: logs.length,
    recordedDeposits: recorded,
  };
};
