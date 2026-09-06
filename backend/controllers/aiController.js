const gigachatService = require('../services/gigachatService');
const yandexMaps = require('../services/yandexMaps');

/**
 * Расчет ISO-строки даты и времени отправления по компонентам даты и времени
 * @param {string|null} dateStr - Дата в формате YYYY-MM-DD или словесное обозначение
 * @param {string|null} timeStr - Время в формате HH:mm
 * @returns {string|null} ISO 8601 строка даты и времени отправления
 */
function calculateDepartureTimestamp(dateStr, timeStr) {
    if (!timeStr) {
        return null;
    }

    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
        return null;
    }

    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    if (hours > 23 || minutes > 59) {
        return null;
    }

    const now = new Date();
    let targetDate = new Date();

    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        targetDate = new Date(y, m - 1, d, hours, minutes, 0, 0);
        return targetDate.toISOString();
    }

    // Если дата не задана явно, вычисляем сегодня или завтра относительно текущего времени
    targetDate.setHours(hours, minutes, 0, 0);
    if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
    }

    return targetDate.toISOString();
}

/**
 * Безопасное геокодирование адреса точки с возвратом структуры координат
 * @param {string} address - Строка адреса
 * @returns {Promise<{ lat: number, lon: number, address: string } | null>}
 */
async function geocodeRidePoint(address) {
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
        return null;
    }

    try {
        const geoResult = await yandexMaps.geocodeAddress(address.trim());
        if (!geoResult || geoResult.latitude === undefined || geoResult.longitude === undefined) {
            return null;
        }
        return {
            lat: geoResult.latitude,
            lon: geoResult.longitude,
            address: geoResult.full_address || address.trim()
        };
    } catch (err) {
        console.warn(`Не удалось геокодировать адрес "${address}":`, err.message);
        return null;
    }
}

/**
 * Контроллер распознавания параметров поездки из текста пользователя с помощью GigaChat AI
 * @param {import('express').Request} req - Express Request
 * @param {import('express').Response} res - Express Response
 */
async function parseRide(req, res) {
    const rawText = req.body?.text || req.body?.message;

    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
        return res.status(400).json({
            error: 'Поле text обязательно для заполнения и должно быть непустой строкой'
        });
    }

    const trimmedText = rawText.trim();
    if (trimmedText.length > 1500) {
        return res.status(400).json({
            error: 'Длина текста не должна превышать 1500 символов'
        });
    }

    try {
        const extracted = await gigachatService.parseRideRequest(trimmedText);

        // Параллельное геокодирование начального и конечного пунктов маршрута
        const [startPoint, endPoint] = await Promise.all([
            geocodeRidePoint(extracted.from),
            geocodeRidePoint(extracted.to)
        ]);

        const departureTime = calculateDepartureTimestamp(extracted.date, extracted.time);

        const structuredRide = {
            role: extracted.role,
            from: extracted.from,
            to: extracted.to,
            date: extracted.date,
            time: extracted.time,
            departure_time: departureTime,
            price: extracted.price,
            seats: extracted.seats,
            comment: extracted.comment,
            tags: extracted.tags,
            start_point: startPoint,
            end_point: endPoint
        };

        return res.json({
            success: true,
            ...structuredRide,
            parsed: structuredRide
        });
    } catch (err) {
        console.error('Ошибка в контроллере parseRide:', err);
        return res.status(500).json({
            error: 'Ошибка при обработке запроса сервисом GigaChat AI',
            details: err.message
        });
    }
}

module.exports = {
    parseRide,
    calculateDepartureTimestamp,
    geocodeRidePoint
};