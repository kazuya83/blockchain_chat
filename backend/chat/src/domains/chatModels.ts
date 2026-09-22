import type { chat_modelsModel } from '../generated/prisma/models.js';

export type ChatModel = {
  id: string;
  displayName: string;
  inputCreditsPer1kTokens: number;
  outputCreditsPer1kTokens: number;
  sortOrder: number;
};

export const toChatModel = (row: chat_modelsModel): ChatModel => ({
  id: row.id,
  displayName: row.display_name,
  inputCreditsPer1kTokens: row.input_credits_per_1k_tokens,
  outputCreditsPer1kTokens: row.output_credits_per_1k_tokens,
  sortOrder: row.sort_order,
});

/**
 * 実績トークン数から請求クレジットを求める。
 * 1000 トークン未満は切り上げる（0 円通話を作らない）。
 */
export const chargeFor = (
  model: ChatModel,
  usage: { inputTokens: number; outputTokens: number },
): number => {
  const input = Math.ceil((usage.inputTokens * model.inputCreditsPer1kTokens) / 1000);
  const output = Math.ceil((usage.outputTokens * model.outputCreditsPer1kTokens) / 1000);
  return input + output;
};

/**
 * 送信前に押さえておく見積もり。実績が出たら chargeFor で精算する。
 * 出力トークンは事前に分からないので、上限の一部を見込む。
 */
export const estimateHold = (
  model: ChatModel,
  estimate: { inputTokens: number; expectedOutputTokens: number },
): number =>
  chargeFor(model, {
    inputTokens: estimate.inputTokens,
    outputTokens: estimate.expectedOutputTokens,
  });

/** 1 往復で最低限これだけの出力は出せないと、会話として成立しない。 */
export const MIN_OUTPUT_TOKENS = 256;

/**
 * 残高から、この往復で許せる出力トークンの上限を求める。
 *
 * 出力の上限をクレジットで先に縛るので、実績が引き当てを超えることがない
 * （＝残高がマイナスにならない）。足りなければ null。
 */
export const affordableOutputTokens = (
  model: ChatModel,
  params: { balance: bigint; inputTokens: number; hardMaxOutputTokens: number },
): number | null => {
  const inputCredits = BigInt(
    Math.ceil((params.inputTokens * model.inputCreditsPer1kTokens) / 1000),
  );
  const remaining = params.balance - inputCredits;
  if (remaining <= 0n) return null;

  const rate = BigInt(model.outputCreditsPer1kTokens);
  if (rate === 0n) return params.hardMaxOutputTokens;

  const tokens = (remaining * 1000n) / rate;
  const capped = tokens > BigInt(params.hardMaxOutputTokens)
    ? params.hardMaxOutputTokens
    : Number(tokens);

  return capped < MIN_OUTPUT_TOKENS ? null : capped;
};
