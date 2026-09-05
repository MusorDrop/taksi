const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { isValidPhone } = require('../utils/validation');

/**
 * Санитизация объекта пользователя для безопасного ответа клиенту
 * @param {object} user - Запись пользователя из базы данных
 * @param {number|null} [averageRating=null] - Рассчитанный средний рейтинг пользователя
 * @returns {object} Профиль пользователя без пароля
 */
function formatUserProfile(user, averageRating = null) {
    const avg = averageRating !== null && averageRating !== undefined
        ? Number(averageRating)
        : (user.average_rating !== null && user.average_rating !== undefined
            ? Number(user.average_rating)
            : (user.rating !== null && user.rating !== undefined ? Number(user.rating) : null));

    return {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        role: user.role,
        rating: avg,
        average_rating: avg,
        is_verified: user.is_verified,
        is_blocked: Boolean(user.is_blocked),
        avatar_url: user.avatar_url || null,
        emergency_contact: user.emergency_contact,
        preferences: user.preferences,
        created_at: user.created_at
    };
}

/**
 * Создание подписанного JWT токена
 * @param {object} user - Запись пользователя
 * @returns {string} JWT токен
 */
function createToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

/**
 * Регистрация нового пользователя
 * @param {object} params - Параметры нового пользователя
 * @returns {Promise<object>} Созданная запись пользователя
 */
async function registerUser({ username, password, firstName, lastName, phone, role }) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const query = `
        INSERT INTO users (username, password_hash, first_name, last_name, phone, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, first_name, last_name, phone, role, rating, is_verified, emergency_contact, preferences, created_at
    `;
    const values = [username, passwordHash, firstName, lastName, phone, role];
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Контроллер регистрации нового пользователя
 * POST /api/auth/register
 */
async function register(req, res) {
    const { username, password, first_name, last_name, phone, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Поля username и password обязательны для заполнения'
        });
    }

    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    if (!trimmedUsername) {
        return res.status(400).json({
            error: 'Поля username и password обязательны для заполнения'
        });
    }

    if (trimmedUsername.length > 100) {
        return res.status(400).json({
            error: 'Имя пользователя не должно превышать 100 символов'
        });
    }

    // Проверка пароля на пустоту и длину (от 8 до 128 символов)
    if (typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({
            error: 'Пароль не может быть пустым'
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            error: 'Пароль должен содержать как минимум 8 символов'
        });
    }

    if (password.length > 128) {
        return res.status(400).json({
            error: 'Пароль не должен превышать 128 символов'
        });
    }

    // Проверка обязательного номера телефона и его формата при регистрации
    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
        return res.status(400).json({
            error: 'Поле phone (номер телефона) обязательно для регистрации'
        });
    }

    if (!isValidPhone(phone)) {
        return res.status(400).json({
            error: 'Некорректный формат номера телефона. Ожидается от 10 до 15 цифр (например, +79991234567)'
        });
    }

    // Проверка длины дополнительных полей (имя и фамилия)
    if (first_name && typeof first_name === 'string' && first_name.trim().length > 100) {
        return res.status(400).json({
            error: 'Имя не должно превышать 100 символов'
        });
    }

    if (last_name && typeof last_name === 'string' && last_name.trim().length > 100) {
        return res.status(400).json({
            error: 'Фамилия не должна превышать 100 символов'
        });
    }

    // Строгая валидация роли пользователя
    const ALLOWED_ROLES = ['driver', 'passenger', 'both'];
    const userRole = role !== undefined ? role : 'both';
    if (!ALLOWED_ROLES.includes(userRole)) {
        return res.status(400).json({
            error: "Недопустимая роль. Разрешены только: 'driver', 'passenger', 'both'"
        });
    }

    try {
        const newUser = await registerUser({
            username: trimmedUsername,
            password: password,
            firstName: first_name ? first_name.trim() : trimmedUsername,
            lastName: last_name ? last_name.trim() : null,
            phone: phone.trim(),
            role: userRole
        });

        const token = createToken(newUser);
        return res.status(201).json({
            message: 'Пользователь успешно зарегистрирован',
            token,
            user: formatUserProfile(newUser)
        });
    } catch (err) {
        // Код 23505: нарушение уникальности (Unique violation) в PostgreSQL
        if (err.code === '23505') {
            return res.status(409).json({
                error: 'Пользователь с таким именем уже существует'
            });
        }

        console.error('Ошибка в register контроллере:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при регистрации' });
    }
}

/**
 * Контроллер входа пользователя в систему
 * POST /api/auth/login
 */
async function login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Поля username и password обязательны для заполнения'
        });
    }

    const trimmedUsername = typeof username === 'string' ? username.trim() : '';

    if (!trimmedUsername || typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({
            error: 'Поля username и password обязательны для заполнения'
        });
    }

    try {
        const userQuery = 'SELECT * FROM users WHERE username = $1';
        const result = await pool.query(userQuery, [trimmedUsername]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const user = result.rows[0];
        if (user.is_blocked) {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован администратором' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const token = createToken(user);
        return res.json({
            message: 'Успешная авторизация',
            token,
            user: formatUserProfile(user)
        });
    } catch (err) {
        console.error('Ошибка в login контроллере:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при авторизации' });
    }
}

