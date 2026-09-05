const pool = require('../db');

/**
 * Валидация входных данных для создания автомобиля
 * @param {object} body - Тело запроса
 * @returns {{isValid: boolean, error: string|null, data: object|null}} Результат проверки
 */
function validateVehicleInput(body) {
    const { brand, color, license_plate } = body;

    if (!brand || typeof brand !== 'string' || brand.trim().length === 0) {
        return { isValid: false, error: 'Поле brand обязательно для заполнения', data: null };
    }

    if (!license_plate || typeof license_plate !== 'string' || license_plate.trim().length === 0) {
        return { isValid: false, error: 'Поле license_plate обязательно для заполнения', data: null };
    }

    const sanitizedBrand = brand.trim();
    const sanitizedPlate = license_plate.trim().toUpperCase();
    const sanitizedColor = typeof color === 'string' && color.trim().length > 0 ? color.trim() : null;

    return {
        isValid: true,
        error: null,
        data: {
            brand: sanitizedBrand,
            color: sanitizedColor,
            licensePlate: sanitizedPlate
        }
    };
}

/**
 * Контроллер добавления автомобиля текущего водителя
 * POST /api/vehicles
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function createVehicle(req, res) {
    const driverId = req.user?.id;
    if (!driverId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const validation = validateVehicleInput(req.body);
    if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
    }

    const { brand, color, licensePlate } = validation.data;

    try {
        const query = `
            INSERT INTO vehicles (driver_id, brand, color, license_plate)
            VALUES ($1, $2, $3, $4)
            RETURNING id, driver_id, brand, color, license_plate, created_at
        `;

        const result = await pool.query(query, [driverId, brand, color, licensePlate]);
        const createdVehicle = result.rows[0];

        return res.status(201).json({
            message: 'Автомобиль успешно добавлен',
            vehicle: createdVehicle
        });
    } catch (err) {
        console.error('Ошибка добавления автомобиля:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при добавлении автомобиля' });
    }
}

/**
 * Контроллер получения списка автомобилей текущего пользователя
 * GET /api/vehicles
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function getVehicles(req, res) {
    const driverId = req.user?.id;
    if (!driverId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    try {
        const query = `
            SELECT id, driver_id, brand, color, license_plate, created_at
            FROM vehicles
            WHERE driver_id = $1
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query, [driverId]);

        return res.json({
            count: result.rows.length,
            vehicles: result.rows
        });
    } catch (err) {
        console.error('Ошибка при получении автомобилей:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при получении автомобилей' });
    }
}

module.exports = {
    createVehicle,
    getVehicles,
    validateVehicleInput
};
