import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { describeRoute, resolver, validator } from 'hono-openapi';
import z from 'zod';
import { ZWalletAddress, toChecksumAddress } from '../domains/accounts';
import { ZNonce } from '../domains/auth';
import { revokeSession } from '../repositories/auth';
import {
  authRequiredMiddleware,
  COOKIE_NAME_SESSION_TOKEN,
  type AuthRequiredContext,
} from '../middlewares/authRequired';
import { CONTEXT_KEY_SESSION } from '../middlewares/_context';
import { completeSignIn, startSignIn } from '../usecases/signIn';
import { defineErrorResponse, defineSuccess, toHttpError } from './utils';

const signInDomain = process.env.SIGN_IN_DOMAIN ?? 'blockchain-chat';
const isSecureCookie = process.env.NODE_ENV === 'production';

const challengeRequestSchema = z.object({
  walletAddress: ZWalletAddress,
});

const challengeResponseSchema = z.object({
  nonce: z.string(),
  message: z.string(),
  expiresAt: z.string(),
});

const verifyRequestSchema = z.object({
  walletAddress: ZWalletAddress,
  nonce: ZNonce,
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, '署名の形式ではない'),
});

const sessionResponseSchema = z.object({
  account: z.object({
    id: z.string(),
    walletAddress: z.string(),
    walletAddressChecksum: z.string(),
    displayName: z.string().nullable(),
    creditBalance: z.string(),
  }),
  token: z.string(),
  expiresAt: z.string(),
});

export const authRoute = new Hono<{ Variables: AuthRequiredContext }>()
  .post(
    '/challenge',
    describeRoute({
      description: 'ウォレットに署名させる文面と nonce を発行する。',
      responses: {
        200: defineSuccess(resolver(challengeResponseSchema)),
        400: defineErrorResponse(),
      },
    }),
    validator('json', challengeRequestSchema),
    async (c) => {
      const { walletAddress } = c.req.valid('json');
      const challenge = await startSignIn({ walletAddress, domain: signInDomain });

      return c.json(
        {
          nonce: challenge.nonce,
          message: challenge.message,
          expiresAt: challenge.expiresAt.toISOString(),
        },
        200,
      );
    },
  )
  .post(
    '/verify',
    describeRoute({
      description: '署名を検証してセッションを発行する。初回はアカウントも作る。',
      responses: {
        200: defineSuccess(resolver(sessionResponseSchema)),
        403: defineErrorResponse(),
      },
    }),
    validator('json', verifyRequestSchema),
    async (c) => {
      const body = c.req.valid('json');

      try {
        const result = await completeSignIn({
          walletAddress: body.walletAddress,
          nonce: body.nonce,
          signature: body.signature as `0x${string}`,
          domain: signInDomain,
        });

        setCookie(c, COOKIE_NAME_SESSION_TOKEN, result.token, {
          httpOnly: true,
          secure: isSecureCookie,
          sameSite: 'Lax',
          path: '/',
          expires: result.expiresAt,
        });

        return c.json(
          {
            account: {
              id: result.account.id,
              walletAddress: result.account.walletAddress,
              walletAddressChecksum: toChecksumAddress(result.account.walletAddress),
              displayName: result.account.displayName,
              creditBalance: result.account.creditBalance.toString(),
            },
            token: result.token,
            expiresAt: result.expiresAt.toISOString(),
          },
          200,
        );
      } catch (error) {
        const mapped = toHttpError(error);
        if (mapped == null) throw error;
        return c.json(mapped.body, mapped.status);
      }
    },
  )
  .post(
    '/sign-out',
    describeRoute({
      description: 'セッションを失効させる。',
      responses: { 204: { description: 'No Content' } },
    }),
    authRequiredMiddleware,
    async (c) => {
      const session = c.get(CONTEXT_KEY_SESSION);
      await revokeSession(session.token);
      deleteCookie(c, COOKIE_NAME_SESSION_TOKEN, { path: '/' });
      return c.body(null, 204);
    },
  );
