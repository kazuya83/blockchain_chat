-- 会話ログ。content_hash が Merkle 木の葉になる（詳細は docs/current/02-anchoring.md）。
-- 追記のみで、更新・削除はしない（したらアンカーと合わなくなる）。
CREATE TABLE `chat_messages` (
  `id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ULID',
  `room_id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sequence` int unsigned NOT NULL COMMENT 'ルーム内の連番。1 始まり',
  `role` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'user | assistant',
  `content` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_hash` char(66) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '0x + keccak256 の hex',
  `model_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'assistant のときだけ入る',
  `input_tokens` int unsigned NOT NULL DEFAULT 0,
  `output_tokens` int unsigned NOT NULL DEFAULT 0,
  `credits_charged` int unsigned NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chat_messages_room_id_sequence` (`room_id`, `sequence`),
  KEY `idx_chat_messages_room_id_created_at` (`room_id`, `created_at`),
  CONSTRAINT `fk_chat_messages_room_id` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
