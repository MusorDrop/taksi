const express = require('express');
const rideController = require('../controllers/rideController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Получение списка поездок
router.get('/', rideController.getRides);

// Создание новой поездки водителем
router.post('/', authenticateToken, rideController.createRide);

// Присоединение пассажира к поездке (создание match)
router.post('/:id/join', authenticateToken, rideController.joinRide);

// Отмена участия пассажира в поездке
router.post('/:id/leave', authenticateToken, rideController.leaveRide);

// Редактирование поездки создателем
router.patch('/:id', authenticateToken, rideController.updateRide);

// Исключение пассажира водителем
router.delete('/:id/passengers/:passengerId', authenticateToken, rideController.kickPassenger);

module.exports = router;
