const rateLimit = require('express-rate-limit');

/**
 * Ограничитель частоты запросов для операций записи (создание поездок, отзывов, автомобилей).
 * Предотвращает спам и DoS-атаки на создание ресурсов.
 * В тестовом окружении (NODE_ENV === 'test') отключен для стабильности тестов.
 */
const apiWriteLimiter = process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 60 * 1000,
        max: 30,
        message: {
            error: 'Слишком много запросов на создание данных. Пожалуйста, повторите попытку через минуту.'
        },
        standardHeaders: true,
        legacyHeaders: false
    });

module.exports = {
    apiWriteLimiter
};
