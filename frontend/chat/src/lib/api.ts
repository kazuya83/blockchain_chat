import createClient from 'openapi-fetch';
import type { paths } from '@/types/gen/api';

/**
 * backend への HTTP クライアント。
 * 開発中は vite の proxy で同一オリジンになるので、セッション Cookie がそのまま乗る。
 */
export const api = createClient<paths>({
  baseUrl: '/',
  credentials: 'include',
});

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** openapi-fetch の { data, error } を、throw するだけの形に畳む。 */
export const unwrap = <T>(
  result: { data?: T; error?: unknown; response: Response },
): T => {
  if (result.error != null || result.data === undefined) {
    const message =
      typeof result.error === 'object' && result.error != null && 'message' in result.error
        ? String((result.error as { message: unknown }).message)
        : `リクエストに失敗した (${result.response.status})`;
    throw new ApiError(message, result.response.status);
  }
  return result.data;
};

export type SseEvent =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'done'; payload: SendMessageDone }
  | { type: 'error'; message: string };

export type SendMessageDone = {
  userMessage: ChatMessageView;
  assistantMessage: ChatMessageView;
  creditsCharged: number;
  balanceAfter: string;
};

export type ChatMessageView = {
  id: string;
  sequence: number;
  role: string;
  content: string;
  contentHash: string;
  modelId: string | null;
  inputTokens: number;
  outputTokens: number;
  creditsCharged: number;
  createdAt: string;
};

/**
 * 発言を送り、SSE で届く差分を逐次受け取る。
 *
 * openapi-fetch は SSE を扱わないので、この 1 本だけ fetch を直に使う。
 * 戻り値は最後の done イベントの中身で、error イベントが来たら throw する。
 */
export const sendMessageStream = async (params: {
  roomId: string;
  content: string;
  onEvent: (event: SseEvent) => void;
  signal?: AbortSignal;
}): Promise<SendMessageDone> => {
  const response = await fetch(`/api/rooms/${params.roomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    credentials: 'include',
    body: JSON.stringify({ content: params.content, stream: true }),
    signal: params.signal,
  });

  if (!response.ok || response.body == null) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? '送信に失敗した', response.status);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let done: SendMessageDone | null = null;

  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += chunk.value;

    // SSE のフレームは空行区切り
    let separator = buffer.indexOf('\n\n');
    while (separator >= 0) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf('\n\n');

      const parsed = parseFrame(frame);
      if (parsed == null) continue;

      switch (parsed.event) {
        case 'thinking':
        case 'text':
          params.onEvent({ type: parsed.event, text: parsed.data });
          break;
        case 'done': {
          done = JSON.parse(parsed.data) as SendMessageDone;
          params.onEvent({ type: 'done', payload: done });
          break;
        }
        case 'error': {
          const body = JSON.parse(parsed.data) as { message?: string };
          const message = body.message ?? 'サーバーエラー';
          params.onEvent({ type: 'error', message });
          throw new ApiError(message, response.status);
        }
        default:
          break;
      }
    }
  }

  if (done == null) {
    throw new ApiError('応答が最後まで届かなかった', response.status);
  }
  return done;
};

const parseFrame = (frame: string): { event: string; data: string } | null => {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    // data 行の先頭 1 つだけの空白を落とす（本文の空白を壊さない）
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
};
