-- 002_vehicles.sql
-- Создание таблицы автомобилей и добавление внешнего ключа в rides

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    brand VARCHAR NOT NULL,
    color VARCHAR,
    license_plate VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Обеспечение соответствия структуры колонок таблицы vehicles и rides
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'driver_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'owner_id') THEN
            ALTER TABLE vehicles RENAME COLUMN owner_id TO driver_id;
        ELSE
            ALTER TABLE vehicles ADD COLUMN driver_id UUID REFERENCES users(id) ON DELETE CASCADE;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'brand') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'make_model') THEN
            ALTER TABLE vehicles RENAME COLUMN make_model TO brand;
        ELSE
            ALTER TABLE vehicles ADD COLUMN brand VARCHAR NOT NULL DEFAULT '';
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'license_plate') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'plate_number') THEN
            ALTER TABLE vehicles RENAME COLUMN plate_number TO license_plate;
        ELSE
            ALTER TABLE vehicles ADD COLUMN license_plate VARCHAR NOT NULL DEFAULT '';
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'created_at') THEN
        ALTER TABLE vehicles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'vehicle_id') THEN
        ALTER TABLE rides ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
    END IF;
END $$;
