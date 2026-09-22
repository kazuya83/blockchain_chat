import z from 'zod';
import type { credit_depositsModel, credit_ledgerModel } from '../generated/prisma/models.js';
import { toUlid, type Ulid } from './ids';

export const ZCreditLedgerKind = z.enum(['deposit', 'consume', 'adjust']);
export type CreditLedgerKind = z.infer<typeof ZCreditLedgerKind>;

export type CreditLedgerEntry = {
  id: Ulid;
  accountId: Ulid;
  kind: CreditLedgerKind;
  amount: bigint;
  balanceAfter: bigint;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
};

export const toCreditLedgerEntry = (row: credit_ledgerModel): CreditLedgerEntry => ({
  id: toUlid(row.id),
  accountId: toUlid(row.account_id),
  kind: ZCreditLedgerKind.parse(row.kind),
  amount: row.amount,
  balanceAfter: row.balance_after,
  referenceType: row.reference_type,
  referenceId: row.reference_id,
  createdAt: row.created_at,
});

export type CreditDeposit = {
  id: Ulid;
  accountId: Ulid;
  chainId: number;
  contractAddress: string;
  depositId: bigint;
  txHash: string;
  blockNumber: bigint;
  amountWei: bigint;
  creditsGranted: bigint;
  createdAt: Date;
};

export const toCreditDeposit = (row: credit_depositsModel): CreditDeposit => ({
  id: toUlid(row.id),
  accountId: toUlid(row.account_id),
  chainId: row.chain_id,
  contractAddress: row.contract_address,
  depositId: row.deposit_id,
  txHash: row.tx_hash,
  blockNumber: row.block_number,
  amountWei: BigInt(row.amount_wei.toFixed(0)),
  creditsGranted: row.credits_granted,
  createdAt: row.created_at,
});

/**
 * 入金額（wei）をクレジットへ換算する。端数は切り捨て。
 * レートは env（CHAIN_WEI_PER_CREDIT）が持つ。トークン価格が動くので、
 * 決め打ちにせず環境ごとに設定する。
 */
export const weiToCredits = (amountWei: bigint, weiPerCredit: bigint): bigint => {
  if (weiPerCredit <= 0n) {
    throw new Error('weiToCredits: weiPerCredit must be positive');
  }
  return amountWei / weiPerCredit;
};
