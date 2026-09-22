-- Deposited イベントをどのブロックまで取り込んだか。取り込みの再開位置になる。
CREATE TABLE `chain_sync_states` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '同期対象の名前（例 chat_credit_deposits）',
  `chain_id` int unsigned NOT NULL,
  `contract_address` char(42) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_synced_block` bigint unsigned NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
