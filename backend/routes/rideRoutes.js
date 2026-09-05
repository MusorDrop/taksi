const express = require('express');
const rateLimit = require('express-rate-limit');
const rideController = require('../controllers/rideController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Ограничение частоты запросов для поездок (максимум 100 запросов за 1 минуту)
// Отключается в тестовом окружении (🟡-5)
const rideLimiter = process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 100,
        message: {
            error: 'Слишком много запросов к сервису поездок. Пожалуйста, повторите попытку через минуту.'
        },
        standardHeaders: true,
        legacyHeaders: false
    });

router.use(rideLimiter);

// Получение списка поездок
router.get('/', rideController.getRides);

// Получение информации о конкретной поездке по ID (🔵-9)
router.get('/:id', rideController.getRideById);

// Создание новой поездки водителем
router.post('/', authenticateToken, rideController.createRide);

// Присоединение пассажира к поездке (создание match)
router.post('/:id/join', authenticateToken, rideController.joinRide);

// Отмена участия пассажира в поездке
router.post('/:id/leave', authenticateToken, rideController.leaveRide);

// Редактирование поездки создателем
router.patch('/:id', authenticateToken, rideController.updateRide);

// Удаление / отмена поездки водителем (🟡-8)
router.delete('/:id', authenticateToken, rideController.deleteRide);

// Исключение пассажира водителем
router.delete('/:id/passengers/:passengerId', authenticateToken, rideController.kickPassenger);

module.exports = router;
