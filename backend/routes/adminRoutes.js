const express = require('express');
const pool = require('../db');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// Регулярное выражение для валидации UUID из единого модуля валидации (🟡-1)
const { UUID_REGEX } = require('../utils/validation');

// Защита всех эндпоинтов администратора
router.use(adminMiddleware);

// Глобальная валидация параметра :id для всех маршрутов администратора (защита от SQL/22P02 ошибок)
router.param('id', (req, res, next, id) => {
    if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Некорректный формат идентификатора (ожидается UUID)' });
    }
    next();
});

// Допустимые роли пользователей
const ALLOWED_ROLES = ['driver', 'passenger', 'both'];
// Допустимые статусы поездок
const ALLOWED_RIDE_STATUSES = ['planned', 'active', 'completed', 'cancelled', 'scheduled', 'in_progress'];

// --- ПОЛЬЗОВАТЕЛИ (USERS) ---

// Получение списка всех пользователей с поддержкой пагинации (🟡-5)
router.get('/users', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = (page - 1) * limit;

    try {
        const query = `
            SELECT id, username, first_name, last_name, phone, role, rating, is_verified, is_blocked, avatar_url, created_at,
                   COUNT(*) OVER() AS full_count
            FROM users
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);
        const totalCount = result.rows.length > 0 ? Number(result.rows[0].full_count) : 0;
        const users = result.rows.map(({ full_count, ...userData }) => userData);
        res.json({ count: users.length, total_count: totalCount, page, limit, users });
    } catch (err) {
        console.error('Ошибка admin /users:', err);
        res.status(500).json({ error: 'Ошибка базы данных при получении пользователей' });
    }
});

// Получение одного пользователя по ID
router.get('/users/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, first_name, last_name, phone, role, rating, is_verified, is_blocked, avatar_url, created_at FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ user: result.rows[0] });
    } catch (err) {
        console.error('Ошибка admin GET /users/:id:', err);
        res.status(500).json({ error: 'Ошибка получения пользователя' });
    }
});

// Блокировка/разблокировка пользователя (переключение или явное задание)
router.patch('/users/:id/block', async (req, res) => {
    const { id } = req.params;
    const { is_blocked } = req.body;

    if (is_blocked !== undefined && typeof is_blocked !== 'boolean') {
        return res.status(400).json({ error: 'Поле is_blocked должно быть булевым значением (true/false)' });
    }

    try {
        let query;
        let values;
        if (typeof is_blocked === 'boolean') {
            query = 'UPDATE users SET is_blocked = $1 WHERE id = $2 RETURNING id, username, is_blocked';
            values = [is_blocked, id];
        } else {
            query = 'UPDATE users SET is_blocked = NOT COALESCE(is_blocked, false) WHERE id = $1 RETURNING id, username, is_blocked';
            values = [id];
        }
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Статус блокировки обновлен', user: result.rows[0] });
    } catch (err) {
        console.error('Ошибка admin block user:', err);
        res.status(500).json({ error: 'Ошибка обновления статуса блокировки' });
    }
});

// Редактирование данных пользователя
router.patch('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, phone, role, is_blocked } = req.body;

    if (role !== undefined && role !== null && !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
            error: "Недопустимая роль пользователя. Разрешены: 'driver', 'passenger', 'both'"
        });
    }

    if (is_blocked !== undefined && is_blocked !== null && typeof is_blocked !== 'boolean') {
        return res.status(400).json({ error: 'Поле is_blocked должно быть булевым значением (true/false)' });
    }

    try {
        const query = `
            UPDATE users
            SET first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                phone = COALESCE($3, phone),
                role = COALESCE($4, role),
                is_blocked = COALESCE($5, is_blocked)
            WHERE id = $6
            RETURNING id, username, first_name, last_name, phone, role, is_blocked, avatar_url
        `;
        const values = [first_name ?? null, last_name ?? null, phone ?? null, role ?? null, is_blocked ?? null, id];
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Данные пользователя обновлены', user: result.rows[0] });
    } catch (err) {
        console.error('Ошибка admin PATCH /users/:id:', err);
        res.status(500).json({ error: 'Ошибка обновления данных пользователя' });
    }
});

// Удаление пользователя
router.delete('/users/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, username', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Пользователь удален', user: result.rows[0] });
    } catch (err) {
        console.error('Ошибка admin DELETE /users/:id:', err);
        res.status(500).json({ error: 'Ошибка удаления пользователя' });
    }
});

// --- ПОЕЗДКИ (RIDES) ---

// Получение списка всех поездок с поддержкой пагинации (🟡-5)
router.get('/rides', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = (page - 1) * limit;

    try {
        const query = `
            SELECT
                r.id,
                r.driver_id,
                r.vehicle_id,
                u.username AS driver_username,
                u.first_name AS driver_first_name,
                u.last_name AS driver_last_name,
                u.avatar_url AS driver_avatar_url,
                r.departure_time,
                ST_X(r.start_point) AS start_lon,
                ST_Y(r.start_point) AS start_lat,
                ST_X(r.end_point) AS end_lon,
                ST_Y(r.end_point) AS end_lat,
                r.total_seats,
                r.available_seats,
                r.status,
                r.base_price,
                r.created_at,
                COUNT(*) OVER() AS full_count
            FROM rides r
            LEFT JOIN users u ON r.driver_id = u.id
            ORDER BY r.created_at DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);
        const totalCount = result.rows.length > 0 ? Number(result.rows[0].full_count) : 0;
        const rides = result.rows.map(({ full_count, ...rideData }) => rideData);
        res.json({ count: rides.length, total_count: totalCount, page, limit, rides });
    } catch (err) {
        console.error('Ошибка admin /rides:', err);
        res.status(500).json({ error: 'Ошибка базы данных при получении поездок' });
    }
});

