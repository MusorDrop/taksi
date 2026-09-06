const pool = require('../db');
const { isValidUuid } = require('../utils/validation');

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
 * Проверка участия пользователя в поездке (как водитель или подтвержденный пассажир)
 * @param {import('pg').PoolClient | import('pg').Pool} db - Клиент БД
 * @param {string} rideId - ID поездки
 * @param {string} userId - ID пользователя
 * @param {string} driverId - ID водителя
 * @returns {Promise<boolean>}
 */
async function isRideParticipant(db, rideId, userId, driverId) {
    if (userId === driverId) {
        return true;
    }
    const matchRes = await db.query(
        "SELECT id FROM matches WHERE ride_id = $1 AND passenger_id = $2 AND status IN ('accepted', 'completed')",
        [rideId, userId]
    );
    return matchRes.rows.length > 0;
}

/**
 * Пересчет и обновление среднего рейтинга пользователя в таблице users
 * @param {import('pg').PoolClient | import('pg').Pool} db - Пул подключений или клиент базы данных
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

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Проверка существования поездки и получение driver_id и status
        const rideCheck = await client.query('SELECT id, driver_id, status FROM rides WHERE id = $1', [rideId]);
        if (rideCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Поездка не найдена' });
        }

        const { driver_id: driverId, status: rideStatus } = rideCheck.rows[0];

        // Оставлять отзывы разрешено только после завершения поездки
        if (rideStatus !== 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Оставлять отзывы можно только после завершения поездки' });
        }

        // Проверка существования оцениваемого пользователя
        const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [revieweeId]);
        if (userCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Оцениваемый пользователь не найден' });
        }

        // 🟠-2: Проверка участия автора отзыва в данной поездке
        const isReviewerParticipant = await isRideParticipant(client, rideId, reviewerId, driverId);
        if (!isReviewerParticipant) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Оставлять отзыв могут только участники поездки' });
        }

        // 🟠-4: Проверка участия оцениваемого пользователя в данной поездке
        const isRevieweeParticipant = await isRideParticipant(client, rideId, revieweeId, driverId);
        if (!isRevieweeParticipant) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Оцениваемый пользователь не является участником данной поездки' });
        }

        // Проверка дубликата отзыва (один отзыв от автора конкретному участнику поездки)
        const duplicateCheck = await client.query(
            'SELECT id FROM reviews WHERE ride_id = $1 AND reviewer_id = $2 AND reviewee_id = $3',
            [rideId, reviewerId, revieweeId]
        );
        if (duplicateCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Вы уже оставили отзыв об этом участнике для данной поездки' });
        }

        // Вставка новой записи в таблицу reviews
        const insertQuery = `
            INSERT INTO reviews (ride_id, reviewer_id, reviewee_id, rating, comment)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, ride_id, reviewer_id, reviewee_id, rating, comment, created_at
        `;
        const insertRes = await client.query(insertQuery, [rideId, reviewerId, revieweeId, rating, comment]);
        const createdReview = insertRes.rows[0];

        // Пересчет и сохранение среднего рейтинга пользователя в транзакции (🟠-1)
        const updatedRating = await updateUserAverageRating(client, revieweeId);

        await client.query('COMMIT');

        return res.status(201).json({
            message: 'Отзыв успешно добавлен',
            review: createdReview,
            average_rating: updatedRating
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка добавления отзыва:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при создании отзыва' });
    } finally {
        client.release();
    }
}

/**
 * Контроллер получения списка отзывов с опциональной фильтрацией и пагинацией (🟡-3).
 * Открытый доступ к GET /api/reviews (без обязательной авторизации) является осознанным
 * решением архитектуры: потенциальные пассажиры должны иметь возможность ознакомиться с
 * отзывами и рейтингом водителя перед выбором поездки и регистрацией (🟠-5).
 * GET /api/reviews
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function getReviews(req, res) {
    const userId = req.query.reviewee_id || req.query.user_id;
    const { ride_id } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    try {
        let query = `
            SELECT r.id, r.ride_id, r.reviewer_id, r.reviewee_id, r.rating, r.comment, r.created_at,
                   u.username AS reviewer_username, u.first_name AS reviewer_first_name,
                   COUNT(*) OVER() AS full_count
            FROM reviews r
            JOIN users u ON u.id = r.reviewer_id
        `;
        const conditions = [];
        const params = [];

        if (userId) {
            if (!isValidUuid(userId)) {
                return res.status(400).json({ error: 'Некорректный UUID пользователя' });
            }
            params.push(userId);
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

        params.push(limit);
        const limitParamIndex = params.length;
        params.push(offset);
        const offsetParamIndex = params.length;

        query += ` ORDER BY r.created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;

        const result = await pool.query(query, params);
        const totalCount = result.rows.length > 0 ? Number(result.rows[0].full_count) : 0;
        const reviews = result.rows.map((row) => {
            const { full_count, ...reviewData } = row;
            return reviewData;
        });

        return res.json({
            count: reviews.length,
            total_count: totalCount,
            page,
            limit,
            reviews
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
    validateReviewInput
};
