import { createHash, randomBytes } from 'node:crypto';
import { keccak256, toHex } from 'viem';
import type { Hex } from 'viem';

/** UTF-8 文字列の keccak256。チェーン側と同じハッシュ関数を使う。 */
export const keccakOfUtf8 = (value: string): Hex => keccak256(toHex(value));

/** セッショントークンの保存用ハッシュ。トークン自体は DB に置かない。 */
export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

export const randomHex = (byteLength: number): string => randomBytes(byteLength).toString('hex');
