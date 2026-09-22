-- クレジットの増減。accounts.credit_balance はこの合計のキャッシュで、同じトランザクションで更新する。
CREATE TABLE `credit_ledger` (
  `id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ULID',
  `account_id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'deposit | consume | adjust',
  `amount` bigint NOT NULL COMMENT '増加は正、消費は負',
  `balance_after` bigint NOT NULL,
  `reference_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'credit_deposit | chat_message',
  `reference_id` char(26) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_credit_ledger_reference` (`reference_type`, `reference_id`),
  KEY `idx_credit_ledger_account_id_created_at` (`account_id`, `created_at`),
  CONSTRAINT `fk_credit_ledger_account_id` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
