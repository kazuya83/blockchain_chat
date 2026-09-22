import { resolver } from 'hono-openapi';
import z from 'zod';
import {
  AnchorInProgressError,
  AnchoringDisabledError,
  InsufficientCreditsError,
  InvalidSignatureError,
  MessageNotFoundError,
  ModelNotFoundError,
  ModelRefusedError,
  NonceUnusableError,
  NothingToAnchorError,
  RoomNotFoundError,
  UsecaseError,
} from '../usecases/errors';

export const defineSuccess = <T>(schema: T) => ({
  description: 'Success',
  content: { 'application/json': { schema } },
});

const errorResponseSchema = z.object({ message: z.string() });

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const defineError = <E>(schema: E) => ({
  description: 'Error',
  content: { 'application/json': { schema } },
});

export const defineErrorResponse = () => defineError(resolver(errorResponseSchema));

export type HttpErrorStatus = 400 | 402 | 403 | 404 | 409 | 422 | 503;

/**
 * ドメインエラー → HTTP の対応付け。usecase は HTTP を知らないので、ここだけが知る。
 * 未知のエラーは握りつぶさず null を返し、呼び出し側で 500 にする。
 */
export const toHttpError = (
  error: unknown,
): { status: HttpErrorStatus; body: ErrorResponse } | null => {
  if (error instanceof RoomNotFoundError || error instanceof MessageNotFoundError) {
    return { status: 404, body: { message: error.message } };
  }
  if (error instanceof ModelNotFoundError) {
    return { status: 404, body: { message: error.message } };
  }
  if (error instanceof InsufficientCreditsError) {
    return {
      status: 402,
      body: {
        message: `${error.message}（残高 ${error.balance}、必要 ${error.requiredAtLeast} 以上）`,
      },
    };
  }
  if (error instanceof InvalidSignatureError || error instanceof NonceUnusableError) {
    return { status: 403, body: { message: error.message } };
  }
  if (error instanceof NothingToAnchorError) {
    return { status: 409, body: { message: error.message } };
  }
  if (error instanceof AnchorInProgressError) {
    return { status: 409, body: { message: error.message } };
  }
  if (error instanceof AnchoringDisabledError) {
    return { status: 503, body: { message: error.message } };
  }
  if (error instanceof ModelRefusedError) {
    return {
      status: 422,
      body: { message: `${error.message}（分類: ${error.category ?? '不明'}）` },
    };
  }
  if (error instanceof UsecaseError) {
    return { status: 400, body: { message: error.message } };
  }
  return null;
};
