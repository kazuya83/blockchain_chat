import Anthropic from '@anthropic-ai/sdk';
import { supportsAdaptiveThinking } from './config';
import type { ClaudeChatTurn, ClaudeStreamEvent, ClaudeStreamResult } from './types';

// Singleton。認証情報は SDK が環境から解決する。
const client = new Anthropic();

export const getAnthropicClient = () => client;

/**
 * 会話を 1 往復ぶんストリーミングする。
 *
 * `onEvent` に差分を渡しつつ、最後に全文と usage を返す。tonebank のドメイン知識は持たない
 * 薄いトランスポートで、クレジットの計算やメッセージの保存は usecase 側の仕事。
 */
export const streamChat = async (params: {
  modelId: string;
  system: string | null;
  turns: readonly ClaudeChatTurn[];
  /** この往復で許す出力トークンの上限。クレジット残高から決まる。 */
  maxOutputTokens: number;
  onEvent: (event: ClaudeStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<ClaudeStreamResult> => {
  const stream = client.messages.stream(
    {
      model: params.modelId,
      max_tokens: params.maxOutputTokens,
      ...(params.system == null ? {} : { system: params.system }),
      // 既定では thinking のテキストが空で返るため、画面に出す前提で summarized を明示する。
      ...(supportsAdaptiveThinking(params.modelId)
        ? { thinking: { type: 'adaptive' as const, display: 'summarized' as const } }
        : {}),
      messages: params.turns.map((turn) => ({ role: turn.role, content: turn.content })),
    },
    params.signal == null ? undefined : { signal: params.signal },
  );

  for await (const event of stream) {
    if (event.type !== 'content_block_delta') continue;
    switch (event.delta.type) {
      case 'thinking_delta':
        params.onEvent({ type: 'thinking', text: event.delta.thinking });
        break;
      case 'text_delta':
        params.onEvent({ type: 'text', text: event.delta.text });
        break;
      default:
        break;
    }
  }

  const message = await stream.finalMessage();

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return {
    text,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
    stopReason: message.stop_reason,
    refusalCategory:
      message.stop_reason === 'refusal' ? (message.stop_details?.category ?? null) : null,
  };
};

/**
 * 送信前に入力トークン数を数える。見積もりではなく実際のトークナイザを通すので、
 * クレジットの引き当てが実績と大きくずれない。
 */
export const countInputTokens = async (params: {
  modelId: string;
  system: string | null;
  turns: readonly ClaudeChatTurn[];
}): Promise<number> => {
  const result = await client.messages.countTokens({
    model: params.modelId,
    ...(params.system == null ? {} : { system: params.system }),
    messages: params.turns.map((turn) => ({ role: turn.role, content: turn.content })),
  });
  return result.input_tokens;
};
