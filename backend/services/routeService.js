const yandexMaps = require('./yandexMaps');
const { KNOWN_LOCATIONS, DEFAULT_START, DEFAULT_END } = require('../utils/locations');
const rideMapper = require('../utils/rideMapper');
const { ServiceError } = require('../utils/errors');
const { generateRoutePolyline } = require('../utils/geometry');

/**
 * Определение часа пик через сервис yandexMaps
 */
const isPeakHour = yandexMaps.isPeakHour;

/**
 * Определение координат точки по переданному объекту, координатам или названию
 * @param {any} input - Входное значение точки (строка или объект с координатами)
 * @param {{lon: number, lat: number, name?: string}} fallback - Координаты по умолчанию
 * @returns {{lon: number, lat: number, name: string}}
 */
function resolvePointCoordinates(input, fallback) {
    if (!input) {
        return fallback;
    }

    if (typeof input === 'object') {
        const lon = Number(input.lon ?? input.lng ?? input.x ?? input.longitude);
        const lat = Number(input.lat ?? input.y ?? input.latitude);
        if (!isNaN(lon) && !isNaN(lat)) {
            return { lon, lat, name: input.name || 'Точка на карте' };
        }
    }

    if (typeof input === 'string') {
        const lower = input.toLowerCase().trim();
        for (const [key, value] of Object.entries(KNOWN_LOCATIONS)) {
            if (lower.includes(key)) {
                return { ...value, name: input.trim() };
            }
        }
        return { ...fallback, name: input.trim() };
    }

    return fallback;
}

/**
 * Валидация пары координат широты и долготы
 * @param {any} latVal - Широта
 * @param {any} lonVal - Долгота
 * @param {string} pointName - Название точки для сообщения об ошибке
 * @returns {{point: {lat: number, lon: number}|null, error: string|null}}
 */
function validateCoordinates(latVal, lonVal, pointName) {
    const hasLat = latVal !== undefined && latVal !== null && String(latVal).trim() !== '';
    const hasLon = lonVal !== undefined && lonVal !== null && String(lonVal).trim() !== '';

    if (!hasLat && !hasLon) {
        return { point: null, error: null };
    }

    if (!hasLat || !hasLon) {
        return { point: null, error: `Для ${pointName} необходимо передать как широту (lat), так и долготу (lon)` };
    }

    const lat = Number(latVal);
    const lon = Number(lonVal);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return { point: null, error: `Параметры ${pointName} должны содержать корректные географические координаты` };
    }

    return { point: { lat, lon }, error: null };
}

/**
 * Валидация и парсинг радиуса поиска в метрах
 * @param {string|number|undefined} radiusInput - Значение радиуса
 * @returns {{radius: number, error: string|null}}
 */
function parseSearchRadius(radiusInput) {
    if (radiusInput === undefined || radiusInput === null || String(radiusInput).trim() === '') {
        return { radius: 1000, error: null };
    }
    const num = Number(radiusInput);
    if (isNaN(num) || num <= 0) {
        return { radius: 0, error: 'Параметр radius должен быть положительным числом' };
    }
    return { radius: num, error: null };
}

/**
 * Расчет расстояния между двумя точками в километрах через PostGIS
 * @param {import('pg').PoolClient | import('pg').Pool} client - Клиент PostgreSQL
 * @param {number} startLon - Долгота отправления
 * @param {number} startLat - Широта отправления
 * @param {number} endLon - Долгота назначения
 * @param {number} endLat - Широта назначения
 * @returns {Promise<number>} Дистанция в километрах
 */
async function calculateDistanceKm(client, startLon, startLat, endLon, endLat) {
    const query = `
        SELECT ST_DistanceSphere(
            ST_SetSRID(ST_MakePoint($1, $2), 4326),
            ST_SetSRID(ST_MakePoint($3, $4), 4326)
        ) as distance_meters
    `;
    const res = await client.query(query, [startLon, startLat, endLon, endLat]);
    const meters = parseFloat(res.rows[0]?.distance_meters) || 0;
    return Math.round((meters / 1000) * 100) / 100;
}

/**
 * Расчет базовой стоимости поездки через единую функцию yandexMaps
 * @param {number} distanceKm - Дистанция поездки в километрах
 * @returns {number} Рассчитанная цена
 */
function calculateBasePrice(distanceKm) {
    return yandexMaps.calculateTripPrice(distanceKm * 1000, 0).base_price;
}


/**
 * Разрешение координат конечной точки (строка с адресом или готовые координаты)
 * @param {string|object} input - Входная точка
 * @param {object} fallback - Координаты по умолчанию
 * @returns {Promise<{lon: number, lat: number, name: string}>}
 */
