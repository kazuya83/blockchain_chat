import type { WalletAddress } from '../domains/accounts';
import { newUlid, toUlid, type Ulid } from '../domains/ids';
import { randomHex, sha256Hex } from '../libs/hash';
import { getPrisma, type Db } from './_client';

export type AuthNonce = {
  id: Ulid;
  walletAddress: WalletAddress;
  nonce: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export const createAuthNonce = async (
  params: { walletAddress: WalletAddress; ttlMinutes: number },
  db: Db = getPrisma(),
): Promise<AuthNonce> => {
  const nonce = randomHex(16);
  const expiresAt = new Date(Date.now() + params.ttlMinutes * 60_000);

  const row = await db.auth_nonces.create({
    data: {
      id: newUlid(),
      wallet_address: params.walletAddress,
      nonce,
      expires_at: expiresAt,
    },
  });

  return {
    id: toUlid(row.id),
    walletAddress: row.wallet_address as WalletAddress,
    nonce: row.nonce,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
};

export const findAuthNonce = async (
  nonce: string,
  db: Db = getPrisma(),
): Promise<AuthNonce | null> => {
  const row = await db.auth_nonces.findUnique({ where: { nonce } });
  if (row == null) return null;
  return {
    id: toUlid(row.id),
    walletAddress: row.wallet_address as WalletAddress,
    nonce: row.nonce,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
};

/**
 * nonce を使用済みにする。**未使用のものだけ**を更新し、更新できたかを返す。
 * 同じ署名が同時に 2 回届いても、セッションを作れるのは 1 回だけになる。
 */
export const consumeAuthNonce = async (
  nonce: string,
  db: Db = getPrisma(),
): Promise<boolean> => {
  const result = await db.auth_nonces.updateMany({
    where: { nonce, consumed_at: null, expires_at: { gt: new Date() } },
    data: { consumed_at: new Date() },
  });
  return result.count === 1;
};

export type IssuedSession = { token: string; expiresAt: Date };

export const createSession = async (
  params: { accountId: Ulid; ttlHours: number },
  db: Db = getPrisma(),
): Promise<IssuedSession> => {
  const token = randomHex(32);
  const expiresAt = new Date(Date.now() + params.ttlHours * 3_600_000);

  await db.sessions.create({
    data: {
      id: newUlid(),
      account_id: params.accountId,
      token_hash: sha256Hex(token),
      expires_at: expiresAt,
    },
  });

  return { token, expiresAt };
};

/** トークンから有効なセッションの account_id を引く。期限切れ・失効は null。 */
export const findAccountIdBySessionToken = async (
  token: string,
  db: Db = getPrisma(),
): Promise<Ulid | null> => {
  const row = await db.sessions.findUnique({ where: { token_hash: sha256Hex(token) } });
  if (row == null) return null;
  if (row.revoked_at != null) return null;
  if (row.expires_at.getTime() <= Date.now()) return null;
  return toUlid(row.account_id);
};

export const revokeSession = async (token: string, db: Db = getPrisma()): Promise<void> => {
  await db.sessions.updateMany({
    where: { token_hash: sha256Hex(token), revoked_at: null },
    data: { revoked_at: new Date() },
  });
};
