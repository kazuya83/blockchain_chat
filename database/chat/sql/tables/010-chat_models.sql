-- 利用できるモデルと課金レート。リポジトリが正を持つ静的な語彙なので master で投入する。
CREATE TABLE `chat_models` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Claude API の model id',
  `display_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `input_credits_per_1k_tokens` int unsigned NOT NULL COMMENT '入力 1000 トークンあたりのクレジット',
  `output_credits_per_1k_tokens` int unsigned NOT NULL COMMENT '出力 1000 トークンあたりのクレジット',
  `sort_order` int unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
