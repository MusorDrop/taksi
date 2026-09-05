-- 001_initial_schema.sql
-- Начальная схема базы данных для сервиса совместных поездок (Попутка ИИ)

-- Подключение необходимых расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Перечисления (ENUM types)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('driver', 'passenger', 'both');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ride_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


DO $$ BEGIN
    CREATE TYPE match_status AS ENUM ('accepted', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'both',
    rating NUMERIC(3, 2) DEFAULT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
    avatar_url TEXT,
    is_blocked BOOLEAN DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_contact VARCHAR(255),
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Таблица транспортных средств
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand VARCHAR(150) NOT NULL,
    color VARCHAR(50),
    license_plate VARCHAR(20) NOT NULL,
    seats INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Таблица поездок
CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    start_point GEOMETRY(Point, 4326) NOT NULL,
    end_point GEOMETRY(Point, 4326) NOT NULL,
    route_line GEOMETRY(LineString, 4326),
    total_seats INTEGER NOT NULL DEFAULT 4,
    available_seats INTEGER NOT NULL DEFAULT 4,
    status ride_status NOT NULL DEFAULT 'scheduled',
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    ride_type VARCHAR(20) DEFAULT 'one_off',
    regular_days VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rides_available_seats CHECK (available_seats >= 0 AND available_seats <= total_seats)
);

-- Таблица совпадений (бронирований поездок)
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pickup_point GEOMETRY(Point, 4326),
    dropoff_point GEOMETRY(Point, 4326),
    agreed_price NUMERIC(10, 2) NOT NULL,
    status match_status NOT NULL DEFAULT 'accepted',
    selected_day VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_matches_ride_passenger UNIQUE (ride_id, passenger_id)
);

-- Таблица отзывов и оценок
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Базовые индексы для ускорения поиска и гео-запросов
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_departure_time ON rides(departure_time);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_start_point ON rides USING GIST (start_point);
CREATE INDEX IF NOT EXISTS idx_rides_end_point ON rides USING GIST (end_point);

CREATE INDEX IF NOT EXISTS idx_matches_ride_id ON matches(ride_id);
CREATE INDEX IF NOT EXISTS idx_matches_passenger_id ON matches(passenger_id);
CREATE INDEX IF NOT EXISTS idx_reviews_ride_id ON reviews(ride_id);

-- Индексы производительности (из бывшей миграции 003)
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

-- Обеспечение наличия ограничений для ранее созданных таблиц (идемпотентный ALTER)
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT chk_users_rating CHECK (rating >= 1.0 AND rating <= 5.0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE rides ADD CONSTRAINT chk_rides_available_seats CHECK (available_seats >= 0 AND available_seats <= total_seats);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE matches ADD CONSTRAINT uq_matches_ride_passenger UNIQUE (ride_id, passenger_id);
EXCEPTION
    WHEN duplicate_object OR duplicate_table THEN null;
END $$;


