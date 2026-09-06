const pool = require('../db');
const yandexMaps = require('../services/yandexMaps');

// Известные координаты ключевых локаций Екатеринбурга (lon: долгота, lat: широта)
const KNOWN_LOCATIONS = {
    'уралмаш': { lon: 60.5975, lat: 56.8885, name: 'Уралмаш' },
    'новокольцовский': { lon: 60.7712, lat: 56.7686, name: 'Кампус Новокольцовский' },
    'кампус': { lon: 60.7712, lat: 56.7686, name: 'Кампус Новокольцовский' },
    'центр': { lon: 60.6057, lat: 56.8389, name: 'Центр' },
    'урфу': { lon: 60.6534, lat: 56.8439, name: 'Главный корпус УрФУ' },
    'мира': { lon: 60.6534, lat: 56.8439, name: 'Мира 19' },
    'втузгородок': { lon: 60.6530, lat: 56.8430, name: 'Втузгородок' },
    'академический': { lon: 60.5186, lat: 56.7865, name: 'Академический' },
    'жби': { lon: 60.6860, lat: 56.8285, name: 'ЖБИ' },
    'вокзал': { lon: 60.6054, lat: 56.8584, name: 'Ж/Д Вокзал' },
    'ботаника': { lon: 60.6310, lat: 56.7970, name: 'Ботаника' },
    'юго-западный': { lon: 60.5530, lat: 56.8040, name: 'Юго-Западный' },
    'пионерский': { lon: 60.6380, lat: 56.8610, name: 'Пионерский' },
    'эльмаш': { lon: 60.6320, lat: 56.8920, name: 'Эльмаш' },
    'виз': { lon: 60.5400, lat: 56.8360, name: 'ВИЗ' },
    'сортировка': { lon: 60.5280, lat: 56.8720, name: 'Сортировка' },
    'химмаш': { lon: 60.6720, lat: 56.7450, name: 'Химмаш' },
    'библиотека': { lon: 60.6130, lat: 56.8340, name: 'Центральная библиотека' }
};

const DEFAULT_START = { lon: 60.5975, lat: 56.8885, name: 'Уралмаш' };
const DEFAULT_END = { lon: 60.7712, lat: 56.7686, name: 'Новокольцовский' };

// Регулярное выражение для валидации UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Валидация формата UUID
 * @param {string} id - Проверяемый идентификатор
 * @returns {boolean} true, если id является корректным UUID
 */
function isValidUuid(id) {
    return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * Определение координат точки по переданному объекту, координатам или названию
 * @param {any} input - Входное значение точки (строка или объект с координатами)
 * @param {object} fallback - Координаты по умолчанию
 * @returns {{lon: number, lat: number, name: string}}
 */
function resolvePointCoordinates(input, fallback) {
    if (!input) {
        return fallback;
    }

    if (typeof input === 'object') {
        const lon = Number(input.lon ?? input.lng ?? input.x ?? input.longitude);
        const lat = Number(input.lat ?? input.y ?? input.latitude);
        if (!isNaN(lon) && !isNaN(lat)) {
            return { lon, lat, name: input.name || 'Точка на карте' };
        }
    }

    if (typeof input === 'string') {
        const lower = input.toLowerCase().trim();
        for (const [key, value] of Object.entries(KNOWN_LOCATIONS)) {
            if (lower.includes(key)) {
                return { ...value, name: input.trim() };
            }
        }
        return { ...fallback, name: input.trim() };
    }

    return fallback;
}

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
        if (hours > 23 || minutes > 59) return fallback;
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
 * Извлечение ID пользователя строго из токена авторизации
 * @param {object} req - Express запрос
 * @returns {string|null} ID пользователя
 */
function extractUserId(req) {
    if (req.user && req.user.id) {
        return req.user.id;
    }
    return null;
}

/**
 * Определение, попадает ли время отправления в часы пик
 * Часы пик: с 07:30 до 09:30 и с 17:00 до 19:00 (время Екатеринбурга)
 * @param {Date|string} dateInput - Время отправления
 * @returns {boolean} true, если время в интервале часа пик
 */
function isPeakHour(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) {
        return false;
    }

    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: process.env.APP_TIMEZONE || 'Asia/Yekaterinburg',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour');
    const minutePart = parts.find((p) => p.type === 'minute');

    if (!hourPart || !minutePart) {
        return false;
    }

    const hours = parseInt(hourPart.value, 10);
    const minutes = parseInt(minutePart.value, 10);
    const totalMinutes = hours * 60 + minutes;

    // Утренний час пик: с 07:30 (450 мин) до 09:30 (570 мин)
    const isMorningPeak = totalMinutes >= 450 && totalMinutes <= 570;
    // Вечерний час пик: с 17:00 (1020 мин) до 19:00 (1140 мин)
    const isEveningPeak = totalMinutes >= 1020 && totalMinutes <= 1140;

    return isMorningPeak || isEveningPeak;
}

/**
 * Расчет расстояния между двумя точками в километрах через PostGIS
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @param {number} startLon - Долгота отправления
 * @param {number} startLat - Широта отправления
 * @param {number} endLon - Долгота назначения
 * @param {number} endLat - Широта назначения
 * @returns {Promise<number>} Дистанция в километрах
 */
async function calculateDistanceKm(client, startLon, startLat, endLon, endLat) {
    const query = `
        SELECT ST_DistanceSphere(
            ST_SetSRID(ST_MakePoint($1, $2), 4326),
            ST_SetSRID(ST_MakePoint($3, $4), 4326)
        ) as distance_meters
    `;
    const res = await client.query(query, [startLon, startLat, endLon, endLat]);
    const meters = parseFloat(res.rows[0]?.distance_meters) || 0;
    return Math.round((meters / 1000) * 100) / 100;
}

/**
 * Расчет базовой стоимости поездки: Дистанция (км) * 6 руб (с коэффициентом 1.3 в часы пик)
 * @param {number} distanceKm - Дистанция поездки в километрах
 * @param {boolean} isPeak - Флаг часа пик
 * @returns {number} Рассчитанная цена
 */
function calculateBasePrice(distanceKm, isPeak) {
    const ratePerKm = 6;
    const peakMultiplier = isPeak ? 1.3 : 1.0;
    const price = distanceKm * ratePerKm * peakMultiplier;
    return Math.round(price * 100) / 100;
}

/**
 * Валидация и парсинг радиуса поиска в метрах
 * @param {string|number|undefined} radiusInput - Значение радиуса
 * @returns {{radius: number, error: string|null}}
 */
function parseSearchRadius(radiusInput) {
    if (radiusInput === undefined || radiusInput === null || String(radiusInput).trim() === '') {
        return { radius: 1000, error: null };
    }
    const num = Number(radiusInput);
    if (isNaN(num) || num <= 0) {
        return { radius: 0, error: 'Параметр radius должен быть положительным числом' };
    }
    return { radius: num, error: null };
}

/**
 * Валидация пары координат широты и долготы
 * @param {any} latVal - Широта
 * @param {any} lonVal - Долгота
 * @param {string} pointName - Название точки для сообщения об ошибке
 * @returns {{point: {lat: number, lon: number}|null, error: string|null}}
 */
