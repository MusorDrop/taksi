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

module.exports = router;
