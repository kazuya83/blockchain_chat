import { toAccount, type Account, type WalletAddress } from '../domains/accounts';
import { newUlid, type Ulid } from '../domains/ids';
import { getPrisma, type Db } from './_client';

export const findAccountById = async (
  id: Ulid,
  db: Db = getPrisma(),
): Promise<Account | null> => {
  const row = await db.accounts.findUnique({ where: { id } });
  return row == null ? null : toAccount(row);
};

export const findAccountByWalletAddress = async (
  walletAddress: WalletAddress,
  db: Db = getPrisma(),
): Promise<Account | null> => {
  const row = await db.accounts.findUnique({ where: { wallet_address: walletAddress } });
  return row == null ? null : toAccount(row);
};

/** 初回サインインのアカウント作成。並行サインインは unique 制約で 1 つに収束させる。 */
export const createAccount = async (
  walletAddress: WalletAddress,
  db: Db = getPrisma(),
): Promise<Account> => {
  const row = await db.accounts.create({
    data: { id: newUlid(), wallet_address: walletAddress },
  });
  return toAccount(row);
};

export const updateDisplayName = async (
  id: Ulid,
  displayName: string | null,
  db: Db = getPrisma(),
): Promise<Account> => {
  const row = await db.accounts.update({
    where: { id },
    data: { display_name: displayName },
  });
  return toAccount(row);
};
