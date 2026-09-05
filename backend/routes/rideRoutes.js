const express = require('express');
const rideController = require('../controllers/rideController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Получение списка поездок
router.get('/', rideController.getRides);

// Поездки текущего пользователя (как водителя и как пассажира)
router.get('/mine', authenticateToken, rideController.getMyRides);

// Создание новой поездки водителем
router.post('/', authenticateToken, rideController.createRide);

// Присоединение пассажира к поездке (создание match)
router.post('/:id/join', authenticateToken, rideController.joinRide);

// Отмена участия пассажира в поездке
router.post('/:id/leave', authenticateToken, rideController.leaveRide);

module.exports = router;
