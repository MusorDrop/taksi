const jwt = require('jsonwebtoken');

// Секретный ключ для подписи и верификации JWT токенов
const JWT_SECRET = process.env.JWT_SECRET || 'poputka-ai-secret-key-urfu';

/**
 * Обязательная проверка JWT токена из заголовка Authorization
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен авторизации отсутствует' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (err) {
        return res.status(403).json({ error: 'Недействительный или истекший токен' });
    }
}

/**
 * Опциональная проверка JWT токена (если передан — извлекаем пользователя)
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
    } catch (err) {
        // Игнорируем ошибку для опциональной авторизации
        req.user = null;
    }

    return next();
}

module.exports = {
    JWT_SECRET,
    authenticateToken,
    optionalAuth
};
