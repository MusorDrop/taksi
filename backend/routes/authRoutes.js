const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Ограничение частоты запросов для аутентификации (максимум 5 запросов за 15 минут)
// Отключается в тестовом окружении
const authLimiter = process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: {
            error: 'Слишком много попыток входа или регистрации. Пожалуйста, повторите попытку через 15 минут.'
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

// Загрузка аватарки текущего пользователя
router.post('/me/avatar', authenticateToken, (req, res, next) => {
    uploadAvatar.single('avatar')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
        }
        next();
    });
}, authController.uploadAvatar);

module.exports = router;
