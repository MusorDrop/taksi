const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./authMiddleware');

/**
 * Регулярное выражение для выявления консольных утилит, ботов и HTTP-библиотек.
 */
const DISALLOWED_USER_AGENTS = /curl|postman|python|axios|wget|httpie|aiohttp|urllib|insomnia|node-fetch|go-http-client|okhttp/i;

/**
 * Проверка заголовка User-Agent на принадлежность к настоящему браузеру.
 * @param {string | undefined} userAgent - Строка User-Agent из заголовков запроса.
 * @returns {boolean} true, если клиент является веб-браузером.
 */
function isValidBrowserUserAgent(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') {
        return false;
    }

    const trimmedAgent = userAgent.trim();
    if (trimmedAgent.length === 0) {
        return false;
    }

    if (DISALLOWED_USER_AGENTS.test(trimmedAgent)) {
        return false;
    }

    // Все распространенные десктопные и мобильные браузеры содержат идентификатор Mozilla
    return trimmedAgent.includes('Mozilla');
}

/**
 * Проверка заголовка Sec-Fetch-Mode, выставляемого браузером при запросах fetch/XHR.
 * @param {string | undefined} fetchMode - Значение заголовка Sec-Fetch-Mode.
 * @returns {boolean} true, если режим запроса соответствует браузерному вызову.
 */
function isValidFetchMode(fetchMode) {
    if (!fetchMode || typeof fetchMode !== 'string') {
        return true;
    }

    const normalizedMode = fetchMode.trim().toLowerCase();
    return normalizedMode === 'cors' || normalizedMode === 'same-origin' || normalizedMode === 'navigate';
}

/**
 * Извлечение и нормализация origin из заголовков Origin или Referer.
 * @param {import('express').Request} req - Объект входящего HTTP-запроса.
 * @returns {string | null} Нормализованный источник запроса без завершающих слэшей.
 */
function extractRequestOrigin(req) {
    const originHeader = req.headers.origin;
    if (originHeader && typeof originHeader === 'string') {
        return originHeader.trim().replace(/\/+$/, '').toLowerCase();
    }

    const refererHeader = req.headers.referer;
    if (refererHeader && typeof refererHeader === 'string') {
        try {
            return new URL(refererHeader).origin.toLowerCase();
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Получение списка разрешенных источников для веб-клиента.
 * @returns {string[]} Список доверенных origin.
 */
function getAllowedOrigins() {
    const defaults = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:4173',
        'http://127.0.0.1:4173'
    ];
    if (!process.env.ALLOWED_ORIGINS) {
        return defaults;
    }

    const envOrigins = process.env.ALLOWED_ORIGINS
        .split(',')
        .map((item) => item.trim().replace(/\/+$/, '').toLowerCase())
        .filter(Boolean);

    return Array.from(new Set([...defaults, ...envOrigins]));
}

/**
 * Регулярное выражение для доверенных локальных источников разработки
 */
const LOCAL_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const LOCAL_HOST_REGEX = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Проверка источника запроса (Origin/Referer) на принадлежность к разрешенным адресам приложения.
 * Устранена уязвимость Host Header Poisoning и подделки Origin.
 * @param {import('express').Request} req - Объект входящего HTTP-запроса.
 * @returns {boolean} true, если запрос поступил с доверенного веб-клиента.
 */
function isTrustedOrigin(req) {
    const requestOrigin = extractRequestOrigin(req);
    const host = req.headers.host;
    const allowedOrigins = getAllowedOrigins();

    if (requestOrigin) {
        if (allowedOrigins.includes(requestOrigin)) {
            return true;
        }
        if (LOCAL_ORIGIN_REGEX.test(requestOrigin)) {
            return true;
        }
        return false;
    }

    // Если Origin/Referer отсутствует, проверяем строго Host
    if (!host) {
        return false;
    }

    const hostLower = host.toLowerCase().trim();
    if (LOCAL_HOST_REGEX.test(hostLower)) {
        return true;
    }

    for (const origin of allowedOrigins) {
        try {
            const parsed = new URL(origin);
            if (parsed.host.toLowerCase() === hostLower) {
                return true;
            }
        } catch (_) {}
    }

    return false;
}

/**
 * Валидация секретного ключа администратора в заголовке X-Admin-Key.
 * Устранены атака по времени (Timing Attack) и жестко закодированный ключ по умолчанию.
 * @param {string | undefined} adminKey - Переданный ключ администратора.
 * @returns {{ valid: boolean; status?: number; error?: string }} Результат проверки ключа.
 */
function validateAdminSecret(adminKey) {
    if (!adminKey) {
        return { valid: false, status: 401, error: 'Отсутствует заголовок X-Admin-Key' };
    }

    if (typeof adminKey !== 'string') {
        return {
            valid: false,
            status: 403,
            error: 'Неверный формат ключа администратора'
        };
    }

    const trimmedKey = adminKey.trim();
    if (trimmedKey.length !== 30) {
        return {
            valid: false,
            status: 403,
            error: 'Неверный формат ключа администратора (требуется ровно 30 символов)'
        };
    }

    const validSecret = process.env.ADMIN_SECRET;
    if (!validSecret) {
        return {
            valid: false,
            status: 500,
            error: 'Конфигурация безопасности сервера не завершена: переменная ADMIN_SECRET не установлена'
        };
    }

    // Защита от атак по времени (Timing Attack) с использованием криптографического сравнения постоянного времени
    const keyHash = crypto.createHash('sha256').update(trimmedKey).digest();
    const secretHash = crypto.createHash('sha256').update(validSecret.trim()).digest();

    if (!crypto.timingSafeEqual(keyHash, secretHash)) {
        return { valid: false, status: 403, error: 'Неверный ключ администратора' };
    }

    return { valid: true };
}

/**
 * Middleware для защиты API администратора:
 * 1. Проверяет браузерные заголовки (User-Agent, Sec-Fetch-Mode, Origin/Referer).
 * 2. Проверяет секретный ключ администратора X-Admin-Key с защитой от тайминг-атак.
 */
function adminMiddleware(req, res, next) {
    if (req.method === 'OPTIONS') {
        return next();
    }

    const userAgent = req.headers['user-agent'];
    if (!isValidBrowserUserAgent(userAgent)) {
        return res.status(403).json({
            error: 'Доступ запрещен: обращение к API администратора разрешено только из браузера (некорректный User-Agent)'
        });
    }

    const fetchMode = req.headers['sec-fetch-mode'];
    if (!isValidFetchMode(fetchMode)) {
        return res.status(403).json({
            error: 'Доступ запрещен: обращение к API администратора разрешено только через браузерные запросы (Sec-Fetch-Mode)'
        });
    }

    if (!isTrustedOrigin(req)) {
        return res.status(403).json({
            error: 'Доступ запрещен: обращение к API администратора разрешено только с доверенного веб-клиента (Origin/Referer)'
        });
    }

    const keyValidation = validateAdminSecret(req.headers['x-admin-key']);
    if (!keyValidation.valid) {
        return res.status(keyValidation.status || 403).json({ error: keyValidation.error });
    }

    // Если передан заголовок Authorization, верифицируем JWT для идентификации администратора и аудита
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Токен администратора отсутствует' });
        }
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.adminUser = decoded;
            req.user = decoded;
        } catch {
            return res.status(401).json({ error: 'Недействительный токен администратора' });
        }
    }

    return next();
}


module.exports = adminMiddleware;