function validateCoordinates(latVal, lonVal, pointName) {
    const hasLat = latVal !== undefined && latVal !== null && String(latVal).trim() !== '';
    const hasLon = lonVal !== undefined && lonVal !== null && String(lonVal).trim() !== '';

    if (!hasLat && !hasLon) {
        return { point: null, error: null };
    }

    if (!hasLat || !hasLon) {
        return { point: null, error: `Для ${pointName} необходимо передать как широту (lat), так и долготу (lon)` };
    }

    const lat = Number(latVal);
    const lon = Number(lonVal);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return { point: null, error: `Параметры ${pointName} должны содержать корректные географические координаты` };
    }

    return { point: { lat, lon }, error: null };
}

/**
 * Преобразование строки БД в стандартизированный объект поездки с фиксированной ценой
 * @param {object} row - Данные поездки из БД
 * @returns {object} Форматированный объект поездки
 */
function mapRideRow(row) {
    const isPeak = isPeakHour(row.departure_time);
    const distanceKm = Number(row.distance_km || 0);
    const passengerIds = Array.isArray(row.passenger_ids)
        ? row.passenger_ids.map(String)
        : [];
    const basePrice = Number(row.base_price || 0);
    const currentPrice = basePrice;

    let passengers = [];
    if (Array.isArray(row.passengers)) {
        passengers = row.passengers;
    } else if (typeof row.passengers === 'string') {
        try {
            passengers = JSON.parse(row.passengers);
        } catch {
            passengers = [];
        }
    }

    return {
        id: row.id,
        driver_id: row.driver_id,
        vehicle_id: row.vehicle_id || null,
        driver_name: row.driver_first_name || row.driver_username || 'Водитель',
        driver_username: row.driver_username || null,
        driver_phone: row.driver_phone || null,
        driver_rating: row.driver_rating !== null && row.driver_rating !== undefined ? Number(row.driver_rating) : null,
        average_rating: row.driver_rating !== null && row.driver_rating !== undefined ? Number(row.driver_rating) : null,
        driver_reviews_count: Number(row.driver_reviews_count || 0),
        reviews_count: Number(row.driver_reviews_count || 0),
        description: row.description || null,
        tags: Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : []),
        parent_ride_id: row.parent_ride_id || null,
        driver_avatar_url: row.driver_avatar_url || null,
        departure_time: row.departure_time,
        start_coords: { lon: Number(row.start_lon), lat: Number(row.start_lat) },
        end_coords: { lon: Number(row.end_lon), lat: Number(row.end_lat) },
        start_lon: Number(row.start_lon),
        start_lat: Number(row.start_lat),
        end_lon: Number(row.end_lon),
        end_lat: Number(row.end_lat),
        distance_km: distanceKm,
        distanceKm: distanceKm,
        distance_meters: row.distance_meters !== null && row.distance_meters !== undefined ? Number(row.distance_meters) : Math.round(distanceKm * 1000),
        duration_seconds: row.duration_seconds !== null && row.duration_seconds !== undefined ? Number(row.duration_seconds) : null,
        route_polyline: row.route_polyline || null,
        is_peak: isPeak,
        isPeak: isPeak,
        base_price: basePrice,
        price: basePrice,
        current_price: currentPrice,
        currentPrice: currentPrice,
        passenger_ids: passengerIds,
        passengerIds: passengerIds,
        passengers: passengers,
        total_seats: row.total_seats,
        available_seats: row.available_seats,
        status: row.status,
        ride_type: row.ride_type || 'one_off',
        regular_days: row.regular_days || null,
        polyline: row.route_polyline?.coordinates || ((!isNaN(Number(row.start_lon)) && !isNaN(Number(row.end_lon)))
            ? generateRoutePolyline(Number(row.start_lon), Number(row.start_lat), Number(row.end_lon), Number(row.end_lat))
            : []),
        created_at: row.created_at
    };
}

/**
 * Создание новой поездки
 * POST /api/rides
 */
