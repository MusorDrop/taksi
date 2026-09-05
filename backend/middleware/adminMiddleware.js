/**
 * Middleware для аутентификации администратора по ключу в заголовке X-Admin-Key.
 * Проверяет наличие ключа, его фиксированную длину (30 символов) и соответствие переменной ADMIN_SECRET.
 */
function adminMiddleware(req, res, next) {
    const adminKey = req.headers['x-admin-key'];

    if (!adminKey) {
        return res.status(401).json({ error: 'Отсутствует заголовок X-Admin-Key' });
    }

    // Проверка длины ключа: ровно 30 символов
    if (typeof adminKey !== 'string' || adminKey.trim().length !== 30) {
        return res.status(403).json({ error: 'Неверный формат ключа администратора (требуется ровно 30 символов)' });
    }

    const validSecret = process.env.ADMIN_SECRET || 'poputka_admin_secret_key_30chr';
    if (adminKey.trim() !== validSecret) {
        return res.status(403).json({ error: 'Неверный ключ администратора' });
    }

    return next();
}

module.exports = adminMiddleware;
