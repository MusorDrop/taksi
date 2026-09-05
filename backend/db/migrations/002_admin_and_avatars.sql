-- 002_admin_and_avatars.sql
-- Миграция базы данных: добавление полей для аватарок и блокировки пользователей

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT, 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
