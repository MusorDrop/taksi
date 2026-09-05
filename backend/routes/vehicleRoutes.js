const express = require('express');
const rateLimit = require('express-rate-limit');
const vehicleController = require('../controllers/vehicleController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Ограничение частоты запросов для автомобилей (максимум 60 запросов за 1 минуту)
// Отключается в тестовом окружении (🟡-5)
const vehicleLimiter = process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 60,
        message: {
            error: 'Слишком много запросов к сервису автомобилей. Пожалуйста, повторите попытку через минуту.'
        },
        standardHeaders: true,
        legacyHeaders: false
    });

router.use(vehicleLimiter);

// Добавление нового автомобиля в профиль водителя
router.post('/', authenticateToken, vehicleController.createVehicle);

// Получение списка автомобилей текущего пользователя
router.get('/', authenticateToken, vehicleController.getVehicles);

// Редактирование автомобиля водителя
router.patch('/:id', authenticateToken, vehicleController.updateVehicle);

module.exports = router;
