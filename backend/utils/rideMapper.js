const yandexMaps = require('../services/yandexMaps');
const routeService = require('../services/routeService');

/**
 * Базовый SQL-запрос для выборки подробных данных поездки со всеми связями
 */
const BASE_RIDE_SELECT = `
    SELECT 
        r.id,
        r.driver_id,
        r.vehicle_id,
        r.parent_ride_id,
        r.description,
        r.tags,
        u.username as driver_username,
        u.first_name as driver_first_name,
        u.last_name as driver_last_name,
        u.phone as driver_phone,
        u.rating as driver_rating,
        u.avatar_url as driver_avatar_url,
        (
            SELECT COUNT(*)::int 
            FROM reviews rev 
            WHERE rev.reviewee_id = r.driver_id
        ) as driver_reviews_count,
        v.brand,
        NULL::text as model,
        v.color,
        v.license_plate as plate_number,
        v.brand as vehicle_brand,
        v.color as vehicle_color,
        v.license_plate as vehicle_license_plate,
        v.seats as vehicle_seats,
        r.departure_time,
        r.start_address,
        r.end_address,
        ST_X(r.start_point) as start_lon,
        ST_Y(r.start_point) as start_lat,
        ST_X(r.end_point) as end_lon,
        ST_Y(r.end_point) as end_lat,
        ROUND((ST_DistanceSphere(r.start_point, r.end_point) / 1000.0)::numeric, 2) as distance_km,
        r.base_price,
        r.total_seats,
        r.available_seats,
        r.status,
        r.ride_type,
        r.regular_days,
        r.distance_meters,
        r.duration_seconds,
        r.route_polyline,
        r.created_at,
        COUNT(*) OVER() AS full_count,
        COALESCE(
            (
                SELECT array_agg(m.passenger_id::text)
                FROM matches m
                WHERE m.ride_id = r.id AND m.status IN ('accepted', 'completed')
            ),
            ARRAY[]::text[]
        ) AS passenger_ids,
        COALESCE(
            (
                SELECT json_agg(
                    json_build_object(
                        'id', pu.id,
                        'name', COALESCE(pu.first_name, pu.username),
                        'username', pu.username,
                        'telegram', pu.username,
                        'phone', pu.phone,
                        'avatar_url', pu.avatar_url,
                        'selected_day', m.selected_day
                    )
                )
                FROM matches m
                JOIN users pu ON m.passenger_id = pu.id
                WHERE m.ride_id = r.id AND m.status IN ('accepted', 'completed')
            ),
            '[]'::json
        ) AS passengers
    FROM rides r
    LEFT JOIN users u ON r.driver_id = u.id
    LEFT JOIN vehicles v ON r.vehicle_id = v.id
`;

/**
 * Парсинг времени отправления (поддержка ISO строк или формата HH:MM)
 * @param {string|Date} timeInput - Входное время
 * @returns {Date} Корректный объект даты
 */
function parseDepartureTime(timeInput) {
    const fallback = new Date(Date.now() + 60 * 60 * 1000);
    if (!timeInput) {
        return fallback;
    }

    if (typeof timeInput === 'string' && /^\d{1,2}:\d{2}$/.test(timeInput.trim())) {
        const [hours, minutes] = timeInput.trim().split(':').map(Number);
        if (hours > 23 || minutes > 59) {
            return fallback;
        }
        const target = new Date();
        target.setHours(hours, minutes, 0, 0);
        if (target.getTime() < Date.now()) {
            target.setDate(target.getDate() + 1);
        }
        return target;
    }

    const parsed = new Date(timeInput);
    if (isNaN(parsed.getTime())) {
        return fallback;
    }
    return parsed;
}

/**
 * Извлечение и нормализация информации об автомобиле
 * @param {object} row - Строка БД
 * @returns {object|null} Нормализованные данные автомобиля
 */
function extractVehicleInfo(row) {
    const hasVehicleInfo = Boolean(
        row.vehicle_id ||
        row.brand ||
        row.model ||
        row.color ||
        row.plate_number ||
        row.vehicle_brand ||
        row.vehicle_color ||
        row.vehicle_license_plate
    );

    if (!hasVehicleInfo) {
        return null;
    }

    return {
        brand: row.brand || row.vehicle_brand || null,
        model: row.model || null,
        color: row.color || row.vehicle_color || null,
        plate_number: row.plate_number || row.vehicle_license_plate || row.license_plate || null
    };
}

