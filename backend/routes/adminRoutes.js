const express = require('express');
const pool = require('../db');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// Защита всех эндпоинтов администратора
router.use(adminMiddleware);

// --- ПОЛЬЗОВАТЕЛИ (USERS) ---

// Получение списка всех пользователей
router.get('/users', async (req, res) => {
    try {
        const query = `
            SELECT id, username, first_name, last_name, phone, role, rating, is_verified, is_blocked, avatar_url, created_at
            FROM users
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query);
        res.json({ count: result.rows.length, users: result.rows });
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
    try {
        let query;
        let values;
        if (typeof is_blocked === 'boolean') {
            query = 'UPDATE users SET is_blocked = $1 WHERE id = $2 RETURNING id, username, is_blocked';
            values = [is_blocked, id];
        } else {
            query = 'UPDATE users SET is_blocked = NOT is_blocked WHERE id = $1 RETURNING id, username, is_blocked';
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

// Получение списка всех поездок
router.get('/rides', async (req, res) => {
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
                r.created_at
            FROM rides r
            LEFT JOIN users u ON r.driver_id = u.id
            ORDER BY r.created_at DESC
        `;
        const result = await pool.query(query);
        res.json({ count: result.rows.length, rides: result.rows });
    } catch (err) {
        console.error('Ошибка admin /rides:', err);
        res.status(500).json({ error: 'Ошибка базы данных при получении поездок' });
    }
});

// Получение информации о поездке по ID
router.get('/rides/:id', async (req, res) => {
    try {
        const query = 'SELECT * FROM rides WHERE id = $1';
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
    try {
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
        const values = [status ?? null, base_price !== undefined ? Number(base_price) : null, available_seats !== undefined ? Number(available_seats) : null, total_seats !== undefined ? Number(total_seats) : null, departure_time ?? null, id];
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

// Получение списка всех автомобилей
router.get('/vehicles', async (req, res) => {
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
                v.created_at
            FROM vehicles v
            LEFT JOIN users u ON v.driver_id = u.id
            ORDER BY v.created_at DESC
        `;
        const result = await pool.query(query);
        res.json({ count: result.rows.length, vehicles: result.rows });
    } catch (err) {
        console.error('Ошибка admin /vehicles:', err);
        res.status(500).json({ error: 'Ошибка базы данных при получении автомобилей' });
    }
});

// Получение автомобиля по ID
router.get('/vehicles/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
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
        const values = [brand ?? null, color ?? null, license_plate ? license_plate.toUpperCase() : null, id];
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