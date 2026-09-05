const express = require('express');
const rateLimit = require('express-rate-limit');
const geoController = require('../controllers/geoController');

const router = express.Router();

// Защита квоты Яндекс API: не более 120 гео-запросов в минуту с одного IP
const geoLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    message: { error: 'Слишком много гео-запросов. Пожалуйста, повторите попытку через минуту.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Координаты по названию места (HTTP Геокодер Яндекса)
router.get('/geocode', geoLimiter, geoController.geocode);

// Расстояние и время в пути с учётом пробок (API «Получение деталей маршрута»)
router.get('/route', geoLimiter, geoController.routeDetails);

module.exports = router;
