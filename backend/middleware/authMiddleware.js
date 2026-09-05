const jwt = require('jsonwebtoken');
const pool = require('../db');

// Секретный ключ для подписи и верификации JWT токенов
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is missing');
}

/**
 * Обязательная проверка JWT токена из заголовка Authorization
 * и актуального статуса блокировки пользователя в базе данных.
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен авторизации отсутствует' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(403).json({ error: 'Недействительный или истекший токен' });
    }

    try {
        const userCheck = await pool.query('SELECT id, is_blocked, role FROM users WHERE id = $1', [decoded.id]);
        if (userCheck.rows.length === 0) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }

        if (userCheck.rows[0].is_blocked) {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован администратором' });
        }

        req.user = {
            ...decoded,
            role: userCheck.rows[0].role
        };
        return next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Недействительный или истекший токен' });
        }
        console.error('Ошибка проверки пользователя в authMiddleware:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при проверке авторизации' });
    }
}

module.exports = {
    JWT_SECRET,
    authenticateToken
};

