const express = require('express');
const rateLimit = require('express-rate-limit');
const reviewController = require('../controllers/reviewController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Ограничение частоты запросов для отзывов (максимум 60 запросов за 1 минуту)
// Отключается в тестовом окружении (🟡-5)
const reviewLimiter = process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 60,
        message: {
            error: 'Слишком много запросов к сервису отзывов. Пожалуйста, повторите попытку через минуту.'
        },
        standardHeaders: true,
        legacyHeaders: false
    });

router.use(reviewLimiter);

// Создание отзыва о водителе или пассажире после поездки
router.post('/', authenticateToken, reviewController.createReview);

// Получение списка отзывов с возможностью фильтрации
router.get('/', reviewController.getReviews);

module.exports = router;
