const { YandexApiError, geocodeText, getRouteDetails } = require('../services/yandexMaps');

/**
 * GET /api/geo/geocode?text=... — координаты по названию места (HTTP Геокодер Яндекса).
 * Ответ: { found, point: {lat, lon} | null, name | null }
 */
async function geocode(req, res) {
    const text = typeof req.query.text === 'string' ? req.query.text.trim() : '';
    if (!text) {
        return res.status(400).json({ error: 'Укажите параметр text с названием места' });
    }
    if (text.length > 200) {
        return res.status(400).json({ error: 'Название места слишком длинное (максимум 200 символов)' });
    }

    try {
        const point = await geocodeText(text);
        return res.json({
            found: point !== null,
            point: point ? { lat: point.lat, lon: point.lon } : null,
            name: point ? point.name : null,
            source: point ? point.source : null,
        });
    } catch (err) {
        if (err instanceof YandexApiError) {
            console.error('Ошибка геокодера Яндекса:', err.message);
            return res.status(err.statusCode).json({ error: err.message });
        }
        console.error('Непредвиденная ошибка геокодирования:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при геокодировании' });
    }
}

/**
 * GET /api/geo/route?from_lat=&from_lon=&to_lat=&to_lon= — детали автомобильного
 * маршрута (API «Получение деталей маршрута» Яндекса, с учётом пробок).
 * Ответ: { source, distance_km, duration_min }
 */
async function routeDetails(req, res) {
    const fromLat = Number(req.query.from_lat);
    const fromLon = Number(req.query.from_lon);
    const toLat = Number(req.query.to_lat);
    const toLon = Number(req.query.to_lon);

    if (![fromLat, fromLon, toLat, toLon].every(Number.isFinite)) {
        return res
            .status(400)
            .json({ error: 'Нужны числовые параметры from_lat, from_lon, to_lat, to_lon' });
    }
    if (![fromLat, toLat].every((lat) => lat >= -90 && lat <= 90)) {
        return res.status(400).json({ error: 'Широта (lat) должна быть в диапазоне от -90 до 90' });
    }
    if (![fromLon, toLon].every((lon) => lon >= -180 && lon <= 180)) {
        return res.status(400).json({ error: 'Долгота (lon) должна быть в диапазоне от -180 до 180' });
    }

    try {
        const route = await getRouteDetails({ fromLat, fromLon, toLat, toLon });
        if (!route) {
            return res
                .status(404)
                .json({ error: 'Не удалось построить маршрут между указанными точками' });
        }
        return res.json({
            source: route.source || 'unknown',
            distance_km: route.distanceKm,
            duration_min: route.durationMin,
        });
    } catch (err) {
        if (err instanceof YandexApiError) {
            console.error('Ошибка Router API Яндекса:', err.message);
            return res.status(err.statusCode).json({ error: err.message });
        }
        console.error('Непредвиденная ошибка маршрутизации:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при расчёте маршрута' });
    }
}

module.exports = { geocode, routeDetails };
