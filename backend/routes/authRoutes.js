const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Ограничение частоты запросов для аутентификации (максимум 5 запросов за 1 минуту)
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: {
        error: 'Слишком много попыток входа или регистрации. Пожалуйста, повторите попытку через 1 минуту.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Регистрация нового пользователя
router.post('/register', authLimiter, authController.register);

// Авторизация пользователя
router.post('/login', authLimiter, authController.login);

// Получение профиля текущего пользователя
router.get('/me', authenticateToken, authController.getProfile);

// Обновление профиля текущего пользователя (telegram_username)
router.patch('/me', authenticateToken, authController.updateProfile);

module.exports = router;