async function resolveEndpoint(input, fallback) {
    if (typeof input === 'string') {
        const geocoded = await yandexMaps.geocodeAddress(input);
        return { lon: geocoded.longitude, lat: geocoded.latitude, name: geocoded.full_address };
    }
    return resolvePointCoordinates(input, fallback);
}

/**
 * Проверка совпадения точек отправления и назначения
 * @param {string|object} fromInput - Исходный ввод начала
 * @param {string|object} toInput - Исходный ввод конца
 * @param {{lat: number, lon: number}} startCoords - Координаты начала
 * @param {{lat: number, lon: number}} endCoords - Координаты конца
 * @returns {string|null} Ошибка или null
 */
function validateEndpoints(fromInput, toInput, startCoords, endCoords) {
    if (typeof fromInput === 'string' && typeof toInput === 'string' && fromInput.trim().toLowerCase() === toInput.trim().toLowerCase()) {
        return 'Точки отправления и назначения не могут совпадать (нулевая дистанция)';
    }
    if (startCoords.lat === endCoords.lat && startCoords.lon === endCoords.lon) {
        return 'Точки отправления и назначения не могут совпадать (нулевая дистанция)';
    }
    return null;
}

/**
 * Форматирование ответа для предварительного расчета маршрута
 * @param {object} startCoords - Координаты начала
 * @param {object} endCoords - Координаты окончания
 * @param {object} routeData - Данные маршрута из yandexMaps
 * @param {object} priceInfo - Информация о стоимости
 * @returns {object} Готовый объект ответа
 */
function formatRoutePreviewResponse(startCoords, endCoords, routeData, priceInfo) {
    return {
        from: {
            address: startCoords.name,
            lat: startCoords.lat,
            lon: startCoords.lon
        },
        to: {
            address: endCoords.name,
            lat: endCoords.lat,
            lon: endCoords.lon
        },
        start: startCoords,
        end: endCoords,
        start_coords: { lon: startCoords.lon, lat: startCoords.lat },
        end_coords: { lon: endCoords.lon, lat: endCoords.lat },
        distance_meters: routeData.distance_meters,
        duration_seconds: routeData.duration_seconds,
        distance_km: routeData.distance_km,
        duration_min: routeData.duration_minutes,
        duration_minutes: routeData.duration_minutes,
        price: priceInfo.base_price,
        base_price: priceInfo.base_price,
        is_peak: priceInfo.is_peak,
        route_polyline: routeData.route_polyline,
        polyline: routeData.route_polyline?.coordinates || routeData.route_polyline
    };
}

/**
 * Предварительный расчет маршрута (сервисный метод без HTTP req/res)
 * @param {object} params - Параметры запроса маршрута
 * @param {string|object} params.from - Начальная точка
 * @param {string|object} params.to - Конечная точка
 * @param {any} [params.time] - Время отправления
 * @returns {Promise<object>} Данные маршрута с ценой и полилинией
 */
async function getRoutePreview({ from, to, time } = {}) {
    const fromInput = from;
    const toInput = to;
    const timeInput = time;

    if (!fromInput || !toInput) {
        throw new ServiceError('Параметры "from" и "to" обязательны для построения маршрута', 400);
    }

    const startCoords = await resolveEndpoint(fromInput, DEFAULT_START);
    const endCoords = await resolveEndpoint(toInput, DEFAULT_END);

    const pointError = validateEndpoints(fromInput, toInput, startCoords, endCoords);
    if (pointError) {
        throw new ServiceError(pointError, 400);
    }

    const routeData = await yandexMaps.buildRoute(startCoords, endCoords);
    if (!routeData.distance_meters || routeData.distance_meters <= 0) {
        throw new ServiceError('Точки отправления и назначения не могут совпадать (нулевая дистанция)', 400);
    }

    const departureDate = rideMapper.parseDepartureTime(timeInput);
    const priceInfo = yandexMaps.calculateTripPrice(
        routeData.distance_meters,
        routeData.duration_seconds,
        departureDate
    );
    if (priceInfo.base_price <= 0) {
        throw new ServiceError('Стоимость поездки должна быть больше 0', 400);
    }

    return formatRoutePreviewResponse(startCoords, endCoords, routeData, priceInfo);
}

module.exports = {
    isPeakHour,
    resolvePointCoordinates,
    validateCoordinates,
    parseSearchRadius,
    calculateDistanceKm,
    calculateBasePrice,
    generateRoutePolyline,
    getRoutePreview
};
