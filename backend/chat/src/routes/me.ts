import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import z from 'zod';
import { toChecksumAddress } from '../domains/accounts';
import { findAccountById, updateDisplayName } from '../repositories/accounts';
import { listDepositsByAccount, listLedgerByAccount } from '../repositories/credits';
import { chainConfig } from '../integrations/chain/config';
import { syncDeposits } from '../usecases/syncDeposits';
import { CONTEXT_KEY_SESSION } from '../middlewares/_context';
import {
  authRequiredMiddleware,
  type AuthRequiredContext,
} from '../middlewares/authRequired';
import { defineSuccess } from './utils';

const accountSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  walletAddressChecksum: z.string(),
  displayName: z.string().nullable(),
  creditBalance: z.string(),
});

const updateProfileSchema = z.object({
  displayName: z.string().max(64).nullable(),
});

const ledgerEntrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  amount: z.string(),
  balanceAfter: z.string(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  createdAt: z.string(),
});

const depositSchema = z.object({
  id: z.string(),
  depositId: z.string(),
  txHash: z.string(),
  blockNumber: z.string(),
  amountWei: z.string(),
  creditsGranted: z.string(),
  createdAt: z.string(),
});

export const meRoute = new Hono<{ Variables: AuthRequiredContext }>()
  .use(authRequiredMiddleware)
  .get(
    '/',
    describeRoute({
      description: 'サインイン中のアカウントを取得する。',
      responses: { 200: defineSuccess(resolver(accountSchema)) },
    }),
    (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      return c.json(
        {
          id: account.id,
          walletAddress: account.walletAddress,
          walletAddressChecksum: toChecksumAddress(account.walletAddress),
          displayName: account.displayName,
          creditBalance: account.creditBalance.toString(),
        },
        200,
      );
    },
  )
  .patch(
    '/',
    describeRoute({
      description: '表示名を変更する。',
      responses: { 200: defineSuccess(resolver(accountSchema)) },
    }),
    validator('json', updateProfileSchema),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const { displayName } = c.req.valid('json');
      const updated = await updateDisplayName(account.id, displayName);

      return c.json(
        {
          id: updated.id,
          walletAddress: updated.walletAddress,
          walletAddressChecksum: toChecksumAddress(updated.walletAddress),
          displayName: updated.displayName,
          creditBalance: updated.creditBalance.toString(),
        },
        200,
      );
    },
  )
  .get(
    '/credits',
    describeRoute({
      description: 'クレジット残高と入金の受け入れ条件を取得する。',
      responses: {
        200: defineSuccess(
          resolver(
            z.object({
              balance: z.string(),
              chainId: z.number(),
              chatCreditAddress: z.string(),
              weiPerCredit: z.string(),
              confirmations: z.number(),
            }),
          ),
        ),
      },
    }),
    (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      return c.json(
        {
          balance: account.creditBalance.toString(),
          chainId: chainConfig.chainId,
          chatCreditAddress: chainConfig.chatCreditAddress,
          weiPerCredit: chainConfig.weiPerCredit.toString(),
          confirmations: chainConfig.confirmations,
        },
        200,
      );
    },
  )
  .get(
    '/credits/ledger',
    describeRoute({
      description: 'クレジットの増減履歴を新しい順に取得する。',
      responses: { 200: defineSuccess(resolver(z.array(ledgerEntrySchema))) },
    }),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const entries = await listLedgerByAccount({ accountId: account.id, limit: 100 });

      return c.json(
        entries.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          amount: entry.amount.toString(),
          balanceAfter: entry.balanceAfter.toString(),
          referenceType: entry.referenceType,
          referenceId: entry.referenceId,
          createdAt: entry.createdAt.toISOString(),
        })),
        200,
      );
    },
  )
  .get(
    '/credits/deposits',
    describeRoute({
      description: 'チェーンから取り込んだ入金の一覧を取得する。',
      responses: { 200: defineSuccess(resolver(z.array(depositSchema))) },
    }),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const deposits = await listDepositsByAccount({ accountId: account.id, limit: 100 });

      return c.json(
        deposits.map((deposit) => ({
          id: deposit.id,
          depositId: deposit.depositId.toString(),
          txHash: deposit.txHash,
          blockNumber: deposit.blockNumber.toString(),
          amountWei: deposit.amountWei.toString(),
          creditsGranted: deposit.creditsGranted.toString(),
          createdAt: deposit.createdAt.toISOString(),
        })),
        200,
      );
    },
  )
  .post(
    '/credits/sync',
    describeRoute({
      description:
        'チェーンの入金イベントをいま取り込む。定期実行の補助で、入金直後に画面から叩く想定。',
      responses: {
        200: defineSuccess(
          resolver(
            z.object({
              enabled: z.boolean(),
              fromBlock: z.string(),
              toBlock: z.string(),
              scannedLogs: z.number(),
              recordedDeposits: z.number(),
              balance: z.string(),
            }),
          ),
        ),
      },
    }),
    async (c) => {
      const { account } = c.get(CONTEXT_KEY_SESSION);
      const result = await syncDeposits();

      // 自分の残高は取り込み後の値を返す
      const refreshed = await findAccountById(account.id);

      return c.json(
        {
          enabled: result.enabled,
          fromBlock: result.fromBlock.toString(),
          toBlock: result.toBlock.toString(),
          scannedLogs: result.scannedLogs,
          recordedDeposits: result.recordedDeposits,
          balance: (refreshed?.creditBalance ?? account.creditBalance).toString(),
        },
        200,
      );
    },
  );
