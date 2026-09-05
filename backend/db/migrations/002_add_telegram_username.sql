-- 002_add_telegram_username.sql
-- Telegram-имя пользователя для связи пассажира с водителем (кнопка «Написать в Telegram»)

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(50);
