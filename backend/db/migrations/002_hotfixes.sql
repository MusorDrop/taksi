-- 002_hotfixes.sql
-- Миграция: исправление схемы БД (добавление роли 'admin', обновление допустимых статусов поездок, удаление неиспользуемых GiST индексов)

-- 1. Добавление значения 'admin' в перечисление user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. Обновление CHECK-ограничения rides_status_check для таблицы rides
-- Включает 'scheduled' наряду с 'planned', 'active', 'completed', 'cancelled'
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check;
ALTER TABLE rides ADD CONSTRAINT rides_status_check 
    CHECK (status IN ('planned', 'active', 'completed', 'cancelled', 'scheduled'));

-- 3. Удаление устаревших/неиспользуемых пространственных индексов GEOMETRY
-- Запросы к БД используют функциональные индексы по географии (idx_rides_start_point_geog, idx_rides_end_point_geog)
DROP INDEX IF EXISTS idx_rides_start_point;
DROP INDEX IF EXISTS idx_rides_end_point;
