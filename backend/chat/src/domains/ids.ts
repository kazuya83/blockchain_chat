import { ulid } from 'ulid';
import z from 'zod';

/** 主キーは ULID（Char(26)）。 */
export type Ulid = string & { readonly __brand: 'Ulid' };

export const ZUlid = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'ULID ではない')
  .transform((v) => v as Ulid);

export const newUlid = (): Ulid => ulid() as Ulid;

export const toUlid = (value: string): Ulid => ZUlid.parse(value);
