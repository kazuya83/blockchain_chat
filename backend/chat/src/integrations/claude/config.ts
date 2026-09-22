import { safeParseInt } from '../../libs/parse';

/**
 * Claude API 連携の設定。
 * API キーは `ANTHROPIC_API_KEY` を SDK が直接読む（`ant auth login` のプロファイルでも動く）ので、
 * ここでは必須にしない。キーが無い環境では最初のリクエストで SDK が例外を投げる。
 */
export const claudeConfig = {
  defaultModelId: process.env.CHAT_DEFAULT_MODEL_ID ?? 'claude-opus-5',
  maxOutputTokens: safeParseInt(process.env.CHAT_MAX_OUTPUT_TOKENS, 64_000),
} as const;

/**
 * adaptive thinking を受け付けるモデルかどうか。
 * Haiku 4.5 は旧来の budget_tokens 方式なので、adaptive を送ると 400 になる。
 * ここは Claude API 側の都合なので domain ではなく連携側に置く。
 */
export const supportsAdaptiveThinking = (modelId: string): boolean =>
  !modelId.startsWith('claude-haiku-');
