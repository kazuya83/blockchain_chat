import { Prisma } from '../generated/prisma/client.js';
import type { WalletAddress } from '../domains/accounts';
import {
  toCreditDeposit,
  toCreditLedgerEntry,
  type CreditDeposit,
  type CreditLedgerEntry,
} from '../domains/credits';
import { newUlid, type Ulid } from '../domains/ids';
import { getPrisma, type Db } from './_client';

export const listLedgerByAccount = async (
  params: { accountId: Ulid; limit: number },
  db: Db = getPrisma(),
): Promise<CreditLedgerEntry[]> => {
  const rows = await db.credit_ledger.findMany({
    where: { account_id: params.accountId },
    orderBy: { created_at: 'desc' },
    take: params.limit,
  });
  return rows.map(toCreditLedgerEntry);
};

export const listDepositsByAccount = async (
  params: { accountId: Ulid; limit: number },
  db: Db = getPrisma(),
): Promise<CreditDeposit[]> => {
  const rows = await db.credit_deposits.findMany({
    where: { account_id: params.accountId },
    orderBy: { block_number: 'desc' },
    take: params.limit,
  });
  return rows.map(toCreditDeposit);
};

/**
 * クレジットを消費する。**残高が足りる行だけ**を条件付き UPDATE で減らし、
 * 更新できた場合にのみ台帳を書く。更新 0 件なら残高不足（null を返す）。
 * 事前の残高チェックとこの UPDATE の間に他のリクエストが入っても二重に使えない。
 */
export const consumeCredits = async (
  params: {
    accountId: Ulid;
    amount: number;
    referenceType: string;
    referenceId: Ulid;
  },
  db: Db = getPrisma(),
): Promise<CreditLedgerEntry | null> => {
  const amount = BigInt(params.amount);

  const updated = await db.accounts.updateMany({
    where: { id: params.accountId, credit_balance: { gte: amount } },
    data: { credit_balance: { decrement: amount } },
  });
  if (updated.count !== 1) return null;

  const account = await db.accounts.findUniqueOrThrow({ where: { id: params.accountId } });

  const row = await db.credit_ledger.create({
    data: {
      id: newUlid(),
      account_id: params.accountId,
      kind: 'consume',
      amount: -amount,
      balance_after: account.credit_balance,
      reference_type: params.referenceType,
      reference_id: params.referenceId,
    },
  });
  return toCreditLedgerEntry(row);
};

/** 見積もりと実績の差を戻す。差が 0 なら何もしない。 */
export const refundCredits = async (
  params: {
    accountId: Ulid;
    amount: number;
    referenceType: string;
    referenceId: Ulid;
  },
  db: Db = getPrisma(),
): Promise<void> => {
  if (params.amount <= 0) return;
  const amount = BigInt(params.amount);

  const account = await db.accounts.update({
    where: { id: params.accountId },
    data: { credit_balance: { increment: amount } },
  });

  await db.credit_ledger.create({
    data: {
      id: newUlid(),
      account_id: params.accountId,
      kind: 'adjust',
      amount,
      balance_after: account.credit_balance,
      reference_type: params.referenceType,
      reference_id: params.referenceId,
    },
  });
};

export type DepositRecord = {
  walletAddress: WalletAddress;
  chainId: number;
  contractAddress: string;
  depositId: bigint;
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  amountWei: bigint;
  creditsGranted: bigint;
};

/**
 * チェーンの Deposited を 1 件取り込む。
 * (chain_id, contract_address, deposit_id) の unique 制約が冪等性の担保で、
 * 既に取り込み済みなら false を返して残高に触らない。
 */
export const recordDeposit = async (
  params: { accountId: Ulid; deposit: DepositRecord },
  db: Db = getPrisma(),
): Promise<boolean> => {
  const { deposit } = params;
  const depositRowId = newUlid();

  try {
    await db.credit_deposits.create({
      data: {
        id: depositRowId,
        account_id: params.accountId,
        chain_id: deposit.chainId,
        contract_address: deposit.contractAddress,
        deposit_id: deposit.depositId,
        tx_hash: deposit.txHash,
        log_index: deposit.logIndex,
        block_number: deposit.blockNumber,
        amount_wei: new Prisma.Decimal(deposit.amountWei.toString()),
        credits_granted: deposit.creditsGranted,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return false; // 取り込み済み
    }
    throw error;
  }

  const account = await db.accounts.update({
    where: { id: params.accountId },
    data: { credit_balance: { increment: deposit.creditsGranted } },
  });

  await db.credit_ledger.create({
    data: {
      id: newUlid(),
      account_id: params.accountId,
      kind: 'deposit',
      amount: deposit.creditsGranted,
      balance_after: account.credit_balance,
      reference_type: 'credit_deposit',
      reference_id: depositRowId,
    },
  });

  return true;
};