async function createRide(req, res) {
    const driverId = extractUserId(req);
    if (!driverId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const rawStart = req.body.start_point || req.body.from || (
        req.body.start_lat !== undefined && req.body.start_lon !== undefined
            ? { lat: req.body.start_lat, lon: req.body.start_lon }
            : null
    );
    let startCoords;
    if (typeof rawStart === 'string') {
        const geocoded = await yandexMaps.geocodeAddress(rawStart);
        startCoords = { lon: geocoded.longitude, lat: geocoded.latitude, name: geocoded.full_address };
    } else {
        startCoords = resolvePointCoordinates(rawStart, DEFAULT_START);
    }

    const rawEnd = req.body.end_point || req.body.to || (
        req.body.end_lat !== undefined && req.body.end_lon !== undefined
            ? { lat: req.body.end_lat, lon: req.body.end_lon }
            : null
    );
    let endCoords;
    if (typeof rawEnd === 'string') {
        const geocoded = await yandexMaps.geocodeAddress(rawEnd);
        endCoords = { lon: geocoded.longitude, lat: geocoded.latitude, name: geocoded.full_address };
    } else {
        endCoords = resolvePointCoordinates(rawEnd, DEFAULT_END);
    }

    if (typeof rawStart === 'string' && typeof rawEnd === 'string' && rawStart.trim().toLowerCase() === rawEnd.trim().toLowerCase()) {
        return res.status(400).json({ error: 'Точки отправления и назначения не могут совпадать (нулевая дистанция)' });
    }
    if (startCoords.lat === endCoords.lat && startCoords.lon === endCoords.lon) {
        return res.status(400).json({ error: 'Точки отправления и назначения не могут совпадать (нулевая дистанция)' });
    }

    const vehicleId = req.body.vehicle_id || null;
    if (vehicleId && !isValidUuid(vehicleId)) {
        return res.status(400).json({ error: 'Некорректный формат vehicle_id' });
    }

    const departureTime = parseDepartureTime(req.body.departure_time || req.body.time);
    // 🔵-7: Валидация даты отправления (поездка не может быть запланирована в прошлом)
    if (departureTime.getTime() < Date.now() - 60000) {
        return res.status(400).json({ error: 'Время отправления не может быть в прошлом' });
    }
    const totalSeats = Math.min(8, Math.max(1, parseInt(req.body.total_seats || 4, 10)));
    const availableSeats = Math.min(totalSeats, Math.max(0, parseInt(req.body.available_seats !== undefined ? req.body.available_seats : totalSeats, 10)));

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const driverCheck = await client.query(
            'SELECT id, username, first_name, last_name, phone, rating, avatar_url FROM users WHERE id = $1',
            [driverId]
        );
        if (driverCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Водитель с указанным ID не найден в базе данных' });
        }

        if (vehicleId) {
            const vehicleCheck = await client.query(
                'SELECT id FROM vehicles WHERE id = $1 AND driver_id = $2',
                [vehicleId, driverId]
            );
            if (vehicleCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Указанный автомобиль не найден или не принадлежит водителю' });
            }
        }

        // Построение реального маршрута и расчет цены через сервис yandexMaps
        const routeData = await yandexMaps.buildRoute(startCoords, endCoords);
        if (!routeData.distance_meters || routeData.distance_meters <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Точки отправления и назначения не могут совпадать (нулевая дистанция)' });
        }

        const calculatedPricing = yandexMaps.calculateTripPrice(
            routeData.distance_meters,
            routeData.duration_seconds,
            departureTime
        );

        let basePrice;
        const hasCustomPrice = (req.body.base_price !== undefined && req.body.base_price !== null && String(req.body.base_price).trim() !== '') ||
                               (req.body.price !== undefined && req.body.price !== null && String(req.body.price).trim() !== '');

        if (hasCustomPrice) {
            const rawVal = req.body.base_price !== undefined ? req.body.base_price : req.body.price;
            const parsedVal = parseFloat(rawVal);
            if (isNaN(parsedVal) || parsedVal <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Стоимость поездки должна быть больше 0' });
            }
            basePrice = Math.round(parsedVal * 100) / 100;
        } else {
            basePrice = calculatedPricing.base_price;
        }

        if (!basePrice || basePrice <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Стоимость поездки должна быть больше 0' });
        }

        const rideType = req.body.ride_type === 'regular' ? 'regular' : 'one_off';
        const regularDays = rideType === 'regular'
            ? (Array.isArray(req.body.regular_days) ? req.body.regular_days.join(',') : (typeof req.body.regular_days === 'string' ? req.body.regular_days.trim() : null))
            : null;

        const description = typeof req.body.description === 'string' && req.body.description.trim().length > 0
            ? req.body.description.trim()
            : null;
        let tags = [];
        if (Array.isArray(req.body.tags)) {
            tags = req.body.tags.map((t) => String(t).trim()).filter(Boolean);
        } else if (typeof req.body.tags === 'string' && req.body.tags.trim().length > 0) {
            tags = req.body.tags.split(',').map((t) => t.trim()).filter(Boolean);
        }

        const insertQuery = `
            INSERT INTO rides (
                driver_id,
                vehicle_id,
                departure_time,
                start_point,
                end_point,
                base_price,
                total_seats,
                available_seats,
                status,
                ride_type,
                regular_days,
                distance_meters,
                duration_seconds,
                route_polyline,
                description,
                tags
            ) VALUES (
                $1,
                $2,
                $3,
                ST_SetSRID(ST_MakePoint($4, $5), 4326),
                ST_SetSRID(ST_MakePoint($6, $7), 4326),
                $8,
                $9,
                $10,
                'planned',
                $11,
                $12,
                $13,
                $14,
                $15,
                $16,
                $17
            )
            RETURNING 
                id,
                driver_id,
                vehicle_id,
                parent_ride_id,
                departure_time,
                ST_X(start_point) as start_lon,
                ST_Y(start_point) as start_lat,
                ST_X(end_point) as end_lon,
                ST_Y(end_point) as end_lat,
                ROUND((ST_DistanceSphere(start_point, end_point) / 1000.0)::numeric, 2) as distance_km,
                base_price,
                total_seats,
                available_seats,
                status,
                ride_type,
                regular_days,
                distance_meters,
                duration_seconds,
                route_polyline,
                description,
                tags,
                created_at
        `;

        const result = await client.query(insertQuery, [
            driverId,
            vehicleId,
            departureTime,
            startCoords.lon,
            startCoords.lat,
            endCoords.lon,
            endCoords.lat,
            basePrice,
            totalSeats,
            availableSeats,
            rideType,
            regularDays,
            routeData.distance_meters,
            routeData.duration_seconds,
            JSON.stringify(routeData.route_polyline),
            description,
            tags
        ]);

        await client.query('COMMIT');

        const driverInfo = driverCheck.rows[0];
        const combinedRow = {
            ...result.rows[0],
            driver_username: driverInfo.username,
            driver_first_name: driverInfo.first_name,
            driver_last_name: driverInfo.last_name,
            driver_phone: driverInfo.phone,
            driver_rating: driverInfo.rating,
            driver_avatar_url: driverInfo.avatar_url || null,
            passenger_ids: [],
            passengers: []
        };

        const mappedRide = mapRideRow(combinedRow);

        return res.status(201).json({
            message: 'Поездка успешно создана',
            ride: mappedRide,
            current_price: mappedRide.current_price
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания поездки:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при создании поездки' });
    } finally {
        client.release();
    }
}

/**
 * Получение списка поездок с поддержкой гео-фильтрации
 * GET /api/rides
 */
async function getRides(req, res) {
    const { start_lat, start_lon, end_lat, end_lon, radius, departure_time, time, status } = req.query;

    const radiusResult = parseSearchRadius(radius);
    if (radiusResult.error) {
        return res.status(400).json({ error: radiusResult.error });
    }
    const searchRadius = radiusResult.radius;

    const startCheck = validateCoordinates(start_lat, start_lon, 'точки посадки (start)');
    if (startCheck.error) {
        return res.status(400).json({ error: startCheck.error });
    }

    const endCheck = validateCoordinates(end_lat, end_lon, 'точки высадки (end)');
    if (endCheck.error) {
        return res.status(400).json({ error: endCheck.error });
    }

    const conditions = [];
    const params = [];

    if (status) {
        if (status !== 'all') {
            params.push(status);
            conditions.push(`r.status = $${params.length}`);
        }
    } else {
        conditions.push("r.status IN ('planned', 'scheduled')");
    }

    // Фильтр по времени отправления
    if (departure_time || time) {
        const parsedTime = parseDepartureTime(departure_time || time);
        params.push(parsedTime);
        conditions.push(`r.departure_time >= $${params.length}`);
    } else {
        conditions.push('r.departure_time > NOW()');
    }

    // Гео-фильтр по точке отправления водителя относительно точки посадки пассажира
    if (startCheck.point) {
        params.push(startCheck.point.lon);
        params.push(startCheck.point.lat);
        params.push(searchRadius);
        const lonIdx = params.length - 2;
        const latIdx = params.length - 1;
        const radIdx = params.length;
        conditions.push(`ST_DWithin(r.start_point::geography, ST_SetSRID(ST_MakePoint($${lonIdx}, $${latIdx}), 4326)::geography, $${radIdx})`);
    }

    // Гео-фильтр по точке назначения водителя относительно точки высадки пассажира
    if (endCheck.point) {
        params.push(endCheck.point.lon);
        params.push(endCheck.point.lat);
        params.push(searchRadius);
        const lonIdx = params.length - 2;
        const latIdx = params.length - 1;
        const radIdx = params.length;
        conditions.push(`ST_DWithin(r.end_point::geography, ST_SetSRID(ST_MakePoint($${lonIdx}, $${latIdx}), 4326)::geography, $${radIdx})`);
    }

    const whereClause = conditions.join(' AND ');
    const selectQuery = `
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
            r.departure_time,
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
        WHERE ${whereClause}
        ORDER BY r.departure_time ASC
        LIMIT 50
    `;

    try {
        const result = await pool.query(selectQuery, params);
        const rides = result.rows.map(mapRideRow);

        return res.json({ count: rides.length, rides });
    } catch (err) {
        console.error('Ошибка получения списка поездок:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при получении списка поездок' });
    }
}

/** Алиас для соответствия спецификации */
const getAllRides = getRides;

/**
 * Присоединение пассажира к поездке
 * POST /api/rides/:id/join
 */
async function joinRide(req, res) {
    const rideId = req.params.id;
    if (!isValidUuid(rideId)) {
        return res.status(400).json({ error: 'Некорректный формат идентификатора поездки (UUID)' });
    }

    const passengerId = extractUserId(req);
    if (!passengerId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const selectedDay = req.body?.selected_day || req.body?.selectedDay || null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Проверка существования поездки
        const rideCheck = await client.query(
            'SELECT id, driver_id, status, available_seats, total_seats, base_price, ride_type, regular_days FROM rides WHERE id = $1 FOR UPDATE',
            [rideId]
        );
        if (rideCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        const ride = rideCheck.rows[0];

        // Проверка статуса поездки (если поездка началась или завершена, пассажирам больше нельзя в нее вступать)
        if (ride.status !== 'planned' && ride.status !== 'scheduled') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Присоединиться можно только к запланированной поездке' });
        }

        // Водитель не может присоединиться к своей поездке
        if (ride.driver_id === passengerId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Водитель не может присоединиться к собственной поездке' });
        }

        // Проверка наличия свободных мест
        if (ride.available_seats <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'В поездке нет свободных мест' });
        }

        // Проверка повторного присоединения
        const matchCheck = await client.query(
            'SELECT id FROM matches WHERE ride_id = $1 AND passenger_id = $2 AND status = $3',
            [rideId, passengerId, 'accepted']
        );
        if (matchCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Вы уже присоединились к этой поездке' });
        }

        // Декремент доступных мест
        const updateRideRes = await client.query(
            'UPDATE rides SET available_seats = available_seats - 1 WHERE id = $1 RETURNING available_seats',
            [rideId]
        );

        // Создание записи в таблице matches
        const insertMatchQuery = `
            INSERT INTO matches (ride_id, passenger_id, agreed_price, status, selected_day)
            VALUES ($1, $2, $3, 'accepted', $4)
            RETURNING *
        `;
        const matchRes = await client.query(insertMatchQuery, [rideId, passengerId, ride.base_price, selectedDay]);

        // Получение актуального списка пассажиров
        const passengersRes = await client.query(`
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
            ) as passengers,
            array_agg(m.passenger_id::text) as passenger_ids
            FROM matches m
            JOIN users pu ON m.passenger_id = pu.id
            WHERE m.ride_id = $1 AND m.status = 'accepted'
        `, [rideId]);

        const passenger_ids = passengersRes.rows[0]?.passenger_ids || [];
        const passengers = passengersRes.rows[0]?.passengers || [];
        const current_price = Number(ride.base_price);

        await client.query('COMMIT');

        return res.status(201).json({
            message: 'Вы успешно присоединились к поездке',
            match: matchRes.rows[0],
            available_seats: updateRideRes.rows[0].available_seats,
            current_price,
            passenger_ids,
            passengers
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка присоединения к поездке:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при присоединении к поездке' });
    } finally {
        client.release();
    }
}

/**
 * Отмена участия пассажира в поездке
 * POST /api/rides/:id/leave
 */
async function leaveRide(req, res) {
    const rideId = req.params.id;
    if (!isValidUuid(rideId)) {
        return res.status(400).json({ error: 'Некорректный формат идентификатора поездки (UUID)' });
    }

    const passengerId = extractUserId(req);
    if (!passengerId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Проверка существования поездки
        const rideCheck = await client.query(
            'SELECT id, driver_id, status, available_seats, total_seats, base_price FROM rides WHERE id = $1 FOR UPDATE',
            [rideId]
        );
        if (rideCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        const ride = rideCheck.rows[0];

        // Проверка статуса поездки
        if (ride.status !== 'planned' && ride.status !== 'scheduled') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Отменить участие можно только в запланированной поездке' });
        }

        // Атомарное удаление бронирования во избежание состояния гонки (Race Condition)
        const deleteRes = await client.query(
            "DELETE FROM matches WHERE ride_id = $1 AND passenger_id = $2 AND status = 'accepted' RETURNING id",
            [rideId, passengerId]
        );

        if (deleteRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Бронирование пассажира для данной поездки не найдено' });
        }

        // Инкремент свободных мест только при успешном удалении
        const updateRideRes = await client.query(
            'UPDATE rides SET available_seats = LEAST(total_seats, available_seats + 1) WHERE id = $1 RETURNING available_seats',
            [rideId]
        );

        // Получение актуального списка пассажиров после отмены участия
        const passengersRes = await client.query(`
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
            ) as passengers,
            array_agg(m.passenger_id::text) as passenger_ids
            FROM matches m
            JOIN users pu ON m.passenger_id = pu.id
            WHERE m.ride_id = $1 AND m.status = 'accepted'
        `, [rideId]);

        const passenger_ids = passengersRes.rows[0]?.passenger_ids || [];
        const passengers = passengersRes.rows[0]?.passengers || [];
        const current_price = Number(ride.base_price);

        await client.query('COMMIT');

        return res.json({
            message: 'Вы успешно отменили участие в поездке',
            available_seats: updateRideRes.rows[0]?.available_seats,
            current_price,
            passenger_ids,
            passengers
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка отмены поездки:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при выходе из поездки' });
    } finally {
        client.release();
    }
}

/**
 * Редактирование поездки (только создатель)
 * PATCH /api/rides/:id
 */
async function updateRide(req, res) {
    const rideId = req.params.id;
    if (!isValidUuid(rideId)) {
        return res.status(400).json({ error: 'Некорректный формат идентификатора поездки (UUID)' });
    }

    const driverId = extractUserId(req);
    if (!driverId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Проверяем существование поездки и права создателя
        const checkQuery = `
            SELECT r.*,
                   ST_X(r.start_point) as start_lon, ST_Y(r.start_point) as start_lat,
                   ST_X(r.end_point) as end_lon, ST_Y(r.end_point) as end_lat
            FROM rides r
            WHERE r.id = $1 FOR UPDATE
        `;
        const checkRes = await client.query(checkQuery, [rideId]);
        if (checkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        const driverRes = await client.query(
            'SELECT username, first_name, last_name, phone, rating, avatar_url FROM users WHERE id = $1',
            [driverId]
        );
        const driverInfo = driverRes.rows[0] || {};

        const currentRide = checkRes.rows[0];
        if (currentRide.driver_id !== driverId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Редактировать поездку может только её создатель' });
        }

        if (currentRide.status !== 'planned' && currentRide.status !== 'scheduled') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Можно редактировать только запланированные поездки' });
        }

        // Текущее число пассажиров
        const passengersCountRes = await client.query(
            "SELECT COUNT(*)::int as count FROM matches WHERE ride_id = $1 AND status = 'accepted'",
            [rideId]
        );
        const currentPassengersCount = passengersCountRes.rows[0]?.count || 0;

        // Валидация и обновление полей
        let startLon = currentRide.start_lon;
        let startLat = currentRide.start_lat;
        let endLon = currentRide.end_lon;
        let endLat = currentRide.end_lat;
        let coordsChanged = false;

        const rawStart = req.body.start_point || req.body.from || (
            req.body.start_lat !== undefined && req.body.start_lon !== undefined
                ? { lat: req.body.start_lat, lon: req.body.start_lon }
                : null
        );
        if (rawStart) {
            const resolvedStart = resolvePointCoordinates(rawStart, { lon: startLon, lat: startLat });
            startLon = resolvedStart.lon;
            startLat = resolvedStart.lat;
            coordsChanged = true;
        }

        const rawEnd = req.body.end_point || req.body.to || (
            req.body.end_lat !== undefined && req.body.end_lon !== undefined
                ? { lat: req.body.end_lat, lon: req.body.end_lon }
                : null
        );
        if (rawEnd) {
            const resolvedEnd = resolvePointCoordinates(rawEnd, { lon: endLon, lat: endLat });
            endLon = resolvedEnd.lon;
            endLat = resolvedEnd.lat;
            coordsChanged = true;
        }

        if (coordsChanged && startLon === endLon && startLat === endLat) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Точки отправления и назначения не могут совпадать (нулевая дистанция)' });
        }

        let departureTime = currentRide.departure_time;
        if (req.body.departure_time || req.body.time) {
            departureTime = parseDepartureTime(req.body.departure_time || req.body.time);
        }

        let vehicleId = currentRide.vehicle_id;
        if (req.body.vehicle_id !== undefined) {
            if (req.body.vehicle_id === null || req.body.vehicle_id === '') {
                vehicleId = null;
            } else {
                if (!isValidUuid(req.body.vehicle_id)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Некорректный формат vehicle_id' });
                }
                const vCheck = await client.query('SELECT id FROM vehicles WHERE id = $1 AND driver_id = $2', [req.body.vehicle_id, driverId]);
                if (vCheck.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Указанный автомобиль не найден или не принадлежит водителю' });
                }
                vehicleId = req.body.vehicle_id;
            }
        }

        let totalSeats = currentRide.total_seats;
        if (req.body.total_seats !== undefined) {
            const parsedSeats = parseInt(req.body.total_seats, 10);
            if (isNaN(parsedSeats) || parsedSeats < 1 || parsedSeats > 8) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Количество мест должно быть от 1 до 8' });
            }
            if (parsedSeats < currentPassengersCount) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: `Количество мест (${parsedSeats}) не может быть меньше числа уже записавшихся пассажиров (${currentPassengersCount})`
                });
            }
            totalSeats = parsedSeats;
        }
        const availableSeats = totalSeats - currentPassengersCount;

        let basePrice = currentRide.base_price;
        const hasCustomPrice = (req.body.base_price !== undefined && req.body.base_price !== null && String(req.body.base_price).trim() !== '') ||
                               (req.body.price !== undefined && req.body.price !== null && String(req.body.price).trim() !== '');
        if (hasCustomPrice) {
            const rawVal = req.body.base_price !== undefined ? req.body.base_price : req.body.price;
            const parsedVal = parseFloat(rawVal);
            if (isNaN(parsedVal) || parsedVal <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Стоимость поездки должна быть больше 0' });
            }
            basePrice = Math.round(parsedVal * 100) / 100;
        } else if (coordsChanged) {
            const distanceKm = await calculateDistanceKm(client, startLon, startLat, endLon, endLat);
            const isPeak = isPeakHour(departureTime);
            basePrice = calculateBasePrice(distanceKm, isPeak);
        }
        if (basePrice <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Стоимость поездки должна быть больше 0' });
        }

        let rideType = currentRide.ride_type || 'one_off';
        if (req.body.ride_type !== undefined) {
            rideType = req.body.ride_type === 'regular' ? 'regular' : 'one_off';
        }

        let regularDays = currentRide.regular_days;
        if (req.body.regular_days !== undefined) {
            regularDays = rideType === 'regular'
                ? (Array.isArray(req.body.regular_days) ? req.body.regular_days.join(',') : (typeof req.body.regular_days === 'string' ? req.body.regular_days.trim() : null))
                : null;
        }

        let description = currentRide.description;
        if (req.body.description !== undefined) {
            description = typeof req.body.description === 'string' && req.body.description.trim().length > 0
                ? req.body.description.trim()
                : null;
        }

        let tags = currentRide.tags;
        if (req.body.tags !== undefined) {
            if (Array.isArray(req.body.tags)) {
                tags = req.body.tags.map((t) => String(t).trim()).filter(Boolean);
            } else if (typeof req.body.tags === 'string') {
                tags = req.body.tags.split(',').map((t) => t.trim()).filter(Boolean);
            }
        }

        const updateQuery = `
            UPDATE rides
            SET
                departure_time = $1,
                start_point = ST_SetSRID(ST_MakePoint($2, $3), 4326),
                end_point = ST_SetSRID(ST_MakePoint($4, $5), 4326),
                base_price = $6,
                total_seats = $7,
                available_seats = $8,
                vehicle_id = $9,
                ride_type = $10,
                regular_days = $11,
                description = $12,
                tags = $13
            WHERE id = $14
            RETURNING 
                id,
                driver_id,
                vehicle_id,
                parent_ride_id,
                departure_time,
                ST_X(start_point) as start_lon,
                ST_Y(start_point) as start_lat,
                ST_X(end_point) as end_lon,
                ST_Y(end_point) as end_lat,
                ROUND((ST_DistanceSphere(start_point, end_point) / 1000.0)::numeric, 2) as distance_km,
                base_price,
                total_seats,
                available_seats,
                status,
                ride_type,
                regular_days,
                distance_meters,
                duration_seconds,
                route_polyline,
                description,
                tags,
                created_at
        `;

        const updateRes = await client.query(updateQuery, [
            departureTime,
            startLon,
            startLat,
            endLon,
            endLat,
            basePrice,
            totalSeats,
            availableSeats,
            vehicleId,
            rideType,
            regularDays,
            description,
            tags,
            rideId
        ]);

        // Получаем актуальный список пассажиров
        const passengersRes = await client.query(`
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
            ) as passengers,
            array_agg(m.passenger_id::text) as passenger_ids
            FROM matches m
            JOIN users pu ON m.passenger_id = pu.id
            WHERE m.ride_id = $1 AND m.status = 'accepted'
        `, [rideId]);

        await client.query('COMMIT');

        const combinedRow = {
            ...updateRes.rows[0],
            driver_username: driverInfo.username,
            driver_first_name: driverInfo.first_name,
            driver_last_name: driverInfo.last_name,
            driver_phone: driverInfo.phone,
            driver_rating: driverInfo.rating,
            driver_avatar_url: driverInfo.avatar_url || null,
            passenger_ids: passengersRes.rows[0]?.passenger_ids || [],
            passengers: passengersRes.rows[0]?.passengers || []
        };

        const mappedRide = mapRideRow(combinedRow);

        return res.json({
            message: 'Поездка успешно обновлена',
            ride: mappedRide
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка обновления поездки:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при обновлении поездки' });
    } finally {
        client.release();
    }
}

