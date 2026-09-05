const express = require('express');
const reviewController = require('../controllers/reviewController');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Создание отзыва о водителе или пассажире после поездки
router.post('/', authenticateToken, reviewController.createReview);

// Получение списка отзывов с возможностью фильтрации
router.get('/', optionalAuth, reviewController.getReviews);

module.exports = router;
