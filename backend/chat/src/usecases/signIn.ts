import { toWalletAddress, type Account, type WalletAddress } from '../domains/accounts';
import {
  buildSignInMessage,
  isNonceUsable,
  NONCE_TTL_MINUTES,
  verifySignInSignature,
} from '../domains/auth';
import { createAccount, findAccountByWalletAddress } from '../repositories/accounts';
import {
  consumeAuthNonce,
  createAuthNonce,
  createSession,
  findAuthNonce,
} from '../repositories/auth';
import { InvalidSignatureError, NonceUnusableError } from './errors';

const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? '720');

/** 署名を求めるチャレンジを発行する。ここではアカウントを作らない。 */
export const startSignIn = async (params: {
  walletAddress: string;
  domain: string;
}): Promise<{ nonce: string; message: string; expiresAt: Date }> => {
  const walletAddress = toWalletAddress(params.walletAddress);
  const issued = await createAuthNonce({ walletAddress, ttlMinutes: NONCE_TTL_MINUTES });

  return {
    nonce: issued.nonce,
    message: buildSignInMessage({
      domain: params.domain,
      walletAddress,
      nonce: issued.nonce,
      issuedAt: issued.expiresAt,
    }),
    expiresAt: issued.expiresAt,
  };
};

/**
 * 署名を検証してセッションを発行する。
 *
 * 検証の順序が要点で、**署名を確かめてから nonce を使用済みにする**。
 * 逆にすると、署名が間違っているだけで nonce を使い切ってしまう。
 */
export const completeSignIn = async (params: {
  walletAddress: string;
  nonce: string;
  signature: `0x${string}`;
  domain: string;
}): Promise<{ account: Account; token: string; expiresAt: Date }> => {
  const walletAddress = toWalletAddress(params.walletAddress);

  const stored = await findAuthNonce(params.nonce);
  if (stored == null || stored.walletAddress !== walletAddress) {
    throw new NonceUnusableError();
  }
  if (!isNonceUsable(stored, new Date())) {
    throw new NonceUnusableError();
  }

  const message = buildSignInMessage({
    domain: params.domain,
    walletAddress,
    nonce: stored.nonce,
    issuedAt: stored.expiresAt,
  });

  const valid = await verifySignInSignature({
    message,
    signature: params.signature,
    walletAddress,
  });
  if (!valid) throw new InvalidSignatureError();

  // 同じ署名が同時に届いてもセッションは 1 つだけ作る
  const consumed = await consumeAuthNonce(stored.nonce);
  if (!consumed) throw new NonceUnusableError();

  const account = await findOrCreateAccount(walletAddress);
  const session = await createSession({ accountId: account.id, ttlHours: sessionTtlHours });

  return { account, token: session.token, expiresAt: session.expiresAt };
};

const findOrCreateAccount = async (walletAddress: WalletAddress): Promise<Account> => {
  const existing = await findAccountByWalletAddress(walletAddress);
  if (existing != null) return existing;

  try {
    return await createAccount(walletAddress);
  } catch {
    // 同時サインインで先に作られた場合はそれを使う
    const created = await findAccountByWalletAddress(walletAddress);
    if (created == null) throw new Error('アカウントの作成に失敗した');
    return created;
  }
};
