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
        const lon = Number(input.lon ?? input.lng ?? input.x);
        const lat = Number(input.lat ?? input.y);
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
    const basePrice = Math.max(0, parseFloat(req.body.base_price || req.body.price || 150));
    const totalSeats = Math.max(1, parseInt(req.body.total_seats || 4, 10));
    const availableSeats = Math.min(totalSeats, Math.max(0, parseInt(req.body.available_seats || totalSeats, 10)));

    try {
        const driverCheck = await pool.query('SELECT id FROM users WHERE id = $1', [driverId]);
        if (driverCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Водитель с указанным ID не найден в базе данных' });
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
                base_price,
                total_seats,
                available_seats,
                status,
                created_at
        `;

        const result = await pool.query(insertQuery, [
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

        return res.status(201).json({
            message: 'Поездка успешно создана',
            ride: result.rows[0]
        });
    } catch (err) {
        console.error('Ошибка создания поездки:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при создании поездки' });
    }
}

/**
 * Получение списка поездок
 * GET /api/rides
 */
async function getRides(req, res) {
    try {
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
                r.base_price,
                r.total_seats,
                r.available_seats,
                r.status,
                r.created_at
            FROM rides r
            LEFT JOIN users u ON r.driver_id = u.id
            WHERE r.status = 'scheduled' AND r.departure_time > NOW()
            ORDER BY r.departure_time ASC
            LIMIT 50
        `;

        const result = await pool.query(selectQuery);
        const rides = result.rows.map((row) => ({
            id: row.id,
            driver_id: row.driver_id,
            driver_name: row.driver_first_name || row.driver_username || 'Водитель',
            driver_phone: row.driver_phone,
            driver_rating: row.driver_rating !== null ? Number(row.driver_rating) : null,
            departure_time: row.departure_time,
            start_coords: { lon: Number(row.start_lon), lat: Number(row.start_lat) },
            end_coords: { lon: Number(row.end_lon), lat: Number(row.end_lat) },
            base_price: Number(row.base_price),
            total_seats: row.total_seats,
            available_seats: row.available_seats,
            status: row.status,
            created_at: row.created_at
        }));

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
        const rideCheck = await client.query('SELECT * FROM rides WHERE id = $1 FOR UPDATE', [rideId]);
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
        const rideCheck = await client.query('SELECT * FROM rides WHERE id = $1 FOR UPDATE', [rideId]);
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
    leaveRide
};
