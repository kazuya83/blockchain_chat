import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import { listChatModels } from '../repositories/chatModels';
import { authRequiredMiddleware, type AuthRequiredContext } from '../middlewares/authRequired';
import { defineSuccess } from './utils';

const chatModelSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  inputCreditsPer1kTokens: z.number(),
  outputCreditsPer1kTokens: z.number(),
});

export const modelRoute = new Hono<{ Variables: AuthRequiredContext }>()
  .use(authRequiredMiddleware)
  .get(
    '/',
    describeRoute({
      description: '選べるモデルと課金レートの一覧を取得する。',
      responses: { 200: defineSuccess(resolver(z.array(chatModelSchema))) },
    }),
    async (c) => {
      const models = await listChatModels();
      return c.json(
        models.map((model) => ({
          id: model.id,
          displayName: model.displayName,
          inputCreditsPer1kTokens: model.inputCreditsPer1kTokens,
          outputCreditsPer1kTokens: model.outputCreditsPer1kTokens,
        })),
        200,
      );
    },
  );
