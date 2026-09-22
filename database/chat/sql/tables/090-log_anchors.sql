-- ルームの会話ログを ChatLogAnchor へ記録した履歴。
-- status: pending（TX 送信済み・未確定） / confirmed（確定） / failed（revert・置き換え）
CREATE TABLE `log_anchors` (
  `id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ULID',
  `room_id` char(26) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sequence` int unsigned NOT NULL COMMENT 'ルーム内のアンカー連番。1 始まり',
  `merkle_root` char(66) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_count` int unsigned NOT NULL COMMENT 'root が覆うメッセージ件数',
  `chain_id` int unsigned NOT NULL,
  `contract_address` char(42) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tx_hash` char(66) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `block_number` bigint unsigned DEFAULT NULL,
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `failure_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_log_anchors_room_id_sequence` (`room_id`, `sequence`),
  KEY `idx_log_anchors_status` (`status`),
  CONSTRAINT `fk_log_anchors_room_id` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
