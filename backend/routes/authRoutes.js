const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Авторизация или автоматическая регистрация пользователя
router.post('/login', authController.login);

// Получение профиля текущего пользователя
router.get('/me', authenticateToken, authController.getProfile);

module.exports = router;
