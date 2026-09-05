-- 003_telegram_username_unique.sql
-- Telegram username уникален среди заполнивших его пользователей
-- (в Telegram имя пользователя глобально уникально; NULL разрешён сколько угодно раз)

CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_username_key
    ON users (telegram_username)
    WHERE telegram_username IS NOT NULL;
