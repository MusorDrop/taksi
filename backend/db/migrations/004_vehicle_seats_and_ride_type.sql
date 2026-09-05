-- 004_vehicle_seats_and_ride_type.sql
-- Миграция базы данных: добавление мест для автомобилей и параметров регулярных поездок

-- 1. Добавление количества мест в таблицу автомобилей (по умолчанию 4)
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS seats INTEGER NOT NULL DEFAULT 4;

-- 2. Добавление типа поездки и регулярных дней в таблицу поездок
ALTER TABLE rides 
ADD COLUMN IF NOT EXISTS ride_type VARCHAR(20) DEFAULT 'one_off',
ADD COLUMN IF NOT EXISTS regular_days VARCHAR(255);
