import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { describeRoute, resolver, validator } from 'hono-openapi';
import z from 'zod';
import { unanchoredMessageCount } from '../domains/rooms';
import { ZUlid } from '../domains/ids';
import { isAnchoringEnabled } from '../integrations/chain/config';
import { listAnchorsByRoom } from '../repositories/anchors';
import { listMessages } from '../repositories/messages';
import {
  createRoom,
  deleteRoom,
  findRoomOwnedBy,
  listRoomsByAccount,
  updateRoomTitle,
} from '../repositories/rooms';
import { anchorRoom } from '../usecases/anchorRoom';
import { RoomNotFoundError } from '../usecases/errors';
import { sendMessage } from '../usecases/sendMessage';
import { verifyMessage } from '../usecases/verifyMessage';
import { CONTEXT_KEY_SESSION } from '../middlewares/_context';
import { authRequiredMiddleware, type AuthRequiredContext } from '../middlewares/authRequired';
import { defineErrorResponse, defineSuccess, toHttpError } from './utils';

const roomSchema = z.object({
  id: z.string(),
  title: z.string(),
  modelId: z.string(),
  systemPrompt: z.string().nullable(),
  messageCount: z.number(),
  anchoredMessageCount: z.number(),
  unanchoredMessageCount: z.number(),
  /** いまアンカーを打てるか。FE の動線の出し分け用で、実際のガードは BE に残る。 */
  canAnchor: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const messageSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  role: z.string(),
  content: z.string(),
  contentHash: z.string(),
  modelId: z.string().nullable(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  creditsCharged: z.number(),
  createdAt: z.string(),
});

const anchorSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  merkleRoot: z.string(),
  messageCount: z.number(),
  chainId: z.number(),
  contractAddress: z.string(),
  txHash: z.string().nullable(),
  blockNumber: z.string().nullable(),
  status: z.string(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  confirmedAt: z.string().nullable(),
});

const createRoomSchema = z.object({
  title: z.string().min(1).max(128),
  modelId: z.string().min(1).max(64),
  systemPrompt: z.string().max(8000).nullable().optional(),
});

const updateRoomSchema = z.object({
  title: z.string().min(1).max(128),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(100_000),
  /** true なら SSE で差分を流す。false なら完了後にまとめて返す。 */
  stream: z.boolean().optional(),
});

const roomParamSchema = z.object({ roomId: ZUlid });
const messageParamSchema = z.object({ roomId: ZUlid, messageId: ZUlid });

const toRoomView = (room: Awaited<ReturnType<typeof createRoom>>) => ({
  id: room.id,
  title: room.title,
  modelId: room.modelId,
  systemPrompt: room.systemPrompt,
  messageCount: room.messageCount,
  anchoredMessageCount: room.anchoredMessageCount,
  unanchoredMessageCount: unanchoredMessageCount(room),
  canAnchor: isAnchoringEnabled() && unanchoredMessageCount(room) > 0,
  createdAt: room.createdAt.toISOString(),
  updatedAt: room.updatedAt.toISOString(),
});

const toMessageView = (message: Awaited<ReturnType<typeof listMessages>>[number]) => ({
  id: message.id,
  sequence: message.sequence,
  role: message.role,
  content: message.content,
  contentHash: message.contentHash,
  modelId: message.modelId,
  inputTokens: message.inputTokens,
  outputTokens: message.outputTokens,
  creditsCharged: message.creditsCharged,
  createdAt: message.createdAt.toISOString(),
});

const toAnchorView = (anchor: Awaited<ReturnType<typeof listAnchorsByRoom>>[number]) => ({
  id: anchor.id,
  sequence: anchor.sequence,
  merkleRoot: anchor.merkleRoot,
  messageCount: anchor.messageCount,
  chainId: anchor.chainId,
  contractAddress: anchor.contractAddress,
  txHash: anchor.txHash,
  blockNumber: anchor.blockNumber?.toString() ?? null,
  status: anchor.status,
  failureReason: anchor.failureReason,
  createdAt: anchor.createdAt.toISOString(),
  confirmedAt: anchor.confirmedAt?.toISOString() ?? null,
});

