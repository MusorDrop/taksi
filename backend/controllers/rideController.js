const pool = require('../db');

// Известные координаты ключевых локаций Екатеринбурга (lon: долгота, lat: широта)
const KNOWN_LOCATIONS = {
    'уралмаш': { lon: 60.5975, lat: 56.8885, name: 'Уралмаш' },
    'новокольцовский': { lon: 60.7712, lat: 56.7686, name: 'Кампус Новокольцовский' },
    'центр': { lon: 60.6057, lat: 56.8389, name: 'Центр' },
    'урфу': { lon: 60.6534, lat: 56.8439, name: 'Главный корпус УрФУ' },
    'мира': { lon: 60.6534, lat: 56.8439, name: 'Мира 19' },
    'втузгородок': { lon: 60.6530, lat: 56.8430, name: 'Втузгородок' },
    'академический': { lon: 60.5186, lat: 56.7865, name: 'Академический' },
    'жби': { lon: 60.6860, lat: 56.8285, name: 'ЖБИ' }
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
                return value;
            }
        }
    }

    return fallback;
}

/**
 * Парсинг времени отправления (поддержка ISO строк или формата HH:MM)
 * @param {string|Date} timeInput - Входное время
 * @returns {Date} Корректный объект даты
 */
function parseDepartureTime(timeInput) {
    if (!timeInput) {
        return new Date(Date.now() + 60 * 60 * 1000);
    }

    if (typeof timeInput === 'string' && /^\d{1,2}:\d{2}$/.test(timeInput.trim())) {
        const [hours, minutes] = timeInput.trim().split(':').map(Number);
        const target = new Date();
        target.setHours(hours, minutes, 0, 0);
        if (target.getTime() < Date.now()) {
            target.setDate(target.getDate() + 1);
        }
        return target;
    }

    const parsed = new Date(timeInput);
    if (isNaN(parsed.getTime())) {
        return new Date(Date.now() + 60 * 60 * 1000);
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
 * Преобразование строки БД в стандартизированный объект поездки
 * @param {object} row - Данные поездки из БД
 * @returns {object} Форматированный объект поездки
 */
function mapRideRow(row) {
    const isPeak = isPeakHour(row.departure_time);
    const distanceKm = Number(row.distance_km || 0);
    return {
        id: row.id,
        driver_id: row.driver_id,
        driver_name: row.driver_first_name || row.driver_username || 'Водитель',
        driver_phone: row.driver_phone || null,
        driver_rating: row.driver_rating !== null && row.driver_rating !== undefined ? Number(row.driver_rating) : null,
        departure_time: row.departure_time,
        start_coords: { lon: Number(row.start_lon), lat: Number(row.start_lat) },
        end_coords: { lon: Number(row.end_lon), lat: Number(row.end_lat) },
        start_lon: Number(row.start_lon),
        start_lat: Number(row.start_lat),
        end_lon: Number(row.end_lon),
        end_lat: Number(row.end_lat),
        distance_km: distanceKm,
        distanceKm: distanceKm,
        is_peak: isPeak,
        isPeak: isPeak,
        base_price: Number(row.base_price),
        total_seats: row.total_seats,
        available_seats: row.available_seats,
        status: row.status,
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

    const startCoords = resolvePointCoordinates(
        req.body.start_point || req.body.from || { lat: req.body.start_lat, lon: req.body.start_lon },
        DEFAULT_START
    );
    const endCoords = resolvePointCoordinates(
        req.body.end_point || req.body.to || { lat: req.body.end_lat, lon: req.body.end_lon },
        DEFAULT_END
    );

    const departureTime = parseDepartureTime(req.body.departure_time || req.body.time);
    const totalSeats = Math.min(8, Math.max(1, parseInt(req.body.total_seats || 4, 10)));
    const availableSeats = Math.min(totalSeats, Math.max(0, parseInt(req.body.available_seats !== undefined ? req.body.available_seats : totalSeats, 10)));

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const driverCheck = await client.query(
            'SELECT id, username, first_name, last_name, phone, rating FROM users WHERE id = $1',
            [driverId]
        );
        if (driverCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Водитель с указанным ID не найден в базе данных' });
        }

        const distanceKm = await calculateDistanceKm(client, startCoords.lon, startCoords.lat, endCoords.lon, endCoords.lat);
        const isPeak = isPeakHour(departureTime);

        let basePrice;
        const hasCustomPrice = (req.body.base_price !== undefined && req.body.base_price !== null && String(req.body.base_price).trim() !== '') ||
                               (req.body.price !== undefined && req.body.price !== null && String(req.body.price).trim() !== '');

        if (hasCustomPrice) {
            const rawVal = req.body.base_price !== undefined ? req.body.base_price : req.body.price;
            const parsedVal = parseFloat(rawVal);
            if (isNaN(parsedVal) || parsedVal < 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Указана некорректная стоимость поездки' });
            }
            basePrice = Math.round(parsedVal * 100) / 100;
        } else {
            basePrice = calculateBasePrice(distanceKm, isPeak);
        }

        const insertQuery = `
            INSERT INTO rides (
                driver_id,
                departure_time,
                start_point,
                end_point,
                base_price,
                total_seats,
                available_seats,
                status
            ) VALUES (
                $1,
                $2,
                ST_SetSRID(ST_MakePoint($3, $4), 4326),
                ST_SetSRID(ST_MakePoint($5, $6), 4326),
                $7,
                $8,
                $9,
                'scheduled'
            )
            RETURNING 
                id,
                driver_id,
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
                created_at
        `;

        const result = await client.query(insertQuery, [
            driverId,
            departureTime,
            startCoords.lon,
            startCoords.lat,
            endCoords.lon,
            endCoords.lat,
            basePrice,
            totalSeats,
            availableSeats
        ]);

        await client.query('COMMIT');

        const driverInfo = driverCheck.rows[0];
        const combinedRow = {
            ...result.rows[0],
            driver_username: driverInfo.username,
            driver_first_name: driverInfo.first_name,
            driver_last_name: driverInfo.last_name,
            driver_phone: driverInfo.phone,
            driver_rating: driverInfo.rating
        };

        return res.status(201).json({
            message: 'Поездка успешно создана',
            ride: mapRideRow(combinedRow)
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
    const { start_lat, start_lon, end_lat, end_lon, radius, departure_time, time } = req.query;

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

    const conditions = ["r.status = 'scheduled'"];
    const params = [];

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
            u.username as driver_username,
            u.first_name as driver_first_name,
            u.last_name as driver_last_name,
            u.phone as driver_phone,
            u.rating as driver_rating,
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
            r.created_at
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
        if (ride.status !== 'scheduled') {
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
            INSERT INTO matches (ride_id, passenger_id, agreed_price, status)
            VALUES ($1, $2, $3, 'accepted')
            RETURNING *
        `;
        const matchRes = await client.query(insertMatchQuery, [rideId, passengerId, ride.base_price]);

        await client.query('COMMIT');

        return res.status(201).json({
            message: 'Вы успешно присоединились к поездке',
            match: matchRes.rows[0],
            available_seats: updateRideRes.rows[0].available_seats
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
            'SELECT id, driver_id, status, available_seats, total_seats FROM rides WHERE id = $1 FOR UPDATE',
            [rideId]
        );
        if (rideCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        const ride = rideCheck.rows[0];

        // Проверка статуса поездки
        if (ride.status !== 'scheduled') {
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

        await client.query('COMMIT');

        return res.json({
            message: 'Вы успешно отменили участие в поездке',
            available_seats: updateRideRes.rows[0]?.available_seats
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка отмены поездки:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при выходе из поездки' });
    } finally {
        client.release();
    }
}

module.exports = {
    createRide,
    getRides,
    joinRide,
    leaveRide,
    isPeakHour,
    calculateDistanceKm,
    calculateBasePrice
};
