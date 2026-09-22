-- 利用できるモデルと課金レート。全環境に同じものを流す。
--
-- 1 クレジット = 0.0001 USD 相当として、Claude API の公開価格をそのまま換算している。
--   Opus 5    $5 / $25  per MTok  -> 1k あたり  50 /  250 クレジット
--   Sonnet 5  $2 / $10  per MTok  -> 1k あたり  20 /  100 クレジット
--   Haiku 4.5 $1 / $5   per MTok  -> 1k あたり  10 /   50 クレジット
-- 価格を変えるときはこのファイルを直し、全環境に流し直す（画面からは編集できない）。
INSERT INTO `chat_models`
  (`id`, `display_name`, `input_credits_per_1k_tokens`, `output_credits_per_1k_tokens`, `sort_order`)
VALUES
  ('claude-opus-5',  'Claude Opus 5',   50, 250, 10),
  ('claude-sonnet-5','Claude Sonnet 5', 20, 100, 20),
  ('claude-haiku-4-5','Claude Haiku 4.5', 10,  50, 30)
ON DUPLICATE KEY UPDATE
  `display_name` = VALUES(`display_name`),
  `input_credits_per_1k_tokens` = VALUES(`input_credits_per_1k_tokens`),
  `output_credits_per_1k_tokens` = VALUES(`output_credits_per_1k_tokens`),
  `sort_order` = VALUES(`sort_order`);
