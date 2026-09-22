-- ローカル開発用の初期データ。dev 専用でリモート環境には流さない。
-- ウォレットアドレスは Hardhat のローカルノードが配る既定アカウント #0 / #1。
INSERT INTO `accounts` (`id`, `wallet_address`, `display_name`, `credit_balance`) VALUES
  ('01JCHAT0000000000000ACC01', '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'ローカル開発者', 1000000),
  ('01JCHAT0000000000000ACC02', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 'テストユーザー', 0);

INSERT INTO `credit_ledger` (`id`, `account_id`, `kind`, `amount`, `balance_after`, `reference_type`, `reference_id`) VALUES
  ('01JCHAT0000000000000LED01', '01JCHAT0000000000000ACC01', 'adjust', 1000000, 1000000, NULL, NULL);

INSERT INTO `chat_rooms` (`id`, `account_id`, `title`, `model_id`, `system_prompt`, `message_count`, `anchored_message_count`) VALUES
  ('01JCHAT0000000000000ROOM1', '01JCHAT0000000000000ACC01', '最初の会話', 'claude-opus-5', NULL, 0, 0);
