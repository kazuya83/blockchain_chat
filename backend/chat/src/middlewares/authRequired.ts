import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { Account } from '../domains/accounts';
import { findAccountById } from '../repositories/accounts';
import { findAccountIdBySessionToken } from '../repositories/auth';
import { CONTEXT_KEY_SESSION } from './_context';

export const COOKIE_NAME_SESSION_TOKEN = '__SESSION';

export type ContextSession = {
  account: Account;
  token: string;
};

export type AuthRequiredContext = {
  [CONTEXT_KEY_SESSION]: ContextSession;
};

const ERROR_PARAMS_AUTHENTICATE_FAILED = [{ message: 'authenticate failed' }, 403] as const;

export const authRequiredMiddleware = createMiddleware<{
  Variables: AuthRequiredContext;
}>(async (c, next) => {
  // Cookie が使えないクライアント（CLI など）向けに Bearer も受ける。
  const cookie = getCookie(c, COOKIE_NAME_SESSION_TOKEN);
  const authorization = c.req.header('Authorization');
  const token =
    cookie != null && cookie !== ''
      ? cookie
      : authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : null;

  if (token == null) {
    return c.json(...ERROR_PARAMS_AUTHENTICATE_FAILED);
  }

  const accountId = await findAccountIdBySessionToken(token);
  if (accountId == null) {
    return c.json(...ERROR_PARAMS_AUTHENTICATE_FAILED);
  }

  const account = await findAccountById(accountId);
  if (account == null) {
    console.error(`account not found, accountId: ${accountId}`);
    return c.json(...ERROR_PARAMS_AUTHENTICATE_FAILED);
  }

  c.set(CONTEXT_KEY_SESSION, { account, token } satisfies ContextSession);

  await next();
});
