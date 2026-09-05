-- 003_performance_indexes.sql
-- Миграция базы данных: добавление индексов производительности для оптимизации запросов и внешних ключей

-- 1. Индекс на колонку is_blocked для быстрого поиска и проверки блокировки пользователей
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);

-- 2. Составной индекс для оптимизации агрегации пассажиров в rideController (array_agg в getRides, joinRide, leaveRide)
CREATE INDEX IF NOT EXISTS idx_matches_ride_id_status ON matches(ride_id, status);

-- 3. Составной индекс для быстрого поиска поездок по статусу и времени отправления с поддержкой сортировки
CREATE INDEX IF NOT EXISTS idx_rides_status_departure_time ON rides(status, departure_time);

-- 4. Индексы на внешние ключи (Foreign Keys) для предотвращения Seq Scan и ускорения JOIN / каскадных операций
CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_vehicle_id ON rides(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
