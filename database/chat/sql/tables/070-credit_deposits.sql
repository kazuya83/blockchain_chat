-- ChatCredit コントラクトの Deposited イベントを取り込んだ記録。
-- deposit_id はコントラクトが採番する連番で、これが取り込みの冪等キーになる。
CREATE TABLE `credit_deposits` (
  `id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ULID',
  `account_id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chain_id` int unsigned NOT NULL,
  `contract_address` char(42) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deposit_id` bigint unsigned NOT NULL COMMENT 'ChatCredit.Deposited.depositId',
  `tx_hash` char(66) COLLATE utf8mb4_unicode_ci NOT NULL,
  `log_index` int unsigned NOT NULL,
  `block_number` bigint unsigned NOT NULL,
  `amount_wei` decimal(38,0) NOT NULL,
  `credits_granted` bigint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_credit_deposits_chain_contract_deposit` (`chain_id`, `contract_address`, `deposit_id`),
  KEY `idx_credit_deposits_account_id` (`account_id`),
  CONSTRAINT `fk_credit_deposits_account_id` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