// Получение информации о поездке по ID с явным перечнем колонок и координат (🟡-7)
router.get('/rides/:id', async (req, res) => {
    try {
        const query = `
            SELECT
                id,
                driver_id,
                vehicle_id,
                parent_ride_id,
                departure_time,
                ST_X(start_point) AS start_lon,
                ST_Y(start_point) AS start_lat,
                ST_X(end_point) AS end_lon,
                ST_Y(end_point) AS end_lat,
                total_seats,
                available_seats,
                status,
                base_price,
                ride_type,
                regular_days,
                distance_meters,
                duration_seconds,
                route_polyline,
                description,
                tags,
                created_at
            FROM rides
            WHERE id = $1
        `;
        const result = await pool.query(query, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Поездка не найдена' });
        res.json({ ride: result.rows[0] });
    } catch (err) {
        console.error('Ошибка admin GET /rides/:id:', err);
        res.status(500).json({ error: 'Ошибка получения поездки' });
    }
});

// Редактирование поездки (статус, цена, количество мест, время)
router.patch('/rides/:id', async (req, res) => {
    const { id } = req.params;
    const { status, base_price, available_seats, total_seats, departure_time } = req.body;

    if (status !== undefined && status !== null && !ALLOWED_RIDE_STATUSES.includes(status)) {
        return res.status(400).json({
            error: "Недопустимый статус поездки. Разрешены: 'scheduled', 'in_progress', 'completed', 'cancelled'"
        });
    }

    if (base_price !== undefined && base_price !== null && (isNaN(Number(base_price)) || Number(base_price) < 0)) {
        return res.status(400).json({ error: 'Базовая цена должна быть неотрицательным числом' });
    }

    if (available_seats !== undefined && available_seats !== null && (isNaN(Number(available_seats)) || Number(available_seats) < 0)) {
        return res.status(400).json({ error: 'Количество свободных мест должно быть неотрицательным числом' });
    }

    if (total_seats !== undefined && total_seats !== null && (isNaN(Number(total_seats)) || Number(total_seats) <= 0)) {
        return res.status(400).json({ error: 'Общее количество мест должно быть положительным числом' });
    }

    // Валидация формата времени отправления (🔵-6)
    if (departure_time !== undefined && departure_time !== null) {
        const parsedTime = new Date(departure_time);
        if (isNaN(parsedTime.getTime())) {
            return res.status(400).json({ error: 'Некорректный формат даты отправления (departure_time)' });
        }
    }

    try {
        // Перекрестная проверка available_seats <= total_seats (🟠-1)
        const currentRes = await pool.query('SELECT available_seats, total_seats FROM rides WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Поездка не найдена' });
        const currentRide = currentRes.rows[0];

        const targetAvailable = available_seats !== undefined && available_seats !== null
            ? Number(available_seats)
            : currentRide.available_seats;
        const targetTotal = total_seats !== undefined && total_seats !== null
            ? Number(total_seats)
            : currentRide.total_seats;

        if (targetAvailable > targetTotal) {
            return res.status(400).json({
                error: 'Количество свободных мест не может превышать общее количество мест'
            });
        }

        const query = `
            UPDATE rides
            SET status = COALESCE($1, status),
                base_price = COALESCE($2, base_price),
                available_seats = COALESCE($3, available_seats),
                total_seats = COALESCE($4, total_seats),
                departure_time = COALESCE($5, departure_time)
            WHERE id = $6
            RETURNING *
        `;
        const values = [
            status ?? null,
            base_price !== undefined && base_price !== null ? Number(base_price) : null,
            available_seats !== undefined && available_seats !== null ? Number(available_seats) : null,
            total_seats !== undefined && total_seats !== null ? Number(total_seats) : null,
            departure_time ?? null,
            id
        ];
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Поездка не найдена' });
        res.json({ message: 'Поездка обновлена', ride: result.rows[0] });
    } catch (err) {
        console.error('Ошибка admin PATCH /rides/:id:', err);
        res.status(500).json({ error: 'Ошибка обновления поездки' });
    }
});

