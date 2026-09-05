const pool = require('../db');

// Регулярное выражение для валидации UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Валидация формата UUID
 * @param {string} id - Проверяемый идентификатор
 * @returns {boolean} true, если строка соответствует формату UUID
 */
function isValidUuid(id) {
    return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * Валидация входных данных для создания нового отзыва
 * @param {object} body - Тело запроса
 * @param {string} reviewerId - Идентификатор автора отзыва
 * @returns {{isValid: boolean, error: string|null, data: object|null}} Результат проверки
 */
function validateReviewInput(body, reviewerId) {
    const { ride_id, reviewee_id, rating, comment } = body;

    if (!ride_id || !reviewee_id || rating === undefined || rating === null) {
        return { isValid: false, error: 'Поля ride_id, reviewee_id и rating обязательны для заполнения', data: null };
    }

    if (!isValidUuid(ride_id) || !isValidUuid(reviewee_id)) {
        return { isValid: false, error: 'Поля ride_id и reviewee_id должны быть корректными UUID', data: null };
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
        return { isValid: false, error: 'Рейтинг должен быть целым числом в диапазоне от 1 до 5', data: null };
    }

    if (reviewerId === reviewee_id) {
        return { isValid: false, error: 'Нельзя оставить отзыв самому себе', data: null };
    }

    const sanitizedComment = typeof comment === 'string' && comment.trim().length > 0 ? comment.trim() : null;

    return {
        isValid: true,
        error: null,
        data: {
            rideId: ride_id,
            reviewerId,
            revieweeId: reviewee_id,
            rating: numericRating,
            comment: sanitizedComment
        }
    };
}

/**
 * Пересчет и обновление среднего рейтинга пользователя в таблице users
 * @param {import('pg').Pool} db - Пул подключений к базе данных
 * @param {string} userId - Идентификатор оцениваемого пользователя
 * @returns {Promise<number|null>} Обновленный средний рейтинг
 */
async function updateUserAverageRating(db, userId) {
    const query = `
        WITH calculated AS (
            SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating
            FROM reviews
            WHERE reviewee_id = $1
        )
        UPDATE users
        SET rating = calculated.avg_rating
        FROM calculated
        WHERE users.id = $1
        RETURNING users.rating
    `;
    const result = await db.query(query, [userId]);
    const updatedRating = result.rows[0]?.rating;

    if (updatedRating === null || updatedRating === undefined) {
        return null;
    }
    return Number(updatedRating);
}

/**
 * Контроллер создания нового отзыва о поездке
 * POST /api/reviews
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function createReview(req, res) {
    const reviewerId = req.user?.id;
    if (!reviewerId) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const validation = validateReviewInput(req.body, reviewerId);
    if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
    }

    const { rideId, revieweeId, rating, comment } = validation.data;

    try {
        // Проверка существования поездки
        const rideCheck = await pool.query('SELECT id FROM rides WHERE id = $1', [rideId]);
        if (rideCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        // Проверка существования оцениваемого пользователя
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [revieweeId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Оцениваемый пользователь не найден' });
        }

        // Вставка новой записи в таблицу reviews
        const insertQuery = `
            INSERT INTO reviews (ride_id, reviewer_id, reviewee_id, rating, comment)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, ride_id, reviewer_id, reviewee_id, rating, comment, created_at
        `;
        const insertRes = await pool.query(insertQuery, [rideId, reviewerId, revieweeId, rating, comment]);
        const createdReview = insertRes.rows[0];

        // Пересчет и сохранение среднего рейтинга пользователя
        const updatedRating = await updateUserAverageRating(pool, revieweeId);

        return res.status(201).json({
            message: 'Отзыв успешно добавлен',
            review: createdReview,
            average_rating: updatedRating
        });
    } catch (err) {
        console.error('Ошибка добавления отзыва:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при создании отзыва' });
    }
}

/**
 * Контроллер получения списка отзывов с опциональной фильтрацией
 * GET /api/reviews
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function getReviews(req, res) {
    const { user_id, ride_id } = req.query;

    try {
        let query = `
            SELECT r.id, r.ride_id, r.reviewer_id, r.reviewee_id, r.rating, r.comment, r.created_at,
                   u.username AS reviewer_username, u.first_name AS reviewer_first_name
            FROM reviews r
            JOIN users u ON u.id = r.reviewer_id
        `;
        const conditions = [];
        const params = [];

        if (user_id) {
            if (!isValidUuid(user_id)) {
                return res.status(400).json({ error: 'Некорректный UUID пользователя' });
            }
            params.push(user_id);
            conditions.push(`r.reviewee_id = $${params.length}`);
        }

        if (ride_id) {
            if (!isValidUuid(ride_id)) {
                return res.status(400).json({ error: 'Некорректный UUID поездки' });
            }
            params.push(ride_id);
            conditions.push(`r.ride_id = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ' ORDER BY r.created_at DESC LIMIT 50';

        const result = await pool.query(query, params);
        return res.json({
            count: result.rows.length,
            reviews: result.rows
        });
    } catch (err) {
        console.error('Ошибка при получении отзывов:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при получении отзывов' });
    }
}

module.exports = {
    createReview,
    getReviews,
    updateUserAverageRating,
    validateReviewInput,
    isValidUuid
};
