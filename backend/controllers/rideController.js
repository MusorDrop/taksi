/**
 * @file rideController.js
 * Тонкий транспортный контроллер для обработки HTTP-запросов поездок и бронирований.
 */

const bookingService = require('../services/bookingService');
const rideService = require('../services/rideService');
const routeService = require('../services/routeService');
const {
    isPeakHour,
    calculateDistanceKm,
    calculateBasePrice,
    generateRoutePolyline
} = routeService;

/**
 * Единый обработчик ошибок контроллера поездок
 * @param {import('express').Response} res - Объект ответа Express
 * @param {Error} err - Перехваченная ошибка
 * @param {string} defaultMessage - Сообщение об ошибке по умолчанию при коде 500
 */
function handleControllerError(res, err, defaultMessage) {
    if (err && err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(defaultMessage, err);
    return res.status(500).json({ error: defaultMessage });
}

/**
 * Предварительный просмотр маршрута через Yandex Maps API
 * GET /api/rides/route-preview
 * POST /api/rides/route-preview
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function getRoutePreview(req, res) {
    try {
        const from = req.query.from || req.body?.from || req.query.start || req.body?.start_point;
        const to = req.query.to || req.body?.to || req.query.end || req.body?.end_point;
        const time = req.query.time || req.body?.time || req.query.departure_time || req.body?.departure_time;

        const result = await routeService.getRoutePreview({ from, to, time });
        return res.json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Не удалось построить предпросмотр маршрута');
    }
}

/**
 * Создание новой поездки
 * POST /api/rides
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function createRide(req, res) {
    try {
        const result = await rideService.createRide({
            userId: req.user?.id || null,
            userRole: req.user?.role || null,
            rideData: req.body
        });
        return res.status(201).json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при создании поездки');
    }
}

/**
 * Получение списка поездок с поддержкой гео-фильтрации
 * GET /api/rides
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function getRides(req, res) {
    try {
        const currentUserId = req.user?.id || null;
        const result = await rideService.getRides(req.query, currentUserId);
        return res.json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при получении списка поездок');
    }
}

/**
 * Получение детальной информации о поездке по идентификатору
 * GET /api/rides/:id
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function getRideById(req, res) {
    try {
        const currentUserId = req.user?.id || null;
        const result = await rideService.getRideById(req.params.id, currentUserId);
        return res.json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при получении информации о поездке');
    }
}

/**
 * Получение списка поездок текущего пользователя
 * GET /api/rides/my
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function getMyRides(req, res) {
    try {
        const result = await rideService.getMyRides(req.user?.id || null);
        return res.json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при получении списка поездок');
    }
}

/**
 * Редактирование поездки создателем
 * PATCH /api/rides/:id
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function updateRide(req, res) {
    try {
        const result = await rideService.updateRide({
            rideId: req.params.id,
            driverId: req.user?.id || null,
            updateData: req.body
        });
        return res.json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при обновлении поездки');
    }
}

/**
 * Удаление или отмена поездки водителем
 * DELETE /api/rides/:id
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function deleteRide(req, res) {
    try {
        const result = await rideService.deleteRide({
            rideId: req.params.id,
            driverId: req.user?.id || null
        });
        return res.json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при удалении поездки');
    }
}

/**
 * Старт поездки водителем
 * POST /api/rides/:id/start
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function startRide(req, res) {
    try {
        const result = await rideService.startRide({
            rideId: req.params.id,
            driverId: req.user?.id || null
        });
        return res.status(200).json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при старте поездки');
    }
}

/**
 * Завершение поездки водителем
 * POST /api/rides/:id/finish
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function finishRide(req, res) {
    try {
        const result = await rideService.finishRide({
            rideId: req.params.id,
            driverId: req.user?.id || null
        });
        return res.status(200).json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при завершении поездки');
    }
}

/**
 * Присоединение пассажира к поездке
 * POST /api/rides/:id/join
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function joinRide(req, res) {
    try {
        const result = await bookingService.joinRide({
            rideId: req.params.id,
            passengerId: req.user?.id || null,
            selectedDay: req.body?.selected_day || req.body?.selectedDay || null
        });
        return res.status(201).json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при присоединении к поездке');
    }
}

/**
 * Отмена участия пассажира в поездке
 * POST /api/rides/:id/leave
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function leaveRide(req, res) {
    try {
        const result = await bookingService.leaveRide({
            rideId: req.params.id,
            passengerId: req.user?.id || null
        });
        return res.json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при выходе из поездки');
    }
}

/**
 * Исключение пассажира водителем
 * DELETE /api/rides/:id/passengers/:passengerId
 * @param {import('express').Request} req - Запрос Express
 * @param {import('express').Response} res - Ответ Express
 */
async function kickPassenger(req, res) {
    try {
        const result = await bookingService.kickPassenger({
            rideId: req.params.id,
            passengerId: req.params.passengerId,
            driverId: req.user?.id || null
        });
        return res.json(result);
    } catch (err) {
        return handleControllerError(res, err, 'Внутренняя ошибка сервера при исключении пассажира');
    }
}

module.exports = {
    createRide,
    getRides,
    getMyRides,
    getRideById,
    getRoutePreview,
    deleteRide,
    joinRide,
    leaveRide,
    updateRide,
    kickPassenger,
    startRide,
    finishRide,
    completeRide: finishRide,
    isPeakHour,
    calculateDistanceKm,
    calculateBasePrice,
    generateRoutePolyline
};