/**
 * Извлечение списка пассажиров из строки БД
 * @param {any} passengersRaw - Исходное поле passengers
 * @returns {Array<object>} Список пассажиров
 */
function extractPassengers(passengersRaw) {
    if (Array.isArray(passengersRaw)) {
        return passengersRaw;
    }
    if (typeof passengersRaw === 'string') {
        try {
            return JSON.parse(passengersRaw);
        } catch {
            return [];
        }
    }
    return [];
}

/**
 * Определение координат полилинии поездки
 * @param {object} row - Строка БД
 * @returns {Array<[number, number]>} Массив точек координат
 */
function resolvePolylineCoordinates(row) {
    if (row.route_polyline?.coordinates) {
        return row.route_polyline.coordinates;
    }
    const startLon = Number(row.start_lon);
    const startLat = Number(row.start_lat);
    const endLon = Number(row.end_lon);
    const endLat = Number(row.end_lat);

    if (!isNaN(startLon) && !isNaN(startLat) && !isNaN(endLon) && !isNaN(endLat)) {
        return routeService.generateRoutePolyline(startLon, startLat, endLon, endLat);
    }
    return [];
}

/**
 * Преобразование строки БД в стандартизированный объект поездки с фиксированной ценой
 * @param {object} row - Данные поездки из БД
 * @returns {object|null} Форматированный объект поездки
 */
function mapRideRow(row) {
    if (!row) {
        return null;
    }

    const isPeak = yandexMaps.isPeakHour(row.departure_time);
    const distanceKm = Number(row.distance_km || 0);
    const passengerIds = Array.isArray(row.passenger_ids)
        ? row.passenger_ids.map(String)
        : [];
    const basePrice = Number(row.base_price || 0);
    const vehicle = extractVehicleInfo(row);
    const passengers = extractPassengers(row.passengers);
    const polyline = resolvePolylineCoordinates(row);

    const driverRating = row.driver_rating !== null && row.driver_rating !== undefined
        ? Number(row.driver_rating)
        : null;
    const reviewsCount = Number(row.driver_reviews_count || 0);

    return {
        id: row.id,
        driver_id: row.driver_id,
        vehicle_id: row.vehicle_id || null,
        vehicle: vehicle,
        brand: vehicle?.brand || null,
        model: vehicle?.model || null,
        color: vehicle?.color || null,
        plate_number: vehicle?.plate_number || null,
        driver_name: row.driver_first_name || row.driver_username || 'Водитель',
        driver_username: row.driver_username || null,
        driver_phone: row.driver_phone || null,
        driver_rating: driverRating,
        average_rating: driverRating,
        driver_reviews_count: reviewsCount,
        reviews_count: reviewsCount,
        description: row.description || null,
        tags: Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : []),
        parent_ride_id: row.parent_ride_id || null,
        driver_avatar_url: row.driver_avatar_url || null,
        departure_time: row.departure_time,
        start_address: row.start_address || null,
        end_address: row.end_address || null,
        start_coords: { lon: Number(row.start_lon), lat: Number(row.start_lat) },
        end_coords: { lon: Number(row.end_lon), lat: Number(row.end_lat) },
        start_lon: Number(row.start_lon),
        start_lat: Number(row.start_lat),
        end_lon: Number(row.end_lon),
        end_lat: Number(row.end_lat),
        distance_km: distanceKm,
        distance_meters: row.distance_meters !== null && row.distance_meters !== undefined
            ? Number(row.distance_meters)
            : Math.round(distanceKm * 1000),
        duration_seconds: row.duration_seconds !== null && row.duration_seconds !== undefined
            ? Number(row.duration_seconds)
            : null,
        route_polyline: row.route_polyline || null,
        is_peak: isPeak,
        base_price: basePrice,
        price: basePrice,
        current_price: basePrice,
        passenger_ids: passengerIds,
        passengers: passengers,
        total_seats: row.total_seats,
        available_seats: row.available_seats,
        status: row.status,
        ride_type: row.ride_type || 'one_off',
        regular_days: row.regular_days || null,
        polyline: polyline,
        created_at: row.created_at
    };
}

module.exports = {
    BASE_RIDE_SELECT,
    parseDepartureTime,
    mapRideRow
};
