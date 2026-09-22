-- ウォレットアドレスがそのまま識別子になる。アドレスは小文字（EIP-55 の大小は保持しない）。
CREATE TABLE `accounts` (
  `id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ULID',
  `wallet_address` char(42) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '0x + 40 hex、小文字',
  `display_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credit_balance` bigint NOT NULL DEFAULT 0 COMMENT '現在のクレジット残高。credit_ledger の合計と一致する',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_accounts_wallet_address` (`wallet_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
