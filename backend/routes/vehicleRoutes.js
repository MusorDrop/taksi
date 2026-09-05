const express = require('express');
const vehicleController = require('../controllers/vehicleController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Добавление нового автомобиля в профиль водителя
router.post('/', authenticateToken, vehicleController.createVehicle);

// Получение списка автомобилей текущего пользователя
router.get('/', authenticateToken, vehicleController.getVehicles);

// Редактирование автомобиля водителя
router.patch('/:id', authenticateToken, vehicleController.updateVehicle);

module.exports = router;
