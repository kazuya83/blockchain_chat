import { getAddress, isAddress } from 'viem';
import z from 'zod';
import type { accountsModel } from '../generated/prisma/models.js';
import { toUlid, type Ulid } from './ids';

/**
 * ウォレットアドレス。DB・API ともに**小文字**で持つ。
 * EIP-55 のチェックサム表記は表示のためのものなので、同一性の判定に混ぜない。
 */
export type WalletAddress = `0x${string}` & { readonly __brand: 'WalletAddress' };

export const ZWalletAddress = z
  .string()
  .refine((v) => isAddress(v, { strict: false }), 'ウォレットアドレスではない')
  .transform((v) => v.toLowerCase() as WalletAddress);

export const toWalletAddress = (value: string): WalletAddress => ZWalletAddress.parse(value);

/** 表示用のチェックサム付き表記。同一性の判定には使わない。 */
export const toChecksumAddress = (value: WalletAddress): string => getAddress(value);

export type Account = {
  id: Ulid;
  walletAddress: WalletAddress;
  displayName: string | null;
  creditBalance: bigint;
  createdAt: Date;
  updatedAt: Date;
};

export const toAccount = (row: accountsModel): Account => ({
  id: toUlid(row.id),
  walletAddress: toWalletAddress(row.wallet_address),
  displayName: row.display_name,
  creditBalance: row.credit_balance,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** 残高が足りているか。実際の引き落としは usecase の条件付き UPDATE が正。 */
export const hasEnoughCredits = (account: Account, required: bigint): boolean =>
  account.creditBalance >= required;
