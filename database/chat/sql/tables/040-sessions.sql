-- セッショントークンは平文で保存しない。SHA-256 のハッシュだけを持つ。
CREATE TABLE `sessions` (
  `id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ULID',
  `account_id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'sha256(token) の hex',
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sessions_token_hash` (`token_hash`),
  KEY `idx_sessions_account_id` (`account_id`),
  CONSTRAINT `fk_sessions_account_id` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
