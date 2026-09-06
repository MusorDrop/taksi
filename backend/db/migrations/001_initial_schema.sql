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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_vehicles_license_plate UNIQUE (license_plate),
    CONSTRAINT chk_vehicles_seats CHECK (seats >= 1 AND seats <= 8)
);

-- Таблица поездок
CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    parent_ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    start_point GEOMETRY(Point, 4326) NOT NULL,
    end_point GEOMETRY(Point, 4326) NOT NULL,
    route_line GEOMETRY(LineString, 4326),
    total_seats INTEGER NOT NULL DEFAULT 4,
    available_seats INTEGER NOT NULL DEFAULT 4,
    status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    base_price NUMERIC(10, 2) NOT NULL,
    ride_type VARCHAR(20) DEFAULT 'one_off',
    regular_days VARCHAR(255),
    distance_meters INT,
    duration_seconds INT,
    route_polyline JSONB,
    description TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rides_available_seats CHECK (available_seats >= 0 AND available_seats <= total_seats),
    CONSTRAINT chk_rides_base_price CHECK (base_price > 0)
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

-- Таблица экземпляров регулярных поездок (для отслеживания конкретных дат запуска)
CREATE TABLE IF NOT EXISTS ride_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    instance_ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ride_instance_date UNIQUE (ride_id, date)
);

-- Таблица отзывов и оценок
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reviews_ride_reviewer_reviewee UNIQUE (ride_id, reviewer_id, reviewee_id)
);

-- Таблица кэша геокодирования
DROP TABLE IF EXISTS geocode_cache CASCADE;
CREATE TABLE IF NOT EXISTS geocode_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address_query TEXT NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    full_address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_geocode_cache_address_query ON geocode_cache(address_query);

-- Базовые индексы для ускорения поиска и гео-запросов
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_departure_time ON rides(departure_time);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_parent_ride_id ON rides(parent_ride_id);
CREATE INDEX IF NOT EXISTS idx_rides_start_point ON rides USING GIST (start_point);
CREATE INDEX IF NOT EXISTS idx_rides_end_point ON rides USING GIST (end_point);

CREATE INDEX IF NOT EXISTS idx_matches_ride_id ON matches(ride_id);
CREATE INDEX IF NOT EXISTS idx_matches_passenger_id ON matches(passenger_id);
CREATE INDEX IF NOT EXISTS idx_reviews_ride_id ON reviews(ride_id);

CREATE INDEX IF NOT EXISTS idx_ride_instances_ride_id ON ride_instances(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_instances_instance_ride_id ON ride_instances(instance_ride_id);

-- Индексы производительности
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);
CREATE INDEX IF NOT EXISTS idx_matches_ride_id_status ON matches(ride_id, status);
CREATE INDEX IF NOT EXISTS idx_rides_status_departure_time ON rides(status, departure_time);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_vehicle_id ON rides(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_ride_reviewer_reviewee ON reviews(ride_id, reviewer_id, reviewee_id);
