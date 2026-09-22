-- ログインのチャレンジ。ウォレットに署名させる nonce を 1 回だけ使えるようにする。
CREATE TABLE `auth_nonces` (
  `id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ULID',
  `wallet_address` char(42) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nonce` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_auth_nonces_nonce` (`nonce`),
  KEY `idx_auth_nonces_wallet_address` (`wallet_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
