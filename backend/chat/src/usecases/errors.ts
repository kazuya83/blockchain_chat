/** usecase が投げるドメインエラー。HTTP ステータスへの対応付けは route の仕事。 */
export class UsecaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RoomNotFoundError extends UsecaseError {
  constructor() {
    super('ルームが見つからない');
  }
}

export class MessageNotFoundError extends UsecaseError {
  constructor() {
    super('メッセージが見つからない');
  }
}

export class ModelNotFoundError extends UsecaseError {
  constructor(modelId: string) {
    super(`モデルが見つからない: ${modelId}`);
  }
}

export class InsufficientCreditsError extends UsecaseError {
  constructor(
    readonly balance: bigint,
    readonly requiredAtLeast: number,
  ) {
    super('クレジットが足りない');
  }
}

export class InvalidSignatureError extends UsecaseError {
  constructor() {
    super('署名が確認できない');
  }
}

export class NonceUnusableError extends UsecaseError {
  constructor() {
    super('nonce が使えない（期限切れ、または使用済み）');
  }
}

export class NothingToAnchorError extends UsecaseError {
  constructor() {
    super('アンカーする新しいメッセージが無い');
  }
}

export class AnchorInProgressError extends UsecaseError {
  constructor() {
    super('確定待ちのアンカーがある');
  }
}

export class AnchoringDisabledError extends UsecaseError {
  constructor() {
    super('アンカーが無効（コントラクトのアドレスか署名鍵が未設定）');
  }
}

export class ModelRefusedError extends UsecaseError {
  constructor(readonly category: string | null) {
    super('モデルが応答を拒否した');
  }
}