// Удаление поездки
router.delete('/rides/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM rides WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Поездка не найдена' });
        res.json({ message: 'Поездка удалена', ride: result.rows[0] });
    } catch (err) {
        console.error('Ошибка admin DELETE /rides/:id:', err);
        res.status(500).json({ error: 'Ошибка удаления поездки' });
    }
});

// --- МАШИНЫ (VEHICLES) ---

// Получение списка всех автомобилей с поддержкой пагинации (🟡-5, 🟡-8)
router.get('/vehicles', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = (page - 1) * limit;

    try {
        const query = `
            SELECT
                v.id,
                v.driver_id,
                u.username AS driver_username,
                u.first_name AS driver_first_name,
                v.brand,
                v.color,
                v.license_plate,
                v.seats,
                v.created_at,
                COUNT(*) OVER() AS full_count
            FROM vehicles v
            LEFT JOIN users u ON v.driver_id = u.id
            ORDER BY v.created_at DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);
        const totalCount = result.rows.length > 0 ? Number(result.rows[0].full_count) : 0;
        const vehicles = result.rows.map(({ full_count, ...vData }) => vData);
        res.json({ count: vehicles.length, total_count: totalCount, page, limit, vehicles });
    } catch (err) {
        console.error('Ошибка admin /vehicles:', err);
        res.status(500).json({ error: 'Ошибка базы данных при получении автомобилей' });
    }
});

// Получение автомобиля по ID с явным перечнем колонок (🟡-7)
router.get('/vehicles/:id', async (req, res) => {
    try {
        const query = `
            SELECT id, driver_id, brand, color, license_plate, seats, created_at
            FROM vehicles
            WHERE id = $1
        `;
        const result = await pool.query(query, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Автомобиль не найден' });
        res.json({ vehicle: result.rows[0] });
    } catch (err) {
        console.error('Ошибка admin GET /vehicles/:id:', err);
        res.status(500).json({ error: 'Ошибка получения автомобиля' });
    }
});

// Редактирование данных автомобиля
router.patch('/vehicles/:id', async (req, res) => {
    const { id } = req.params;
    const { brand, color, license_plate } = req.body;
    try {
        const query = `
            UPDATE vehicles
            SET brand = COALESCE($1, brand),
                color = COALESCE($2, color),
                license_plate = COALESCE($3, license_plate)
            WHERE id = $4
            RETURNING *
        `;
        const values = [
            brand ? String(brand).trim() : null,
            color ? String(color).trim() : null,
            license_plate ? String(license_plate).trim().toUpperCase() : null,
            id
        ];
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Автомобиль не найден' });
        res.json({ message: 'Данные автомобиля обновлены', vehicle: result.rows[0] });
    } catch (err) {
        console.error('Ошибка admin PATCH /vehicles/:id:', err);
        res.status(500).json({ error: 'Ошибка обновления автомобиля' });
    }
});

// Удаление автомобиля
router.delete('/vehicles/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM vehicles WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Автомобиль не найден' });
        res.json({ message: 'Автомобиль удален', vehicle: result.rows[0] });
    } catch (err) {
        console.error('Ошибка admin DELETE /vehicles/:id:', err);
        res.status(500).json({ error: 'Ошибка удаления автомобиля' });
    }
});

module.exports = router;