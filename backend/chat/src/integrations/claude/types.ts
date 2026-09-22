export type ClaudeChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

/** ストリーム中にバックエンドが受け取るイベント。SSE へそのまま流す形に合わせている。 */
export type ClaudeStreamEvent =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string };

export type ClaudeUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type ClaudeStreamResult = {
  text: string;
  usage: ClaudeUsage;
  stopReason: string | null;
  /** stop_reason === 'refusal' のときだけ入る */
  refusalCategory: string | null;
};
