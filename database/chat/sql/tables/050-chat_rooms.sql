CREATE TABLE `chat_rooms` (
  `id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ULID',
  `account_id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `system_prompt` text COLLATE utf8mb4_unicode_ci,
  `message_count` int unsigned NOT NULL DEFAULT 0 COMMENT 'chat_messages の件数。sequence の採番元',
  `anchored_message_count` int unsigned NOT NULL DEFAULT 0 COMMENT '確定済みアンカーが覆っている件数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_rooms_account_id` (`account_id`),
  CONSTRAINT `fk_chat_rooms_account_id` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_rooms_model_id` FOREIGN KEY (`model_id`) REFERENCES `chat_models` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
