const jwt = require('jsonwebtoken');

// Секретный ключ для подписи и верификации JWT токенов
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is missing');
}

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

module.exports = {
    JWT_SECRET,
    authenticateToken
};