export const roomRoute = new Hono<{ Variables: AuthRequiredContext }>()
  .use(authRequiredMiddleware)
  .get(
    '/',
    describeRoute({
      description: '自分のチャットルーム一覧を更新の新しい順で取得する。',
      responses: { 200: defineSuccess(resolver(z.array(roomSchema))) },
    }),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const rooms = await listRoomsByAccount(account.id);
      return c.json(rooms.map(toRoomView), 200);
    },
  )
  .post(
    '/',
    describeRoute({
      description: 'チャットルームを作る。',
      responses: {
        201: defineSuccess(resolver(roomSchema)),
        404: defineErrorResponse(),
      },
    }),
    validator('json', createRoomSchema),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const body = c.req.valid('json');

      try {
        const room = await createRoom({
          accountId: account.id,
          title: body.title,
          modelId: body.modelId,
          systemPrompt: body.systemPrompt ?? null,
        });
        return c.json(toRoomView(room), 201);
      } catch {
        // model_id の FK 違反はモデル指定の誤り
        return c.json({ message: 'モデルが見つからない: ' + body.modelId }, 404);
      }
    },
  )
  .get(
    '/:roomId',
    describeRoute({
      description: 'チャットルームを 1 件取得する。',
      responses: {
        200: defineSuccess(resolver(roomSchema)),
        404: defineErrorResponse(),
      },
    }),
    validator('param', roomParamSchema),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const { roomId } = c.req.valid('param');

      const room = await findRoomOwnedBy({ roomId, accountId: account.id });
      if (room == null) return c.json({ message: 'ルームが見つからない' }, 404);

      return c.json(toRoomView(room), 200);
    },
  )
  .patch(
    '/:roomId',
    describeRoute({
      description: 'チャットルームのタイトルを変更する。',
      responses: { 204: { description: 'No Content' }, 404: defineErrorResponse() },
    }),
    validator('param', roomParamSchema),
    validator('json', updateRoomSchema),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const { roomId } = c.req.valid('param');
      const { title } = c.req.valid('json');

      const updated = await updateRoomTitle({ roomId, accountId: account.id, title });
      if (updated === 0) return c.json({ message: 'ルームが見つからない' }, 404);

      return c.body(null, 204);
    },
  )
  .delete(
    '/:roomId',
    describeRoute({
      description: 'チャットルームを削除する。チェーン上のアンカーは消えない。',
      responses: { 204: { description: 'No Content' }, 404: defineErrorResponse() },
    }),
    validator('param', roomParamSchema),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const { roomId } = c.req.valid('param');

      const deleted = await deleteRoom({ roomId, accountId: account.id });
      if (deleted === 0) return c.json({ message: 'ルームが見つからない' }, 404);

      return c.body(null, 204);
    },
  )
  .get(
    '/:roomId/messages',
    describeRoute({
      description: 'ルームのメッセージを古い順に取得する。',
      responses: {
        200: defineSuccess(resolver(z.array(messageSchema))),
        404: defineErrorResponse(),
      },
    }),
    validator('param', roomParamSchema),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const { roomId } = c.req.valid('param');

      const room = await findRoomOwnedBy({ roomId, accountId: account.id });
      if (room == null) return c.json({ message: 'ルームが見つからない' }, 404);

      const messages = await listMessages({ roomId: room.id });
      return c.json(messages.map(toMessageView), 200);
    },
  )
  .post(
    '/:roomId/messages',
    describeRoute({
      description:
        '発言して返答を得る。stream=true のときは SSE（thinking / text / done / error）で返す。',
      responses: {
        200: defineSuccess(
          resolver(
            z.object({
              userMessage: messageSchema,
              assistantMessage: messageSchema,
              creditsCharged: z.number(),
              balanceAfter: z.string(),
            }),
          ),
        ),
        402: defineErrorResponse(),
        404: defineErrorResponse(),
        422: defineErrorResponse(),
      },
    }),
    validator('param', roomParamSchema),
    validator('json', sendMessageSchema),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const { roomId } = c.req.valid('param');
      const body = c.req.valid('json');

      if (body.stream !== true) {
        try {
          const result = await sendMessage({
            accountId: account.id,
            roomId,
            content: body.content,
          });
          return c.json(
            {
              userMessage: toMessageView(result.userMessage),
              assistantMessage: toMessageView(result.assistantMessage),
              creditsCharged: result.creditsCharged,
              balanceAfter: result.balanceAfter.toString(),
            },
            200,
          );
        } catch (error) {
          const mapped = toHttpError(error);
          if (mapped == null) throw error;
          return c.json(mapped.body, mapped.status);
        }
      }

      // SSE ではヘッダを送ったあとに失敗しうるので、エラーもイベントとして流す。
      return streamSSE(c, async (stream) => {
        try {
          const result = await sendMessage({
            accountId: account.id,
            roomId,
            content: body.content,
            onEvent: (event) => {
              void stream.writeSSE({ event: event.type, data: event.text });
            },
          });

          await stream.writeSSE({
            event: 'done',
            data: JSON.stringify({
              userMessage: toMessageView(result.userMessage),
              assistantMessage: toMessageView(result.assistantMessage),
              creditsCharged: result.creditsCharged,
              balanceAfter: result.balanceAfter.toString(),
            }),
          });
        } catch (error) {
          const mapped = toHttpError(error);
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify(mapped?.body ?? { message: 'サーバーエラー' }),
          });
          if (mapped == null) console.error(error);
        }
      });
    },
  )
  .get(
    '/:roomId/anchors',
    describeRoute({
      description: 'ルームのアンカー履歴を新しい順に取得する。',
      responses: {
        200: defineSuccess(resolver(z.array(anchorSchema))),
        404: defineErrorResponse(),
      },
    }),
    validator('param', roomParamSchema),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const { roomId } = c.req.valid('param');

      const room = await findRoomOwnedBy({ roomId, accountId: account.id });
      if (room == null) return c.json({ message: 'ルームが見つからない' }, 404);

      const anchors = await listAnchorsByRoom(room.id);
      return c.json(anchors.map(toAnchorView), 200);
    },
  )
  .post(
    '/:roomId/anchors',
    describeRoute({
      description:
        'いまのログの Merkle root をチェーンへ記録する。確定まで待ってから返すので時間がかかる。',
      responses: {
        201: defineSuccess(resolver(anchorSchema)),
        404: defineErrorResponse(),
        409: defineErrorResponse(),
        503: defineErrorResponse(),
      },
    }),
    validator('param', roomParamSchema),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const { roomId } = c.req.valid('param');

      try {
        const anchor = await anchorRoom({ accountId: account.id, roomId });
        return c.json(toAnchorView(anchor), 201);
      } catch (error) {
        const mapped = toHttpError(error);
        if (mapped == null) throw error;
        return c.json(mapped.body, mapped.status);
      }
    },
  )
  .get(
    '/:roomId/messages/:messageId/verification',
    describeRoute({
      description:
        'メッセージ 1 件の真正性を確認する。本文ハッシュ・Merkle proof・チェーン上の記録を別々に返す。',
      responses: {
        200: defineSuccess(
          resolver(
            z.object({
              verified: z.boolean(),
              contentHashMatches: z.boolean(),
              proofMatches: z.boolean(),
              anchoredOnChain: z.boolean(),
              reason: z.string().nullable(),
              leaf: z.string(),
              proof: z.array(z.string()),
              anchor: anchorSchema.nullable(),
            }),
          ),
        ),
        404: defineErrorResponse(),
      },
    }),
    validator('param', messageParamSchema),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const { roomId, messageId } = c.req.valid('param');

      try {
        const result = await verifyMessage({ accountId: account.id, roomId, messageId });
        return c.json(
          {
            verified: result.verified,
            contentHashMatches: result.contentHashMatches,
            proofMatches: result.proofMatches,
            anchoredOnChain: result.anchoredOnChain,
            reason: result.reason,
            leaf: result.leaf,
            proof: result.proof,
            anchor: result.anchor == null ? null : toAnchorView(result.anchor),
          },
          200,
        );
      } catch (error) {
        if (error instanceof RoomNotFoundError) {
          return c.json({ message: error.message }, 404);
        }
        const mapped = toHttpError(error);
        if (mapped == null) throw error;
        return c.json(mapped.body, mapped.status);
      }
    },
  );
