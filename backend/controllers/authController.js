const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

/**
 * Санитизация объекта пользователя для безопасного ответа клиенту
 * @param {object} user - Запись пользователя из базы данных
 * @returns {object} Профиль пользователя без пароля
 */
function formatUserProfile(user) {
    return {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        role: user.role,
        rating: user.rating !== null ? Number(user.rating) : null,
        is_verified: user.is_verified,
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
        RETURNING *
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

    // Ограничение длины username в соответствии с VARCHAR(100) в схеме БД
    if (trimmedUsername.length > 100) {
        return res.status(400).json({
            error: 'Имя пользователя не может быть длиннее 100 символов'
        });
    }

    // Ограничение длины номера телефона в соответствии с VARCHAR(20) в схеме БД
    if (phone !== undefined && phone !== null && String(phone).trim().length > 20) {
        return res.status(400).json({
            error: 'Номер телефона не может быть длиннее 20 символов'
        });
    }

    // Проверка пароля на пустоту и минимальную длину (не менее 8 символов)
    if (typeof password !== 'string' || !password.trim()) {
        return res.status(400).json({
            error: 'Пароль не может быть пустым'
        });
    }

    const trimmedPassword = password.trim();
    if (trimmedPassword.length < 8) {
        return res.status(400).json({
            error: 'Пароль должен содержать как минимум 8 символов'
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
            password: trimmedPassword,
            firstName: first_name ? first_name.trim() : trimmedUsername,
            lastName: last_name ? last_name.trim() : null,
            phone: phone ? phone.trim() : null,
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
    const trimmedPassword = typeof password === 'string' ? password.trim() : '';

    if (!trimmedUsername || !trimmedPassword) {
        return res.status(400).json({
            error: 'Поля username и password обязательны для заполнения'
        });
    }

    try {
        const userQuery = 'SELECT * FROM users WHERE username = $1';
        const result = await pool.query(userQuery, [trimmedUsername]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(trimmedPassword, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Неверный пароль' });
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
        const query = 'SELECT * FROM users WHERE id = $1';
        const result = await pool.query(query, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        return res.json({ user: formatUserProfile(result.rows[0]) });
    } catch (err) {
        console.error('Ошибка получения профиля:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = {
    register,
    login,
    getProfile,
    formatUserProfile,
    createToken
};
