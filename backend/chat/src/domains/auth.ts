import z from 'zod';
import { verifyMessage } from 'viem';
import { toChecksumAddress, type WalletAddress } from './accounts';

/** nonce の有効期限。署名を求めてから戻ってくるまでの猶予。 */
export const NONCE_TTL_MINUTES = 10;

export const ZNonce = z.string().regex(/^[0-9a-f]{32}$/, 'nonce ではない');

/**
 * ウォレットに署名させる文面。
 * EIP-4361（Sign-In with Ethereum）に倣い、**何に署名しているのかが人間に読める**ようにする。
 * 文面を変えると既存の nonce の署名が通らなくなるだけなので、互換は気にしなくてよい。
 */
export const buildSignInMessage = (params: {
  domain: string;
  walletAddress: WalletAddress;
  nonce: string;
  issuedAt: Date;
}): string =>
  [
    `${params.domain} にサインインします。`,
    '',
    `アドレス: ${toChecksumAddress(params.walletAddress)}`,
    `Nonce: ${params.nonce}`,
    `発行時刻: ${params.issuedAt.toISOString()}`,
    '',
    'この署名でトランザクションは発生せず、ガスもかかりません。',
  ].join('\n');

/** 署名が本人のものかを確かめる。 */
export const verifySignInSignature = async (params: {
  message: string;
  signature: `0x${string}`;
  walletAddress: WalletAddress;
}): Promise<boolean> =>
  verifyMessage({
    address: params.walletAddress,
    message: params.message,
    signature: params.signature,
  });

export const isNonceUsable = (nonce: { expiresAt: Date; consumedAt: Date | null }, now: Date) =>
  nonce.consumedAt == null && nonce.expiresAt.getTime() > now.getTime();
