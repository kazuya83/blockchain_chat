// Generated from http://localhost:4100/openapi.json by frontend/.scripts/apigen.ts. Do not edit.
export interface paths {
    "/api/chain": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description このバックエンドがどのチェーン・コントラクトを見ているか。FE の接続先確認に使う。 */
        get: operations["getApiChain"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/challenge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description ウォレットに署名させる文面と nonce を発行する。 */
        post: operations["postApiAuthChallenge"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description 署名を検証してセッションを発行する。初回はアカウントも作る。 */
        post: operations["postApiAuthVerify"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sign-out": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description セッションを失効させる。 */
        post: operations["postApiAuthSignOut"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description サインイン中のアカウントを取得する。 */
        get: operations["getApiMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** @description 表示名を変更する。 */
        patch: operations["patchApiMe"];
        trace?: never;
    };
    "/api/me/credits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description クレジット残高と入金の受け入れ条件を取得する。 */
        get: operations["getApiMeCredits"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/me/credits/ledger": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description クレジットの増減履歴を新しい順に取得する。 */
        get: operations["getApiMeCreditsLedger"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/me/credits/deposits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description チェーンから取り込んだ入金の一覧を取得する。 */
        get: operations["getApiMeCreditsDeposits"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/me/credits/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description チェーンの入金イベントをいま取り込む。定期実行の補助で、入金直後に画面から叩く想定。 */
        post: operations["postApiMeCreditsSync"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/models": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description 選べるモデルと課金レートの一覧を取得する。 */
        get: operations["getApiModels"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rooms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description 自分のチャットルーム一覧を更新の新しい順で取得する。 */
        get: operations["getApiRooms"];
        put?: never;
        /** @description チャットルームを作る。 */
        post: operations["postApiRooms"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rooms/{roomId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description チャットルームを 1 件取得する。 */
        get: operations["getApiRoomsByRoomId"];
        put?: never;
        post?: never;
        /** @description チャットルームを削除する。チェーン上のアンカーは消えない。 */
        delete: operations["deleteApiRoomsByRoomId"];
        options?: never;
        head?: never;
        /** @description チャットルームのタイトルを変更する。 */
        patch: operations["patchApiRoomsByRoomId"];
        trace?: never;
    };
    "/api/rooms/{roomId}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description ルームのメッセージを古い順に取得する。 */
        get: operations["getApiRoomsByRoomIdMessages"];
        put?: never;
        /** @description 発言して返答を得る。stream=true のときは SSE（thinking / text / done / error）で返す。 */
        post: operations["postApiRoomsByRoomIdMessages"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rooms/{roomId}/anchors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description ルームのアンカー履歴を新しい順に取得する。 */
        get: operations["getApiRoomsByRoomIdAnchors"];
        put?: never;
        /** @description いまのログの Merkle root をチェーンへ記録する。確定まで待ってから返すので時間がかかる。 */
        post: operations["postApiRoomsByRoomIdAnchors"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rooms/{roomId}/messages/{messageId}/verification": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description メッセージ 1 件の真正性を確認する。本文ハッシュ・Merkle proof・チェーン上の記録を別々に返す。 */
        get: operations["getApiRoomsByRoomIdMessagesByMessageIdVerification"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: never;
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getApiChain: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        chainId: number;
                        chatCreditAddress: string;
                        chatLogAnchorAddress: string;
                        weiPerCredit: string;
                        confirmations: number;
                        depositSyncEnabled: boolean;
                        anchoringEnabled: boolean;
                    };
                };
            };
        };
    };
    postApiAuthChallenge: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    walletAddress: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        nonce: string;
                        message: string;
                        expiresAt: string;
                    };
                };
            };
            /** @description Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
    postApiAuthVerify: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    walletAddress: string;
                    nonce: string;
                    signature: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        account: {
                            id: string;
                            walletAddress: string;
                            walletAddressChecksum: string;
                            displayName: string | null;
                            creditBalance: string;
                        };
                        token: string;
                        expiresAt: string;
                    };
                };
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
            /** @description Error */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
    postApiAuthSignOut: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getApiMe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        walletAddress: string;
                        walletAddressChecksum: string;
                        displayName: string | null;
                        creditBalance: string;
                    };
                };
            };
        };
    };
    patchApiMe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    displayName: string | null;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        walletAddress: string;
                        walletAddressChecksum: string;
                        displayName: string | null;
                        creditBalance: string;
                    };
                };
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
        };
    };
    getApiMeCredits: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        balance: string;
                        chainId: number;
                        chatCreditAddress: string;
                        weiPerCredit: string;
                        confirmations: number;
                    };
                };
            };
        };
    };
    getApiMeCreditsLedger: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        kind: string;
                        amount: string;
                        balanceAfter: string;
                        referenceType: string | null;
                        referenceId: string | null;
                        createdAt: string;
                    }[];
                };
            };
        };
    };
    getApiMeCreditsDeposits: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        depositId: string;
                        txHash: string;
                        blockNumber: string;
                        amountWei: string;
                        creditsGranted: string;
                        createdAt: string;
                    }[];
                };
            };
        };
    };
    postApiMeCreditsSync: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        enabled: boolean;
                        fromBlock: string;
                        toBlock: string;
                        scannedLogs: number;
                        recordedDeposits: number;
                        balance: string;
                    };
                };
            };
        };
    };
    getApiModels: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        displayName: string;
                        inputCreditsPer1kTokens: number;
                        outputCreditsPer1kTokens: number;
                    }[];
                };
            };
        };
    };
    getApiRooms: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        modelId: string;
                        systemPrompt: string | null;
                        messageCount: number;
                        anchoredMessageCount: number;
                        unanchoredMessageCount: number;
                        canAnchor: boolean;
                        createdAt: string;
                        updatedAt: string;
                    }[];
                };
            };
        };
    };
    postApiRooms: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title: string;
                    modelId: string;
                    systemPrompt?: string | null;
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        modelId: string;
                        systemPrompt: string | null;
                        messageCount: number;
                        anchoredMessageCount: number;
                        unanchoredMessageCount: number;
                        canAnchor: boolean;
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
            /** @description Error */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
    getApiRoomsByRoomId: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        modelId: string;
                        systemPrompt: string | null;
                        messageCount: number;
                        anchoredMessageCount: number;
                        unanchoredMessageCount: number;
                        canAnchor: boolean;
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
            /** @description Error */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
    deleteApiRoomsByRoomId: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
            /** @description Error */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
    patchApiRoomsByRoomId: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title: string;
                };
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
            /** @description Error */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
    getApiRoomsByRoomIdMessages: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
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
                    }[];
                };
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
            /** @description Error */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
    postApiRoomsByRoomIdMessages: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    content: string;
                    stream?: boolean;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        userMessage: {
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
                        assistantMessage: {
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
                        creditsCharged: number;
                        balanceAfter: string;
                    };
                };
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
            /** @description Error */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
            /** @description Error */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
            /** @description Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
    getApiRoomsByRoomIdAnchors: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        sequence: number;
                        merkleRoot: string;
                        messageCount: number;
                        chainId: number;
                        contractAddress: string;
                        txHash: string | null;
                        blockNumber: string | null;
                        status: string;
                        failureReason: string | null;
                        createdAt: string;
                        confirmedAt: string | null;
                    }[];
                };
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
            /** @description Error */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
    postApiRoomsByRoomIdAnchors: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        sequence: number;
                        merkleRoot: string;
                        messageCount: number;
                        chainId: number;
                        contractAddress: string;
                        txHash: string | null;
                        blockNumber: string | null;
                        status: string;
                        failureReason: string | null;
                        createdAt: string;
                        confirmedAt: string | null;
                    };
                };
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
            /** @description Error */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
            /** @description Error */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
            /** @description Error */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
    getApiRoomsByRoomIdMessagesByMessageIdVerification: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomId: string;
                messageId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        verified: boolean;
                        contentHashMatches: boolean;
                        proofMatches: boolean;
                        anchoredOnChain: boolean;
                        reason: string | null;
                        leaf: string;
                        proof: string[];
                        anchor: {
                            id: string;
                            sequence: number;
                            merkleRoot: string;
                            messageCount: number;
                            chainId: number;
                            contractAddress: string;
                            txHash: string | null;
                            blockNumber: string | null;
                            status: string;
                            failureReason: string | null;
                            createdAt: string;
                            confirmedAt: string | null;
                        } | null;
                    };
                };
            };
            /** @description Validation Error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: unknown[];
                        data: unknown;
                    };
                };
            };
            /** @description Error */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
        };
    };
}
