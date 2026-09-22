import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Scalar } from '@scalar/hono-api-reference';
import { describeRoute, openAPIRouteHandler, resolver } from 'hono-openapi';
import z from 'zod';
import { safeParseInt } from './libs/parse';
import { chainConfig, isAnchoringEnabled, isDepositSyncEnabled } from './integrations/chain/config';
import { authRoute } from './routes/auth';
import { meRoute } from './routes/me';
import { modelRoute } from './routes/models';
import { roomRoute } from './routes/rooms';
import { defineSuccess } from './routes/utils';

const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3100').split(',');

const api = new Hono()
  .basePath('/api')
  // API レスポンスは CDN にキャッシュさせない。認証済みのレスポンスが
  // 他のユーザーへ返るのを防ぐ。
  .use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  })
  .get('/health-check', (c) => c.text('OK', 200))
  .get(
    '/chain',
    describeRoute({
      description:
        'このバックエンドがどのチェーン・コントラクトを見ているか。FE の接続先確認に使う。',
      responses: {
        200: defineSuccess(
          resolver(
            z.object({
              chainId: z.number(),
              chatCreditAddress: z.string(),
              chatLogAnchorAddress: z.string(),
              weiPerCredit: z.string(),
              confirmations: z.number(),
              depositSyncEnabled: z.boolean(),
              anchoringEnabled: z.boolean(),
            }),
          ),
        ),
      },
    }),
    (c) =>
      c.json(
        {
          chainId: chainConfig.chainId,
          chatCreditAddress: chainConfig.chatCreditAddress,
          chatLogAnchorAddress: chainConfig.chatLogAnchorAddress,
          weiPerCredit: chainConfig.weiPerCredit.toString(),
          confirmations: chainConfig.confirmations,
          depositSyncEnabled: isDepositSyncEnabled(),
          anchoringEnabled: isAnchoringEnabled(),
        },
        200,
      ),
  )
  .route('/auth', authRoute)
  .route('/me', meRoute)
  .route('/models', modelRoute)
  .route('/rooms', roomRoute);

const app = new Hono()
  .use('*', cors({ origin: corsOrigins, credentials: true }))
  .get('/openapi.json', openAPIRouteHandler(api))
  .route('/', api);

if (process.env.NODE_ENV !== 'production') {
  app.get('/docs', Scalar({ url: '/openapi.json' }));
}

const port = safeParseInt(process.env.PORT, 4100);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`listening on http://localhost:${info.port}`);
});

export type AppType = typeof app;