/**
 * Исключение (кик) пассажира водителем
 * DELETE /api/rides/:id/passengers/:passengerId
 */
async function kickPassenger(req, res) {
    const { id: rideId, passengerId } = req.params;

    if (!isValidUuid(rideId) || !isValidUuid(passengerId)) {
        return res.status(400).json({ error: 'Некорректный формат идентификатора (UUID)' });
    }

    const driverId = extractUserId(req);
    if (!driverId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Проверяем поездку и права водителя
        const rideCheck = await client.query(
            'SELECT id, driver_id, status, available_seats, total_seats, base_price FROM rides WHERE id = $1 FOR UPDATE',
            [rideId]
        );
        if (rideCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        const ride = rideCheck.rows[0];
        if (ride.driver_id !== driverId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Только водитель может исключать пассажиров из поездки' });
        }

        if (ride.status !== 'planned' && ride.status !== 'scheduled') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Исключать пассажиров можно только из запланированной поездки' });
        }

        // Проверяем наличие бронирования
        const deleteRes = await client.query(
            "DELETE FROM matches WHERE ride_id = $1 AND passenger_id = $2 AND status = 'accepted' RETURNING id",
            [rideId, passengerId]
        );

        if (deleteRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Пассажир не найден среди участников этой поездки' });
        }

        // Увеличиваем доступные места
        const updateRideRes = await client.query(
            'UPDATE rides SET available_seats = LEAST(total_seats, available_seats + 1) WHERE id = $1 RETURNING available_seats',
            [rideId]
        );

        // Получаем оставшихся пассажиров
        const passengersRes = await client.query(`
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
            ) as passengers,
            array_agg(m.passenger_id::text) as passenger_ids
            FROM matches m
            JOIN users pu ON m.passenger_id = pu.id
            WHERE m.ride_id = $1 AND m.status = 'accepted'
        `, [rideId]);

        await client.query('COMMIT');

        const remainingPassengerIds = passengersRes.rows[0]?.passenger_ids || [];
        const remainingPassengers = passengersRes.rows[0]?.passengers || [];

        return res.json({
            message: 'Пассажир успешно исключен из поездки',
            available_seats: updateRideRes.rows[0]?.available_seats,
            current_price: Number(ride.base_price),
            passenger_ids: remainingPassengerIds,
            passengers: remainingPassengers
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка исключения пассажира:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при исключении пассажира' });
    } finally {
        client.release();
    }
}


/**
 * Получение детальной информации о конкретной поездке по её идентификатору (🔵-9)
 * GET /api/rides/:id
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function getRideById(req, res) {
    const { id } = req.params;
    if (!isValidUuid(id)) {
        return res.status(400).json({ error: 'Некорректный формат идентификатора поездки (UUID)' });
    }

    try {
        const query = `
            SELECT 
                r.id,
                r.driver_id,
                r.vehicle_id,
                r.parent_ride_id,
                r.departure_time,
                ST_X(r.start_point) AS start_lon,
                ST_Y(r.start_point) AS start_lat,
                ST_X(r.end_point) AS end_lon,
                ST_Y(r.end_point) AS end_lat,
                ROUND((ST_DistanceSphere(r.start_point, r.end_point) / 1000.0)::numeric, 2) as distance_km,
                r.total_seats,
                r.available_seats,
                r.status,
                r.base_price,
                r.ride_type,
                r.regular_days,
                r.distance_meters,
                r.duration_seconds,
                r.route_polyline,
                r.description,
                r.tags,
                r.created_at,
                COALESCE(
                    (
                        SELECT array_agg(m.passenger_id::text)
                        FROM matches m
                        WHERE m.ride_id = r.id AND m.status IN ('accepted', 'completed')
                    ),
                    ARRAY[]::text[]
                ) as passenger_ids,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', pu.id,
                                'name', COALESCE(pu.first_name, pu.username),
                                'username', pu.username,
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
                ) as passengers,
                u.username AS driver_username,
                u.first_name AS driver_first_name,
                u.last_name AS driver_last_name,
                u.phone AS driver_phone,
                u.rating AS driver_rating,
                u.avatar_url AS driver_avatar_url,
                (
                    SELECT COUNT(*)::int
                    FROM reviews rev
                    WHERE rev.reviewee_id = r.driver_id
                ) as driver_reviews_count,
                v.brand AS vehicle_brand,
                v.color AS vehicle_color,
                v.license_plate AS vehicle_license_plate,
                v.seats AS vehicle_seats
            FROM rides r
            LEFT JOIN users u ON r.driver_id = u.id
            LEFT JOIN vehicles v ON r.vehicle_id = v.id
            WHERE r.id = $1
        `;

        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        const ride = mapRideRow(result.rows[0]);
        return res.json({ ride });
    } catch (err) {
        console.error('Ошибка получения поездки по ID:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при получении информации о поездке' });
    }
}

/**
 * Удаление или отмена поездки водителем (🟡-8)
 * DELETE /api/rides/:id
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function deleteRide(req, res) {
    const driverId = extractUserId(req);
    if (!driverId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
        return res.status(400).json({ error: 'Некорректный формат идентификатора поездки (UUID)' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const rideRes = await client.query('SELECT id, driver_id, status FROM rides WHERE id = $1 FOR UPDATE', [id]);
        if (rideRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        const ride = rideRes.rows[0];
        if (ride.driver_id !== driverId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Только водитель может отменить или удалить свою поездку' });
        }

        if (ride.status === 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя удалить активную поездку. Завершите или отмените её.' });
        }

        await client.query('DELETE FROM rides WHERE id = $1', [id]);
        await client.query('COMMIT');

        return res.json({ message: 'Поездка успешно удалена' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка удаления поездки:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при удалении поездки' });
    } finally {
        client.release();
    }
}

/**
 * Генерация точек полилинии между точкой отправления и точкой назначения
 * @param {number} startLon - Долгота начальной точки
 * @param {number} startLat - Широта начальной точки
 * @param {number} endLon - Долгота конечной точки
 * @param {number} endLat - Широта конечной точки
 * @param {number} [numPoints=18] - Количество точек интерполяции
 * @returns {Array<[number, number]>} Массив координат [lon, lat]
 */
function generateRoutePolyline(startLon, startLat, endLon, endLat, numPoints = 18) {
    const points = [];
    const dx = endLon - startLon;
    const dy = endLat - startLat;
    const midX = (startLon + endLon) / 2;
    const midY = (startLat + endLat) / 2;
    const devX = -dy * 0.12;
    const devY = dx * 0.12;

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const oneMinusT = 1 - t;
        const lon = oneMinusT * oneMinusT * startLon + 2 * oneMinusT * t * (midX + devX) + t * t * endLon;
        const lat = oneMinusT * oneMinusT * startLat + 2 * oneMinusT * t * (midY + devY) + t * t * endLat;
        points.push([
            Math.round(lon * 100000) / 100000,
            Math.round(lat * 100000) / 100000
        ]);
    }
    return points;
}

/**
 * Предварительный расчет маршрута (полилиния, цена, дистанция, время в пути через Yandex Maps API)
 * @param {object} req - Express запрос
 * @param {object} res - Express ответ
 */
async function getRoutePreview(req, res) {
    try {
        const fromInput = req.query.from || req.body?.from || req.query.start || req.body?.start_point;
        const toInput = req.query.to || req.body?.to || req.query.end || req.body?.end_point;
        const timeInput = req.query.time || req.body?.time || req.query.departure_time || req.body?.departure_time;

        if (!fromInput || !toInput) {
            return res.status(400).json({ error: 'Параметры "from" и "to" обязательны для построения маршрута' });
        }

        let startCoords;
        if (typeof fromInput === 'string') {
            const geocoded = await yandexMaps.geocodeAddress(fromInput);
            startCoords = { lon: geocoded.longitude, lat: geocoded.latitude, name: geocoded.full_address };
        } else {
            startCoords = resolvePointCoordinates(fromInput, DEFAULT_START);
        }

        let endCoords;
        if (typeof toInput === 'string') {
            const geocoded = await yandexMaps.geocodeAddress(toInput);
            endCoords = { lon: geocoded.longitude, lat: geocoded.latitude, name: geocoded.full_address };
        } else {
            endCoords = resolvePointCoordinates(toInput, DEFAULT_END);
        }

        if (typeof fromInput === 'string' && typeof toInput === 'string' && fromInput.trim().toLowerCase() === toInput.trim().toLowerCase()) {
            return res.status(400).json({ error: 'Точки отправления и назначения не могут совпадать (нулевая дистанция)' });
        }
        if (startCoords.lat === endCoords.lat && startCoords.lon === endCoords.lon) {
            return res.status(400).json({ error: 'Точки отправления и назначения не могут совпадать (нулевая дистанция)' });
        }

        const routeData = await yandexMaps.buildRoute(startCoords, endCoords);
        if (!routeData.distance_meters || routeData.distance_meters <= 0) {
            return res.status(400).json({ error: 'Точки отправления и назначения не могут совпадать (нулевая дистанция)' });
        }

        const departureDate = parseDepartureTime(timeInput);
        const priceInfo = yandexMaps.calculateTripPrice(
            routeData.distance_meters,
            routeData.duration_seconds,
            departureDate
        );
        if (priceInfo.base_price <= 0) {
            return res.status(400).json({ error: 'Стоимость поездки должна быть больше 0' });
        }

        return res.json({
            from: {
                address: startCoords.name,
                lat: startCoords.lat,
                lon: startCoords.lon
            },
            to: {
                address: endCoords.name,
                lat: endCoords.lat,
                lon: endCoords.lon
            },
            start: startCoords,
            end: endCoords,
            start_coords: { lon: startCoords.lon, lat: startCoords.lat },
            end_coords: { lon: endCoords.lon, lat: endCoords.lat },
            distance_meters: routeData.distance_meters,
            duration_seconds: routeData.duration_seconds,
            distance_km: routeData.distance_km,
            distanceKm: routeData.distance_km,
            duration_min: routeData.duration_minutes,
            durationMin: routeData.duration_minutes,
            price: priceInfo.base_price,
            base_price: priceInfo.base_price,
            is_peak: priceInfo.is_peak,
            isPeak: priceInfo.is_peak,
            route_polyline: routeData.route_polyline,
            polyline: routeData.route_polyline?.coordinates || routeData.route_polyline
        });
    } catch (err) {
        console.error('Ошибка в route-preview:', err);
        return res.status(500).json({ error: 'Не удалось построить предпросмотр маршрута' });
    }
}

/**
 * Старт поездки водителем
 * POST /api/rides/:id/start
 */
async function startRide(req, res) {
    const rideId = req.params.id;
    if (!isValidUuid(rideId)) {
        return res.status(400).json({ error: 'Некорректный формат идентификатора поездки (UUID)' });
    }

    const driverId = extractUserId(req);
    if (!driverId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const rideRes = await client.query(
            `SELECT r.*,
                    ST_X(r.start_point) as start_lon, ST_Y(r.start_point) as start_lat,
                    ST_X(r.end_point) as end_lon, ST_Y(r.end_point) as end_lat
             FROM rides r
             WHERE r.id = $1 FOR UPDATE`,
            [rideId]
        );

        if (rideRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        const currentRide = rideRes.rows[0];

        if (currentRide.driver_id !== driverId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Только водитель поездки может начать её' });
        }

        if (currentRide.status === 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Поездка уже началась' });
        }

        if (currentRide.status === 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Поездка уже завершена' });
        }

        if (currentRide.status === 'cancelled') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя начать отмененную поездку' });
        }

        if (currentRide.status !== 'planned' && currentRide.status !== 'scheduled') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Некорректный статус поездки для старта' });
        }

        // Для регулярных поездок: создаем конкретный разовый экземпляр (копию из шаблона)
        if (currentRide.ride_type === 'regular') {
            const copyQuery = `
                INSERT INTO rides (
                    driver_id, vehicle_id, parent_ride_id, departure_time,
                    start_point, end_point, route_line, total_seats, available_seats,
                    status, base_price, ride_type, regular_days, distance_meters,
                    duration_seconds, route_polyline, description, tags
                )
                VALUES (
                    $1, $2, $3, CURRENT_TIMESTAMP,
                    ST_SetSRID(ST_MakePoint($4, $5), 4326),
                    ST_SetSRID(ST_MakePoint($6, $7), 4326),
                    $8, $9, $10,
                    'active', $11, 'one_off', $12, $13,
                    $14, $15, $16, $17
                )
                RETURNING id
            `;
            const copyRes = await client.query(copyQuery, [
                currentRide.driver_id,
                currentRide.vehicle_id,
                currentRide.id,
                currentRide.start_lon,
                currentRide.start_lat,
                currentRide.end_lon,
                currentRide.end_lat,
                currentRide.route_line,
                currentRide.total_seats,
                currentRide.available_seats,
                currentRide.base_price,
                currentRide.regular_days,
                currentRide.distance_meters,
                currentRide.duration_seconds,
                JSON.stringify(currentRide.route_polyline),
                currentRide.description,
                currentRide.tags || []
            ]);
            const instanceRideId = copyRes.rows[0].id;

            // Запись в таблицу ride_instances
            await client.query(`
                INSERT INTO ride_instances (ride_id, instance_ride_id, date, status, started_at)
                VALUES ($1, $2, CURRENT_DATE, 'active', CURRENT_TIMESTAMP)
                ON CONFLICT (ride_id, date) DO UPDATE SET
                    instance_ride_id = EXCLUDED.instance_ride_id,
                    status = 'active',
                    started_at = CURRENT_TIMESTAMP
            `, [currentRide.id, instanceRideId]);

            // Копируем пассажиров (matches) для этого экземпляра
            await client.query(`
                INSERT INTO matches (ride_id, passenger_id, agreed_price, status, selected_day)
                SELECT $1, passenger_id, agreed_price, 'accepted', selected_day
                FROM matches
                WHERE ride_id = $2 AND status = 'accepted'
                ON CONFLICT (ride_id, passenger_id) DO NOTHING
            `, [instanceRideId, currentRide.id]);

            await client.query('COMMIT');

            const fullRes = await pool.query(`
                SELECT r.id, r.driver_id, r.vehicle_id, r.parent_ride_id, r.description, r.tags,
                       u.username as driver_username, u.first_name as driver_first_name,
                       u.last_name as driver_last_name, u.phone as driver_phone,
                       u.rating as driver_rating, u.avatar_url as driver_avatar_url,
                       (SELECT COUNT(*)::int FROM reviews rev WHERE rev.reviewee_id = r.driver_id) as driver_reviews_count,
                       r.departure_time,
                       ST_X(r.start_point) as start_lon, ST_Y(r.start_point) as start_lat,
                       ST_X(r.end_point) as end_lon, ST_Y(r.end_point) as end_lat,
                       ROUND((ST_DistanceSphere(r.start_point, r.end_point) / 1000.0)::numeric, 2) as distance_km,
                       r.base_price, r.total_seats, r.available_seats, r.status,
                       r.ride_type, r.regular_days, r.distance_meters, r.duration_seconds,
                       r.route_polyline, r.created_at,
                       COALESCE((SELECT array_agg(m.passenger_id::text) FROM matches m WHERE m.ride_id = r.id AND m.status IN ('accepted', 'completed')), ARRAY[]::text[]) as passenger_ids,
                       COALESCE((SELECT json_agg(json_build_object('id', pu.id, 'name', COALESCE(pu.first_name, pu.username), 'username', pu.username, 'telegram', pu.username, 'phone', pu.phone, 'avatar_url', pu.avatar_url, 'selected_day', m.selected_day)) FROM matches m JOIN users pu ON m.passenger_id = pu.id WHERE m.ride_id = r.id AND m.status IN ('accepted', 'completed')), '[]'::json) as passengers
                FROM rides r
                LEFT JOIN users u ON r.driver_id = u.id
                WHERE r.id = $1
            `, [instanceRideId]);

            return res.status(200).json({
                message: 'Регулярная поездка успешно начата',
                ride: mapRideRow(fullRes.rows[0])
            });
        }

        // Для разовой поездки обновляем статус на 'active'
        await client.query("UPDATE rides SET status = 'active' WHERE id = $1", [rideId]);
        await client.query('COMMIT');

        const fullRes = await pool.query(`
            SELECT r.id, r.driver_id, r.vehicle_id, r.parent_ride_id, r.description, r.tags,
                   u.username as driver_username, u.first_name as driver_first_name,
                   u.last_name as driver_last_name, u.phone as driver_phone,
                   u.rating as driver_rating, u.avatar_url as driver_avatar_url,
                   (SELECT COUNT(*)::int FROM reviews rev WHERE rev.reviewee_id = r.driver_id) as driver_reviews_count,
                   r.departure_time,
                   ST_X(r.start_point) as start_lon, ST_Y(r.start_point) as start_lat,
                   ST_X(r.end_point) as end_lon, ST_Y(r.end_point) as end_lat,
                   ROUND((ST_DistanceSphere(r.start_point, r.end_point) / 1000.0)::numeric, 2) as distance_km,
                   r.base_price, r.total_seats, r.available_seats, r.status,
                   r.ride_type, r.regular_days, r.distance_meters, r.duration_seconds,
                   r.route_polyline, r.created_at,
                   COALESCE((SELECT array_agg(m.passenger_id::text) FROM matches m WHERE m.ride_id = r.id AND m.status IN ('accepted', 'completed')), ARRAY[]::text[]) as passenger_ids,
                   COALESCE((SELECT json_agg(json_build_object('id', pu.id, 'name', COALESCE(pu.first_name, pu.username), 'username', pu.username, 'telegram', pu.username, 'phone', pu.phone, 'avatar_url', pu.avatar_url, 'selected_day', m.selected_day)) FROM matches m JOIN users pu ON m.passenger_id = pu.id WHERE m.ride_id = r.id AND m.status IN ('accepted', 'completed')), '[]'::json) as passengers
            FROM rides r
            LEFT JOIN users u ON r.driver_id = u.id
            WHERE r.id = $1
        `, [rideId]);

        return res.status(200).json({
            message: 'Поездка успешно начата',
            ride: mapRideRow(fullRes.rows[0])
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при старте поездки:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при старте поездки' });
    } finally {
        client.release();
    }
}

/**
 * Завершение поездки водителем
 * POST /api/rides/:id/finish (или /api/rides/:id/complete)
 */
async function finishRide(req, res) {
    const rideId = req.params.id;
    if (!isValidUuid(rideId)) {
        return res.status(400).json({ error: 'Некорректный формат идентификатора поездки (UUID)' });
    }

    const driverId = extractUserId(req);
    if (!driverId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const rideRes = await client.query(
            'SELECT id, driver_id, status FROM rides WHERE id = $1 FOR UPDATE',
            [rideId]
        );

        if (rideRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        const currentRide = rideRes.rows[0];

        if (currentRide.driver_id !== driverId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Только водитель поездки может завершить её' });
        }

        if (currentRide.status === 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Поездка уже завершена' });
        }

        if (currentRide.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Завершить можно только активную поездку' });
        }

        // Обновляем статус поездки на 'completed'
        await client.query("UPDATE rides SET status = 'completed' WHERE id = $1", [rideId]);

        // Обновляем статус бронирований на 'completed'
        await client.query("UPDATE matches SET status = 'completed' WHERE ride_id = $1 AND status = 'accepted'", [rideId]);

        // Обновляем ride_instances если это экземпляр
        await client.query(`
            UPDATE ride_instances
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE instance_ride_id = $1 OR (ride_id = $1 AND status = 'active')
        `, [rideId]);

        await client.query('COMMIT');

        const fullRes = await pool.query(`
            SELECT r.id, r.driver_id, r.vehicle_id, r.parent_ride_id, r.description, r.tags,
                   u.username as driver_username, u.first_name as driver_first_name,
                   u.last_name as driver_last_name, u.phone as driver_phone,
                   u.rating as driver_rating, u.avatar_url as driver_avatar_url,
                   (SELECT COUNT(*)::int FROM reviews rev WHERE rev.reviewee_id = r.driver_id) as driver_reviews_count,
                   r.departure_time,
                   ST_X(r.start_point) as start_lon, ST_Y(r.start_point) as start_lat,
                   ST_X(r.end_point) as end_lon, ST_Y(r.end_point) as end_lat,
                   ROUND((ST_DistanceSphere(r.start_point, r.end_point) / 1000.0)::numeric, 2) as distance_km,
                   r.base_price, r.total_seats, r.available_seats, r.status,
                   r.ride_type, r.regular_days, r.distance_meters, r.duration_seconds,
                   r.route_polyline, r.created_at,
                   COALESCE((SELECT array_agg(m.passenger_id::text) FROM matches m WHERE m.ride_id = r.id AND m.status IN ('accepted', 'completed')), ARRAY[]::text[]) as passenger_ids,
                   COALESCE((SELECT json_agg(json_build_object('id', pu.id, 'name', COALESCE(pu.first_name, pu.username), 'username', pu.username, 'telegram', pu.username, 'phone', pu.phone, 'avatar_url', pu.avatar_url, 'selected_day', m.selected_day)) FROM matches m JOIN users pu ON m.passenger_id = pu.id WHERE m.ride_id = r.id AND m.status IN ('accepted', 'completed')), '[]'::json) as passengers
            FROM rides r
            LEFT JOIN users u ON r.driver_id = u.id
            WHERE r.id = $1
        `, [rideId]);

        return res.status(200).json({
            message: 'Поездка успешно завершена',
            ride: mapRideRow(fullRes.rows[0])
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при завершении поездки:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при завершении поездки' });
    } finally {
        client.release();
    }
}

module.exports = {
    createRide,
    getRides,
    getAllRides,
    getRideById,
    getRoutePreview,
    deleteRide,
    joinRide,
    leaveRide,
    updateRide,
    kickPassenger,
    startRide,
    finishRide,
    completeRide: finishRide,
    isPeakHour,
    calculateDistanceKm,
    calculateBasePrice,
    generateRoutePolyline
};
