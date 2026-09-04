const express = require('express');
const rideController = require('../controllers/rideController');
const { optionalAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Получение списка поездок
router.get('/', rideController.getRides);

// Создание новой поездки водителем
router.post('/', optionalAuth, rideController.createRide);

// Присоединение пассажира к поездке (создание match)
router.post('/:id/join', optionalAuth, rideController.joinRide);

// Отмена участия пассажира в поездке
router.post('/:id/leave', optionalAuth, rideController.leaveRide);

module.exports = router;
