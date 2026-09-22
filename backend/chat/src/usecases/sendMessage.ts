import type { Ulid } from '../domains/ids';
import type { ChatMessage } from '../domains/messages';
import { affordableOutputTokens, chargeFor } from '../domains/chatModels';
import { claudeConfig } from '../integrations/claude/config';
import { countInputTokens, streamChat } from '../integrations/claude/client';
import type { ClaudeChatTurn, ClaudeStreamEvent } from '../integrations/claude/types';
import { findAccountById } from '../repositories/accounts';
import { findChatModel } from '../repositories/chatModels';
import { consumeCredits, refundCredits } from '../repositories/credits';
import { appendMessage, listMessages } from '../repositories/messages';
import { findRoomOwnedBy } from '../repositories/rooms';
import {
  InsufficientCreditsError,
  ModelNotFoundError,
  ModelRefusedError,
  RoomNotFoundError,
} from './errors';

export type SendMessageResult = {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  creditsCharged: number;
  balanceAfter: bigint;
};

/**
 * ユーザーの発言を受けて Claude の返答を 1 往復ぶん記録する。
 *
 * クレジットの扱いがこの usecase の肝で、次の順で「使いすぎ」を構造的に防いでいる。
 *
 *   1. 入力トークンを実際に数える（見積もりではなく countTokens）
 *   2. 残高から、この往復で出せる出力トークンの上限を決める
 *   3. その上限ぶんを**先に**引き当てる（条件付き UPDATE なので同時実行でも二重には使えない）
 *   4. 上限を max_tokens として送るので、実績が引き当てを超えることはない
 *   5. 実績が出たら差額を戻す
 *
 * 途中で失敗したら引き当てを全額戻す。ユーザー発言は記録したまま残す
 * （記録を消すと chat_messages の sequence に穴が空き、アンカーと突き合わなくなる）。
 */
export const sendMessage = async (params: {
  accountId: Ulid;
  roomId: Ulid;
  content: string;
  onEvent?: (event: ClaudeStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<SendMessageResult> => {
  const room = await findRoomOwnedBy({ roomId: params.roomId, accountId: params.accountId });
  if (room == null) throw new RoomNotFoundError();

  const model = await findChatModel(room.modelId);
  if (model == null) throw new ModelNotFoundError(room.modelId);

  const account = await findAccountById(params.accountId);
  if (account == null) throw new RoomNotFoundError();

  const history = await listMessages({ roomId: room.id });
  const turns: ClaudeChatTurn[] = [
    ...history.map((message) => ({ role: message.role, content: message.content })),
    { role: 'user' as const, content: params.content },
  ];

  const inputTokens = await countInputTokens({
    modelId: model.id,
    system: room.systemPrompt,
    turns,
  });

  const maxOutputTokens = affordableOutputTokens(model, {
    balance: account.creditBalance,
    inputTokens,
    hardMaxOutputTokens: claudeConfig.maxOutputTokens,
  });
  if (maxOutputTokens == null) {
    throw new InsufficientCreditsError(
      account.creditBalance,
      chargeFor(model, { inputTokens, outputTokens: 0 }) + 1,
    );
  }

  const hold = chargeFor(model, { inputTokens, outputTokens: maxOutputTokens });

  const userMessage = await appendMessage({
    roomId: room.id,
    role: 'user',
    content: params.content,
  });

  const held = await consumeCredits({
    accountId: params.accountId,
    amount: hold,
    referenceType: 'chat_message',
    referenceId: userMessage.id,
  });
  if (held == null) {
    // 残高チェックとこの UPDATE の間に別のリクエストが使い切った
    throw new InsufficientCreditsError(account.creditBalance, hold);
  }

  try {
    const result = await streamChat({
      modelId: model.id,
      system: room.systemPrompt,
      turns,
      maxOutputTokens,
      onEvent: params.onEvent ?? (() => {}),
      signal: params.signal,
    });

    if (result.stopReason === 'refusal') {
      throw new ModelRefusedError(result.refusalCategory);
    }

    const actual = chargeFor(model, {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    });

    const assistantMessage = await appendMessage({
      roomId: room.id,
      role: 'assistant',
      content: result.text,
      modelId: model.id,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      creditsCharged: actual,
    });

    await refundCredits({
      accountId: params.accountId,
      amount: hold - actual,
      referenceType: 'chat_message',
      referenceId: assistantMessage.id,
    });

    const after = await findAccountById(params.accountId);

    return {
      userMessage,
      assistantMessage,
      creditsCharged: actual,
      balanceAfter: after?.creditBalance ?? 0n,
    };
  } catch (error) {
    // 補償: 引き当てを全額戻す。戻し先の参照はユーザー発言（1 発言につき 1 行）。
    await refundCredits({
      accountId: params.accountId,
      amount: hold,
      referenceType: 'chat_message_refund',
      referenceId: userMessage.id,
    });
    throw error;
  }
};
