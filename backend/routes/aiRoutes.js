const express = require('express');
const rateLimit = require('express-rate-limit');
const aiController = require('../controllers/aiController');

const router = express.Router();

// Ограничение частоты запросов для AI-парсинга (максимум 30 запросов в минуту)
const aiLimiter = process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 30,
        message: {
            error: 'Слишком много запросов к AI-сервису. Пожалуйста, повторите попытку через минуту.'
        },
        standardHeaders: true,
        legacyHeaders: false
    });

router.use(aiLimiter);

// Парсинг текста поездки через GigaChat AI с геокодированием адресов
router.post('/parse', aiController.parseRide);

module.exports = router;