const pool = require('../db');
const { isValidUuid } = require('../utils/validation');

/**
 * Валидация входных данных для создания автомобиля
 * @param {object} body - Тело запроса
 * @returns {{isValid: boolean, error: string|null, data: object|null}} Результат проверки
 */
function validateVehicleInput(body) {
    const { brand, color, license_plate, seats } = body;

    if (!brand || typeof brand !== 'string' || brand.trim().length === 0) {
        return { isValid: false, error: 'Поле brand обязательно для заполнения', data: null };
    }

    if (!license_plate || typeof license_plate !== 'string' || license_plate.trim().length === 0) {
        return { isValid: false, error: 'Поле license_plate обязательно для заполнения', data: null };
    }

    let parsedSeats = 4;
    if (seats !== undefined && seats !== null && String(seats).trim() !== '') {
        const parsed = parseInt(seats, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 8) {
            return { isValid: false, error: 'Количество мест должно быть числом от 1 до 8', data: null };
        }
        parsedSeats = parsed;
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
            licensePlate: sanitizedPlate,
            seats: parsedSeats
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

    const { brand, color, licensePlate, seats } = validation.data;

    try {
        const query = `
            INSERT INTO vehicles (driver_id, brand, color, license_plate, seats)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, driver_id, brand, color, license_plate, seats, created_at
        `;

        const result = await pool.query(query, [driverId, brand, color, licensePlate, seats]);
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
            SELECT id, driver_id, brand, color, license_plate, seats, created_at
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

/**
 * Редактирование существующего автомобиля водителя
 * PATCH /api/vehicles/:id
 */
async function updateVehicle(req, res) {
    const driverId = req.user?.id;
    if (!driverId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
        return res.status(400).json({ error: 'Некорректный формат идентификатора автомобиля (UUID)' });
    }

    try {
        const checkRes = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Автомобиль не найден' });
        }
        if (checkRes.rows[0].driver_id !== driverId) {
            return res.status(403).json({ error: 'Вы не являетесь владельцем этого автомобиля' });
        }

        const { brand, color, license_plate, seats } = req.body;

        let sanitizedBrand = null;
        if (brand !== undefined) {
            if (typeof brand !== 'string' || brand.trim().length === 0) {
                return res.status(400).json({ error: 'Марка автомобиля не может быть пустой' });
            }
            sanitizedBrand = brand.trim();
        }

        let sanitizedPlate = null;
        if (license_plate !== undefined) {
            if (typeof license_plate !== 'string' || license_plate.trim().length === 0) {
                return res.status(400).json({ error: 'Госномер не может быть пустым' });
            }
            sanitizedPlate = license_plate.trim().toUpperCase();
        }

        let sanitizedColor = null;
        if (color !== undefined) {
            sanitizedColor = typeof color === 'string' && color.trim().length > 0 ? color.trim() : null;
        }

        let sanitizedSeats = null;
        if (seats !== undefined) {
            const numSeats = parseInt(seats, 10);
            if (isNaN(numSeats) || numSeats < 1 || numSeats > 8) {
                return res.status(400).json({ error: 'Количество мест должно быть числом от 1 до 8' });
            }
            sanitizedSeats = numSeats;
        }

        const updateQuery = `
            UPDATE vehicles
            SET
                brand = COALESCE($1, brand),
                license_plate = COALESCE($2, license_plate),
                color = CASE WHEN $3::boolean THEN $4 ELSE color END,
                seats = COALESCE($5, seats)
            WHERE id = $6 AND driver_id = $7
            RETURNING id, driver_id, brand, color, license_plate, seats, created_at
        `;

        const result = await pool.query(updateQuery, [
            sanitizedBrand,
            sanitizedPlate,
            color !== undefined,
            sanitizedColor,
            sanitizedSeats,
            id,
            driverId
        ]);

        return res.json({
            message: 'Автомобиль успешно обновлен',
            vehicle: result.rows[0]
        });
    } catch (err) {
        console.error('Ошибка обновления автомобиля:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при обновлении автомобиля' });
    }
}

module.exports = {
    createVehicle,
    getVehicles,
    updateVehicle,
    validateVehicleInput
};