/**
 * Получение профиля текущего авторизованного пользователя
 * GET /api/auth/me
 */
async function getProfile(req, res) {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    try {
        const query = `
            SELECT 
                u.id,
                u.username,
                u.first_name,
                u.last_name,
                u.phone,
                u.role,
                u.rating,
                u.is_verified,
                u.is_blocked,
                u.avatar_url,
                u.emergency_contact,
                u.preferences,
                u.created_at,
                (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE reviewee_id = u.id) AS average_rating,
                (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = u.id) AS reviews_count
            FROM users u
            WHERE u.id = $1
        `;
        const result = await pool.query(query, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const userRow = result.rows[0];
        const averageRating = userRow.average_rating !== null && userRow.average_rating !== undefined
            ? Number(userRow.average_rating)
            : null;
        const formattedUser = formatUserProfile(userRow, averageRating);

        return res.json({
            user: formattedUser,
            average_rating: averageRating,
            reviews_count: userRow.reviews_count || 0
        });
    } catch (err) {
        console.error('Ошибка получения профиля:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

/**
 * Загрузка и обновление аватара пользователя
 * POST /api/auth/me/avatar
 */
async function uploadAvatar(req, res) {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'Файл аватара не предоставлен' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    try {
        const query = `
            UPDATE users
            SET avatar_url = $1
            WHERE id = $2
            RETURNING id, username, first_name, last_name, phone, role, rating, is_verified, is_blocked, avatar_url, emergency_contact, preferences, created_at
        `;
        const result = await pool.query(query, [avatarUrl, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const updatedUser = formatUserProfile(result.rows[0]);

        return res.json({
            message: 'Аватар успешно загружен',
            avatar_url: avatarUrl,
            user: updatedUser
        });
    } catch (err) {
        console.error('Ошибка в uploadAvatar:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при сохранении аватара' });
    }
}

/**
 * Обновление профиля текущего пользователя (телефон и Telegram)
 * PATCH /api/auth/me
 */
async function updateProfile(req, res) {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    const { phone, telegram, username, first_name } = req.body;

    const rawTg = telegram !== undefined ? telegram : username;
    let newTg = null;
    if (rawTg !== undefined) {
        if (typeof rawTg !== 'string' || rawTg.trim().length === 0) {
            return res.status(400).json({ error: 'Telegram / имя пользователя не может быть пустым' });
        }
        newTg = rawTg.replace(/^@/, '').trim();
        if (newTg.length > 100) {
            return res.status(400).json({ error: 'Telegram / имя пользователя не должно превышать 100 символов' });
        }
    }

    let newPhone = null;
    if (phone !== undefined) {
        if (typeof phone !== 'string' || phone.trim().length === 0) {
            return res.status(400).json({ error: 'Номер телефона не может быть пустым' });
        }
        newPhone = phone.trim();
        if (!isValidPhone(newPhone)) {
            return res.status(400).json({ error: 'Некорректный формат номера телефона. Ожидается от 10 до 15 цифр' });
        }
        if (newPhone.length > 20) {
            return res.status(400).json({ error: 'Номер телефона не должен превышать 20 символов' });
        }
    }

    let newFirstName = null;
    if (first_name !== undefined) {
        if (typeof first_name !== 'string' || first_name.trim().length === 0) {
            return res.status(400).json({ error: 'Имя не может быть пустым' });
        }
        newFirstName = first_name.trim();
        if (newFirstName.length > 100) {
            return res.status(400).json({ error: 'Имя не должно превышать 100 символов' });
        }
    }

    if (newTg === null && newPhone === null && newFirstName === null) {
        return res.status(400).json({ error: 'Необходимо указать хотя бы одно поле для обновления (phone или telegram)' });
    }

    try {
        if (newTg) {
            const checkConflict = await pool.query(
                'SELECT id FROM users WHERE username = $1 AND id != $2',
                [newTg, req.user.id]
            );
            if (checkConflict.rows.length > 0) {
                return res.status(409).json({ error: 'Пользователь с таким Telegram / именем уже существует' });
            }
        }

        const query = `
            UPDATE users
            SET
                username = COALESCE($1, username),
                phone = COALESCE($2, phone),
                first_name = COALESCE($3, first_name)
            WHERE id = $4
            RETURNING 
                id, username, first_name, last_name, phone, role, rating, is_verified, 
                is_blocked, avatar_url, emergency_contact, preferences, created_at,
                (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE reviewee_id = users.id) AS average_rating
        `;

        const result = await pool.query(query, [newTg, newPhone, newFirstName, req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const userRow = result.rows[0];
        const formattedUser = formatUserProfile(userRow, userRow.average_rating);

        return res.json({
            message: 'Профиль успешно обновлен',
            user: formattedUser
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Пользователь с таким Telegram / именем уже существует' });
        }
        console.error('Ошибка в updateProfile:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при обновлении профиля' });
    }
}

module.exports = {
    register,
    login,
    getProfile,
    uploadAvatar,
    updateProfile,
    formatUserProfile,
    createToken
};


