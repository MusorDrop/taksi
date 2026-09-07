/**
 * @file rideService.js
 * Сервис управления поездками: создание, поиск, детали, редактирование, удаление и жизненный цикл.
 */

const pool = require('../db');
const yandexMaps = require('./yandexMaps');
const { DEFAULT_START, DEFAULT_END } = require('../utils/locations');
const { isValidUuid } = require('../utils/validation');
const { getPassengersForRide } = require('../utils/rideUtils');
const { BASE_RIDE_SELECT, parseDepartureTime, mapRideRow } = require('../utils/rideMapper');
const {
    resolvePointCoordinates,
    validateCoordinates,
    parseSearchRadius,
    calculateDistanceKm
} = require('./routeService');
const { ServiceError } = require('../utils/errors');

/**
 * Проверка прав пользователя на создание поездки
 * @param {string|null} userId - ID пользователя
 * @param {string|null} userRole - Роль пользователя
 */
function validateUserRole(userId, userRole) {
    if (!userId) {
        throw new ServiceError('Пользователь не авторизован', 401);
    }
    if (userRole === 'passenger') {
        throw new ServiceError('Пользователи с ролью "passenger" не могут создавать поездки', 403);
    }
}

/**
 * Геокодирование или разрешение точки маршрута
 * @param {any} raw - Входные данные точки
 * @param {object} fallback - Координаты по умолчанию
 * @returns {Promise<{lon: number, lat: number, name: string}>}
 */
async function resolveEndpoint(raw, fallback) {
    if (typeof raw === 'string') {
        const geocoded = await yandexMaps.geocodeAddress(raw);
        return { lon: geocoded.longitude, lat: geocoded.latitude, name: geocoded.full_address };
    }
    return resolvePointCoordinates(raw, fallback);
}

/**
 * Валидация нулевой дистанции между начальной и конечной точками
 * @param {any} rawStart - Исходные данные старта
 * @param {any} rawEnd - Исходные данные финиша
 * @param {object} startCoords - Координаты старта
 * @param {object} endCoords - Координаты финиша
 */
function validateNonZeroDistance(rawStart, rawEnd, startCoords, endCoords) {
    if (typeof rawStart === 'string' && typeof rawEnd === 'string' && rawStart.trim().toLowerCase() === rawEnd.trim().toLowerCase()) {
        throw new ServiceError('Точки отправления и назначения не могут совпадать (нулевая дистанция)', 400);
    }
    if (startCoords.lat === endCoords.lat && startCoords.lon === endCoords.lon) {
        throw new ServiceError('Точки отправления и назначения не могут совпадать (нулевая дистанция)', 400);
    }
}

/**
 * Валидация времени отправления (не в прошлом)
 * @param {any} timeInput - Входное время
 * @returns {Date} Объект даты
 */
function validateDepartureTime(timeInput) {
    const departureTime = parseDepartureTime(timeInput);
    if (departureTime.getTime() < Date.now() - 60000) {
        throw new ServiceError('Время отправления не может быть в прошлом', 400);
    }
    return departureTime;
}

/**
 * Валидация и расчет мест в поездке
 * @param {any} totalInput - Общее число мест
 * @param {any} availableInput - Доступные места
 * @returns {{totalSeats: number, availableSeats: number}}
 */
function validateSeatsCount(totalInput, availableInput) {
    const totalSeats = Math.min(8, Math.max(1, parseInt(totalInput || 4, 10)));
    const fallbackAvailable = availableInput !== undefined ? availableInput : totalSeats;
    const availableSeats = Math.min(totalSeats, Math.max(0, parseInt(fallbackAvailable, 10)));
    return { totalSeats, availableSeats };
}

/**
 * Проверка существования водителя и принадлежности автомобиля
 * @param {import('pg').PoolClient} client - Клиент БД
 * @param {string} driverId - ID водителя
 * @param {string|null} vehicleId - ID автомобиля
 * @returns {Promise<object>} Данные водителя
 */
async function verifyDriverAndVehicle(client, driverId, vehicleId) {
    const driverCheck = await client.query(
        'SELECT id, username, first_name, last_name, phone, rating, avatar_url FROM users WHERE id = $1',
        [driverId]
    );
    if (driverCheck.rows.length === 0) {
        throw new ServiceError('Водитель с указанным ID не найден в базе данных', 404);
    }

    if (vehicleId) {
        const vehicleCheck = await client.query(
            'SELECT id FROM vehicles WHERE id = $1 AND driver_id = $2',
            [vehicleId, driverId]
        );
        if (vehicleCheck.rows.length === 0) {
            throw new ServiceError('Указанный автомобиль не найден или не принадлежит водителю', 404);
        }
    }

    return driverCheck.rows[0];
}

/**
 * Определение стоимости поездки
 * @param {object} routeData - Данные построенного маршрута
 * @param {Date} departureTime - Время отправления
 * @param {any} customPrice - Пользовательская цена
 * @returns {number} Итоговая базовая стоимость
 */
function determineRidePrice(routeData, departureTime, customPrice) {
    if (!routeData.distance_meters || routeData.distance_meters <= 0) {
        throw new ServiceError('Точки отправления и назначения не могут совпадать (нулевая дистанция)', 400);
    }

    const calculated = yandexMaps.calculateTripPrice(routeData.distance_meters, routeData.duration_seconds, departureTime);
    const hasCustom = customPrice !== undefined && customPrice !== null && String(customPrice).trim() !== '';

    if (hasCustom) {
        const parsed = parseFloat(customPrice);
        if (isNaN(parsed) || parsed <= 0) {
            throw new ServiceError('Стоимость поездки должна быть больше 0', 400);
        }
        return Math.round(parsed * 100) / 100;
    }

    const basePrice = calculated.base_price;
    if (!basePrice || basePrice <= 0) {
        throw new ServiceError('Стоимость поездки должна быть больше 0', 400);
    }
    return basePrice;
}

/**
 * Форматирование тегов поездки
 * @param {any} tagsInput - Входные теги
 * @returns {string[]} Массив тегов
 */
function parseRideTags(tagsInput) {
    if (Array.isArray(tagsInput)) {
        return tagsInput.map((t) => String(t).trim()).filter(Boolean);
    }
    if (typeof tagsInput === 'string' && tagsInput.trim().length > 0) {
        return tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    }
    return [];
}

/**
 * Создание новой поездки
 * @param {object} params - Параметры создания
 * @param {string|null} params.userId - ID водителя
 * @param {string|null} params.userRole - Роль водителя
 * @param {object} params.rideData - Данные поездки
 * @returns {Promise<object>} Созданная поездка
 */
async function createRide({ userId, userRole, rideData }) {
    validateUserRole(userId, userRole);

    const rawStart = rideData.start_point || rideData.from || (
        rideData.start_lat !== undefined && rideData.start_lon !== undefined
            ? { lat: rideData.start_lat, lon: rideData.start_lon }
            : null
    );
    const rawEnd = rideData.end_point || rideData.to || (
        rideData.end_lat !== undefined && rideData.end_lon !== undefined
            ? { lat: rideData.end_lat, lon: rideData.end_lon }
            : null
    );

    const startCoords = await resolveEndpoint(rawStart, DEFAULT_START);
    const endCoords = await resolveEndpoint(rawEnd, DEFAULT_END);
    validateNonZeroDistance(rawStart, rawEnd, startCoords, endCoords);

    const vehicleId = rideData.vehicle_id || null;
    if (vehicleId && !isValidUuid(vehicleId)) {
        throw new ServiceError('Некорректный формат vehicle_id', 400);
    }

    const departureTime = validateDepartureTime(rideData.departure_time || rideData.time);
    const { totalSeats, availableSeats } = validateSeatsCount(rideData.total_seats, rideData.available_seats);

    // Внешнее построение маршрута и расчет цены выполняются ДО захвата соединения из пула
    const routeData = await yandexMaps.buildRoute(startCoords, endCoords);
    const customPrice = rideData.base_price !== undefined ? rideData.base_price : rideData.price;
    const basePrice = determineRidePrice(routeData, departureTime, customPrice);

    const rideType = rideData.ride_type === 'regular' ? 'regular' : 'one_off';
    const regularDays = rideType === 'regular'
        ? (Array.isArray(rideData.regular_days) ? rideData.regular_days.join(',') : (typeof rideData.regular_days === 'string' ? rideData.regular_days.trim() : null))
        : null;

    const description = typeof rideData.description === 'string' && rideData.description.trim().length > 0
        ? rideData.description.trim()
        : null;
    const tags = parseRideTags(rideData.tags);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const driverInfo = await verifyDriverAndVehicle(client, userId, vehicleId);

        const insertQuery = `
            INSERT INTO rides (
                driver_id, vehicle_id, departure_time,
                start_point, end_point, base_price,
                total_seats, available_seats, status,
                ride_type, regular_days, distance_meters,
                duration_seconds, route_polyline, description,
                tags, start_address, end_address
            ) VALUES (
                $1, $2, $3,
                ST_SetSRID(ST_MakePoint($4, $5), 4326),
                ST_SetSRID(ST_MakePoint($6, $7), 4326),
                $8, $9, $10, 'planned',
                $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
            RETURNING 
                id, driver_id, vehicle_id, parent_ride_id, departure_time,
                start_address, end_address,
                ST_X(start_point) as start_lon, ST_Y(start_point) as start_lat,
                ST_X(end_point) as end_lon, ST_Y(end_point) as end_lat,
                ROUND((ST_DistanceSphere(start_point, end_point) / 1000.0)::numeric, 2) as distance_km,
                base_price, total_seats, available_seats, status,
                ride_type, regular_days, distance_meters, duration_seconds,
                route_polyline, description, tags, created_at
        `;

        const result = await client.query(insertQuery, [
            userId, vehicleId, departureTime,
            startCoords.lon, startCoords.lat,
            endCoords.lon, endCoords.lat,
            basePrice, totalSeats, availableSeats,
            rideType, regularDays,
            routeData.distance_meters, routeData.duration_seconds,
            JSON.stringify(routeData.route_polyline),
            description, tags,
            startCoords.name, endCoords.name
        ]);

        await client.query('COMMIT');

        const combinedRow = {
            ...result.rows[0],
            driver_username: driverInfo.username,
            driver_first_name: driverInfo.first_name,
            driver_last_name: driverInfo.last_name,
            driver_phone: driverInfo.phone,
            driver_rating: driverInfo.rating,
            driver_avatar_url: driverInfo.avatar_url || null,
            passenger_ids: [],
            passengers: []
        };

        const mappedRide = mapRideRow(combinedRow, userId);
        return {
            message: 'Поездка успешно создана',
            ride: mappedRide,
            current_price: mappedRide.current_price
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Получение списка поездок с поддержкой гео-фильтрации
 * @param {object} query - Параметры запроса
 * @param {string|null} [currentUserId=null] - ID авторизованного пользователя для проверки прав доступа к приватным данным
 * @returns {Promise<object>} Список поездок и метаданные
 */
async function getRides(query = {}, currentUserId = null) {
    const { start_lat, start_lon, end_lat, end_lon, radius, departure_time, time, status } = query;

    const radiusResult = parseSearchRadius(radius);
    if (radiusResult.error) {
        throw new ServiceError(radiusResult.error, 400);
    }
    const searchRadius = radiusResult.radius;

    const startCheck = validateCoordinates(start_lat, start_lon, 'точки посадки (start)');
    if (startCheck.error) {
        throw new ServiceError(startCheck.error, 400);
    }

    const endCheck = validateCoordinates(end_lat, end_lon, 'точки высадки (end)');
    if (endCheck.error) {
        throw new ServiceError(endCheck.error, 400);
    }

    const conditions = [];
    const params = [];

    if (status) {
        if (status !== 'all') {
            params.push(status);
            conditions.push(`r.status = $${params.length}`);
        }
    } else {
        conditions.push("r.status IN ('planned', 'scheduled', 'active')");
    }

    if (departure_time || time) {
        const parsedTime = parseDepartureTime(departure_time || time);
        params.push(parsedTime);
        conditions.push(`r.departure_time >= $${params.length}`);
    } else {
        conditions.push("(r.departure_time > NOW() OR r.status = 'active')");
    }

    if (startCheck.point) {
        params.push(startCheck.point.lon, startCheck.point.lat, searchRadius);
        const lonIdx = params.length - 2;
        const latIdx = params.length - 1;
        const radIdx = params.length;
        conditions.push(`ST_DWithin(r.start_point::geography, ST_SetSRID(ST_MakePoint($${lonIdx}, $${latIdx}), 4326)::geography, $${radIdx})`);
    }

    if (endCheck.point) {
        params.push(endCheck.point.lon, endCheck.point.lat, searchRadius);
        const lonIdx = params.length - 2;
        const latIdx = params.length - 1;
        const radIdx = params.length;
        conditions.push(`ST_DWithin(r.end_point::geography, ST_SetSRID(ST_MakePoint($${lonIdx}, $${latIdx}), 4326)::geography, $${radIdx})`);
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const whereClause = conditions.join(' AND ');
    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const selectQuery = `
        ${BASE_RIDE_SELECT}
        WHERE ${whereClause}
        ORDER BY r.departure_time ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await pool.query(selectQuery, params);
    const totalCount = result.rows.length > 0 ? Number(result.rows[0].full_count) : 0;
    const rides = result.rows.map((row) => mapRideRow(row, currentUserId));

    return { count: rides.length, total_count: totalCount, page, limit, rides };
}

/**
 * Получение детальной информации о поездке по ID
 * @param {string} rideId - ID поездки
 * @param {string|null} [currentUserId=null] - ID авторизованного пользователя
 * @returns {Promise<object>} Данные поездки
 */
async function getRideById(rideId, currentUserId = null) {
    if (!isValidUuid(rideId)) {
        throw new ServiceError('Некорректный формат идентификатора поездки (UUID)', 400);
    }

    const query = `${BASE_RIDE_SELECT} WHERE r.id = $1`;
    const result = await pool.query(query, [rideId]);
    if (result.rows.length === 0) {
        throw new ServiceError('Поездка не найдена', 404);
    }

    return { ride: mapRideRow(result.rows[0], currentUserId) };
}

/**
 * Получение списка поездок текущего пользователя
 * @param {string|null} userId - ID пользователя
 * @returns {Promise<object>} Список поездок
 */
async function getMyRides(userId) {
    if (!userId) {
        throw new ServiceError('Пользователь не авторизован', 401);
    }

    const selectQuery = `
        ${BASE_RIDE_SELECT.replace(
            'FROM rides r',
            ', EXISTS (SELECT 1 FROM reviews rv WHERE rv.ride_id = r.id AND rv.reviewer_id = $1) AS has_reviewed\n    FROM rides r'
        )}
        WHERE r.driver_id = $1 OR EXISTS (
            SELECT 1 FROM matches m2 WHERE m2.ride_id = r.id AND m2.passenger_id = $1 AND m2.status IN ('accepted', 'completed')
        )
        ORDER BY r.departure_time DESC
    `;

    const result = await pool.query(selectQuery, [userId]);
    const rides = result.rows.map((row) => mapRideRow(row, userId));
    return { count: rides.length, rides };
}

/**
 * Получение блокирующей записи поездки для редактирования с валидацией прав
 * @param {import('pg').PoolClient} client - Клиент БД
 * @param {string} rideId - ID поездки
 * @param {string} driverId - ID водителя
 * @returns {Promise<{currentRide: object, driverInfo: object, currentPassengersCount: number}>}
 */
async function getRideForUpdate(client, rideId, driverId) {
    const checkQuery = `
        SELECT r.*,
               ST_X(r.start_point) as start_lon, ST_Y(r.start_point) as start_lat,
               ST_X(r.end_point) as end_lon, ST_Y(r.end_point) as end_lat
        FROM rides r
        WHERE r.id = $1 FOR UPDATE
    `;
    const checkRes = await client.query(checkQuery, [rideId]);
    if (checkRes.rows.length === 0) {
        throw new ServiceError('Поездка не найдена', 404);
    }

    const currentRide = checkRes.rows[0];
    if (currentRide.driver_id !== driverId) {
        throw new ServiceError('Редактировать поездку может только её создатель', 403);
    }
    if (currentRide.status !== 'planned' && currentRide.status !== 'scheduled') {
        throw new ServiceError('Можно редактировать только запланированные поездки', 400);
    }

    const driverRes = await client.query(
        'SELECT username, first_name, last_name, phone, rating, avatar_url FROM users WHERE id = $1',
        [driverId]
    );

    const passengersCountRes = await client.query(
        "SELECT COUNT(*)::int as count FROM matches WHERE ride_id = $1 AND status = 'accepted'",
        [rideId]
    );

    return {
        currentRide,
        driverInfo: driverRes.rows[0] || {},
        currentPassengersCount: passengersCountRes.rows[0]?.count || 0
    };
}

/**
 * Разрешение обновленных координат точек поездки
 * @param {object} updateData - Входные данные обновления
 * @param {object} currentRide - Текущая запись поездки
 * @returns {Promise<{startLon: number, startLat: number, endLon: number, endLat: number, startAddress: string|null, endAddress: string|null, coordsChanged: boolean}>}
 */
async function resolveUpdatedCoordinates(updateData, currentRide) {
    let startLon = currentRide.start_lon;
    let startLat = currentRide.start_lat;
    let endLon = currentRide.end_lon;
    let endLat = currentRide.end_lat;
    let startAddress = currentRide.start_address;
    let endAddress = currentRide.end_address;
    let coordsChanged = false;

    const rawStart = updateData.start_point || updateData.from || (
        updateData.start_lat !== undefined && updateData.start_lon !== undefined
            ? { lat: updateData.start_lat, lon: updateData.start_lon }
            : null
    );
    if (rawStart) {
        const resolvedStart = await resolveEndpoint(rawStart, { lon: startLon, lat: startLat });
        startLon = resolvedStart.lon;
        startLat = resolvedStart.lat;
        startAddress = resolvedStart.name || (typeof rawStart === 'string' ? rawStart : null);
        coordsChanged = true;
    }

    const rawEnd = updateData.end_point || updateData.to || (
        updateData.end_lat !== undefined && updateData.end_lon !== undefined
            ? { lat: updateData.end_lat, lon: updateData.end_lon }
            : null
    );
    if (rawEnd) {
        const resolvedEnd = await resolveEndpoint(rawEnd, { lon: endLon, lat: endLat });
        endLon = resolvedEnd.lon;
        endLat = resolvedEnd.lat;
        endAddress = resolvedEnd.name || (typeof rawEnd === 'string' ? rawEnd : null);
        coordsChanged = true;
    }

    if (updateData.start_address !== undefined) startAddress = updateData.start_address;
    if (updateData.end_address !== undefined) endAddress = updateData.end_address;

    if (coordsChanged && startLon === endLon && startLat === endLat) {
        throw new ServiceError('Точки отправления и назначения не могут совпадать (нулевая дистанция)', 400);
    }

    return { startLon, startLat, endLon, endLat, startAddress, endAddress, coordsChanged };
}

/**
 * Валидация обновленного автомобиля для поездки
 * @param {import('pg').PoolClient} client - Клиент БД
 * @param {object} updateData - Входные данные
 * @param {object} currentRide - Текущая поездка
 * @param {string} driverId - ID водителя
 * @returns {Promise<string|null>} ID автомобиля
 */
async function resolveUpdatedVehicleId(client, updateData, currentRide, driverId) {
    if (updateData.vehicle_id === undefined) {
        return currentRide.vehicle_id;
    }
    if (updateData.vehicle_id === null || updateData.vehicle_id === '') {
        return null;
    }
    if (!isValidUuid(updateData.vehicle_id)) {
        throw new ServiceError('Некорректный формат vehicle_id', 400);
    }
    const vCheck = await client.query('SELECT id FROM vehicles WHERE id = $1 AND driver_id = $2', [updateData.vehicle_id, driverId]);
    if (vCheck.rows.length === 0) {
        throw new ServiceError('Указанный автомобиль не найден или не принадлежит водителю', 404);
    }
    return updateData.vehicle_id;
}

/**
 * Расчет мест при редактировании поездки
 * @param {object} updateData - Входные данные
 * @param {object} currentRide - Текущая поездка
 * @param {number} currentPassengersCount - Количество записавшихся пассажиров
 * @returns {{totalSeats: number, availableSeats: number}}
 */
function resolveUpdatedSeats(updateData, currentRide, currentPassengersCount) {
    let totalSeats = currentRide.total_seats;
    if (updateData.total_seats !== undefined) {
        const parsedSeats = parseInt(updateData.total_seats, 10);
        if (isNaN(parsedSeats) || parsedSeats < 1 || parsedSeats > 8) {
            throw new ServiceError('Количество мест должно быть от 1 до 8', 400);
        }
        if (parsedSeats < currentPassengersCount) {
            throw new ServiceError(`Количество мест (${parsedSeats}) не может быть меньше числа уже записавшихся пассажиров (${currentPassengersCount})`, 400);
        }
        totalSeats = parsedSeats;
    }
    const availableSeats = totalSeats - currentPassengersCount;
    return { totalSeats, availableSeats };
}

/**
 * Расчет цены при редактировании поездки
 * @param {import('pg').PoolClient} client - Клиент БД
 * @param {object} updateData - Входные данные
 * @param {object} currentRide - Текущая поездка
 * @param {boolean} coordsChanged - Флаг изменения координат
 * @param {object} coords - Координаты точек
 * @param {Date} departureTime - Время отправления
 * @returns {Promise<number>} Итоговая стоимость
 */
async function resolveUpdatedPrice(client, updateData, currentRide, coordsChanged, coords, departureTime) {
    const hasCustomPrice = (updateData.base_price !== undefined && updateData.base_price !== null && String(updateData.base_price).trim() !== '') ||
                           (updateData.price !== undefined && updateData.price !== null && String(updateData.price).trim() !== '');

    let basePrice = currentRide.base_price;
    if (hasCustomPrice) {
        const rawVal = updateData.base_price !== undefined ? updateData.base_price : updateData.price;
        const parsedVal = parseFloat(rawVal);
        if (isNaN(parsedVal) || parsedVal <= 0) {
            throw new ServiceError('Стоимость поездки должна быть больше 0', 400);
        }
        basePrice = Math.round(parsedVal * 100) / 100;
    } else if (coordsChanged) {
        const distanceKm = await calculateDistanceKm(client, coords.startLon, coords.startLat, coords.endLon, coords.endLat);
        const trip = yandexMaps.calculateTripPrice(distanceKm * 1000, 0, departureTime);
        basePrice = trip.base_price;
    }

    if (basePrice <= 0) {
        throw new ServiceError('Стоимость поездки должна быть больше 0', 400);
    }
    return basePrice;
}

/**
 * Редактирование поездки создателем
 * @param {object} params - Параметры обновления
 * @param {string} params.rideId - ID поездки
 * @param {string|null} params.driverId - ID водителя
 * @param {object} params.updateData - Поля обновления
 * @returns {Promise<object>} Обновленная поездка
 */
async function updateRide({ rideId, driverId, updateData }) {
    if (!isValidUuid(rideId)) {
        throw new ServiceError('Некорректный формат идентификатора поездки (UUID)', 400);
    }
    if (!driverId) {
        throw new ServiceError('Пользователь не авторизован', 401);
    }

    // 1. Предварительная проверка существования поездки и прав создателя без блокировки
    const preCheck = await pool.query(`
        SELECT r.*,
               ST_X(r.start_point) as start_lon, ST_Y(r.start_point) as start_lat,
               ST_X(r.end_point) as end_lon, ST_Y(r.end_point) as end_lat
        FROM rides r
        WHERE r.id = $1
    `, [rideId]);

    if (preCheck.rows.length === 0) {
        throw new ServiceError('Поездка не найдена', 404);
    }

    const currentRide = preCheck.rows[0];
    if (currentRide.driver_id !== driverId) {
        throw new ServiceError('Редактировать поездку может только её создатель', 403);
    }
    if (currentRide.status !== 'planned' && currentRide.status !== 'scheduled') {
        throw new ServiceError('Можно редактировать только запланированные поездки', 400);
    }

    // 2. Внешнее геокодирование адресов до открытия транзакции БД
    const coords = await resolveUpdatedCoordinates(updateData, currentRide);

    let departureTime = currentRide.departure_time;
    if (updateData.departure_time || updateData.time) {
        departureTime = parseDepartureTime(updateData.departure_time || updateData.time);
    }

    // 3. Внешний расчет маршрута через Yandex Maps до захвата соединения из пула
    let routeData = null;
    if (coords.coordsChanged) {
        routeData = await yandexMaps.buildRoute(
            { lon: coords.startLon, lat: coords.startLat },
            { lon: coords.endLon, lat: coords.endLat }
        );
    }

    const hasCustomPrice = (updateData.base_price !== undefined && updateData.base_price !== null && String(updateData.base_price).trim() !== '') ||
                           (updateData.price !== undefined && updateData.price !== null && String(updateData.price).trim() !== '');

    let basePrice = currentRide.base_price;
    if (hasCustomPrice) {
        const rawVal = updateData.base_price !== undefined ? updateData.base_price : updateData.price;
        const parsedVal = parseFloat(rawVal);
        if (isNaN(parsedVal) || parsedVal <= 0) {
            throw new ServiceError('Стоимость поездки должна быть больше 0', 400);
        }
        basePrice = Math.round(parsedVal * 100) / 100;
    } else if (coords.coordsChanged && routeData) {
        const trip = yandexMaps.calculateTripPrice(routeData.distance_meters, routeData.duration_seconds, departureTime);
        basePrice = trip.base_price;
    }

    if (basePrice <= 0) {
        throw new ServiceError('Стоимость поездки должна быть больше 0', 400);
    }

    let rideType = currentRide.ride_type || 'one_off';
    if (updateData.ride_type !== undefined) {
        rideType = updateData.ride_type === 'regular' ? 'regular' : 'one_off';
    }

    let regularDays = currentRide.regular_days;
    if (updateData.regular_days !== undefined) {
        regularDays = rideType === 'regular'
            ? (Array.isArray(updateData.regular_days) ? updateData.regular_days.join(',') : (typeof updateData.regular_days === 'string' ? updateData.regular_days.trim() : null))
            : null;
    }

    let description = currentRide.description;
    if (updateData.description !== undefined) {
        description = typeof updateData.description === 'string' && updateData.description.trim().length > 0
            ? updateData.description.trim()
            : null;
    }

    let tags = currentRide.tags;
    if (updateData.tags !== undefined) {
        tags = parseRideTags(updateData.tags);
    }

    const distanceMeters = routeData ? routeData.distance_meters : currentRide.distance_meters;
    const durationSeconds = routeData ? routeData.duration_seconds : currentRide.duration_seconds;
    const routePolyline = routeData ? JSON.stringify(routeData.route_polyline) : (currentRide.route_polyline ? JSON.stringify(currentRide.route_polyline) : null);

    // 4. Открытие короткой транзакции только для проверки блокировки, автомобиля и записи изменений
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { driverInfo, currentPassengersCount } = await getRideForUpdate(client, rideId, driverId);
        const vehicleId = await resolveUpdatedVehicleId(client, updateData, currentRide, driverId);
        const { totalSeats, availableSeats } = resolveUpdatedSeats(updateData, currentRide, currentPassengersCount);

        const updateQuery = `
            UPDATE rides
            SET
                departure_time = $1,
                start_point = ST_SetSRID(ST_MakePoint($2, $3), 4326),
                end_point = ST_SetSRID(ST_MakePoint($4, $5), 4326),
                base_price = $6,
                total_seats = $7,
                available_seats = $8,
                vehicle_id = $9,
                ride_type = $10,
                regular_days = $11,
                description = $12,
                tags = $13,
                start_address = $14,
                end_address = $15,
                distance_meters = $16,
                duration_seconds = $17,
                route_polyline = $18
            WHERE id = $19
            RETURNING 
                id, driver_id, vehicle_id, parent_ride_id, departure_time,
                start_address, end_address,
                ST_X(start_point) as start_lon, ST_Y(start_point) as start_lat,
                ST_X(end_point) as end_lon, ST_Y(end_point) as end_lat,
                ROUND((ST_DistanceSphere(start_point, end_point) / 1000.0)::numeric, 2) as distance_km,
                base_price, total_seats, available_seats, status,
                ride_type, regular_days, distance_meters, duration_seconds,
                route_polyline, description, tags, created_at
        `;

        const updateRes = await client.query(updateQuery, [
            departureTime,
            coords.startLon, coords.startLat,
            coords.endLon, coords.endLat,
            basePrice, totalSeats, availableSeats,
            vehicleId, rideType, regularDays,
            description, tags,
            coords.startAddress, coords.endAddress,
            distanceMeters, durationSeconds, routePolyline,
            rideId
        ]);

        const { passenger_ids, passengers } = await getPassengersForRide(client, rideId);
        await client.query('COMMIT');

        const combinedRow = {
            ...updateRes.rows[0],
            driver_username: driverInfo.username,
            driver_first_name: driverInfo.first_name,
            driver_last_name: driverInfo.last_name,
            driver_phone: driverInfo.phone,
            driver_rating: driverInfo.rating,
            driver_avatar_url: driverInfo.avatar_url || null,
            passenger_ids,
            passengers
        };

        return {
            message: 'Поездка успешно обновлена',
            ride: mapRideRow(combinedRow, driverId)
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Удаление или отмена поездки водителем
 * @param {object} params - Параметры удаления
 * @param {string} params.rideId - ID поездки
 * @param {string|null} params.driverId - ID водителя
 * @returns {Promise<object>} Результат удаления
 */
async function deleteRide({ rideId, driverId }) {
    if (!driverId) {
        throw new ServiceError('Пользователь не авторизован', 401);
    }
    if (!isValidUuid(rideId)) {
        throw new ServiceError('Некорректный формат идентификатора поездки (UUID)', 400);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const rideRes = await client.query('SELECT id, driver_id, status FROM rides WHERE id = $1 FOR UPDATE', [rideId]);
        if (rideRes.rows.length === 0) {
            throw new ServiceError('Поездка не найдена', 404);
        }

        const ride = rideRes.rows[0];
        if (ride.driver_id !== driverId) {
            throw new ServiceError('Только водитель может отменить или удалить свою поездку', 403);
        }
        if (ride.status === 'active') {
            throw new ServiceError('Нельзя удалить активную поездку. Завершите или отмените её.', 400);
        }

        await client.query('DELETE FROM rides WHERE id = $1', [rideId]);
        await client.query('COMMIT');

        return { message: 'Поездка успешно удалена' };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Валидация возможности старта поездки
 * @param {object} ride - Данные поездки
 * @param {string} driverId - ID водителя
 */
function validateRideStartEligibility(ride, driverId) {
    if (ride.driver_id !== driverId) {
        throw new ServiceError('Только водитель поездки может начать её', 403);
    }
    if (ride.status === 'active') {
        throw new ServiceError('Поездка уже началась', 400);
    }
    if (ride.status === 'completed') {
        throw new ServiceError('Поездка уже завершена', 400);
    }
    if (ride.status === 'cancelled') {
        throw new ServiceError('Нельзя начать отмененную поездку', 400);
    }
    if (ride.status !== 'planned' && ride.status !== 'scheduled') {
        throw new ServiceError('Некорректный статус поездки для старта', 400);
    }
}

/**
 * Создание и запуск экземпляра регулярной поездки
 * @param {import('pg').PoolClient} client - Клиент БД
 * @param {object} currentRide - Текущая запись шаблона поездки
 * @returns {Promise<{id: string}>} Созданный экземпляр
 */
async function executeRegularRideCopy(client, currentRide) {
    const copyQuery = `
        INSERT INTO rides (
            driver_id, vehicle_id, parent_ride_id, departure_time,
            start_point, end_point, route_line, total_seats, available_seats,
            status, base_price, ride_type, regular_days, distance_meters,
            duration_seconds, route_polyline, description, tags,
            start_address, end_address
        )
        VALUES (
            $1, $2, $3, CURRENT_TIMESTAMP,
            ST_SetSRID(ST_MakePoint($4, $5), 4326),
            ST_SetSRID(ST_MakePoint($6, $7), 4326),
            $8, $9, $10,
            'active', $11, 'one_off', $12, $13,
            $14, $15, $16, $17,
            $18, $19
        )
        RETURNING id
    `;

    const copyRes = await client.query(copyQuery, [
        currentRide.driver_id,
        currentRide.vehicle_id,
        currentRide.id,
        currentRide.start_lon,
        currentRide.start_lat,
        currentRide.end_lon,
        currentRide.end_lat,
        currentRide.route_line,
        currentRide.total_seats,
        currentRide.available_seats,
        currentRide.base_price,
        currentRide.regular_days,
        currentRide.distance_meters,
        currentRide.duration_seconds,
        JSON.stringify(currentRide.route_polyline),
        currentRide.description,
        currentRide.tags || [],
        currentRide.start_address || null,
        currentRide.end_address || null
    ]);
    const instanceRideId = copyRes.rows[0].id;

    await client.query(`
        INSERT INTO ride_instances (ride_id, instance_ride_id, date, status, started_at)
        VALUES ($1, $2, CURRENT_DATE, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT (ride_id, date) DO UPDATE SET
            instance_ride_id = EXCLUDED.instance_ride_id,
            status = 'active',
            started_at = CURRENT_TIMESTAMP
    `, [currentRide.id, instanceRideId]);

    await client.query(`
        INSERT INTO matches (ride_id, passenger_id, agreed_price, status, selected_day)
        SELECT $1, passenger_id, agreed_price, 'accepted', selected_day
        FROM matches
        WHERE ride_id = $2 AND status = 'accepted'
        ON CONFLICT (ride_id, passenger_id) DO NOTHING
    `, [instanceRideId, currentRide.id]);

    return { id: instanceRideId };
}

/**
 * Старт поездки водителем
 * @param {object} params - Параметры старта
 * @param {string} params.rideId - ID поездки
 * @param {string|null} params.driverId - ID водителя
 * @returns {Promise<object>} Запущенная поездка
 */
async function startRide({ rideId, driverId }) {
    if (!isValidUuid(rideId)) {
        throw new ServiceError('Некорректный формат идентификатора поездки (UUID)', 400);
    }
    if (!driverId) {
        throw new ServiceError('Пользователь не авторизован', 401);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const rideRes = await client.query(
            `SELECT r.*,
                    ST_X(r.start_point) as start_lon, ST_Y(r.start_point) as start_lat,
                    ST_X(r.end_point) as end_lon, ST_Y(r.end_point) as end_lat
             FROM rides r
             WHERE r.id = $1 FOR UPDATE`,
            [rideId]
        );

        if (rideRes.rows.length === 0) {
            throw new ServiceError('Поездка не найдена', 404);
        }

        const currentRide = rideRes.rows[0];
        validateRideStartEligibility(currentRide, driverId);

        if (currentRide.ride_type === 'regular') {
            const instance = await executeRegularRideCopy(client, currentRide);
            await client.query('COMMIT');

            const fullRes = await pool.query(`${BASE_RIDE_SELECT} WHERE r.id = $1`, [instance.id]);
            return {
                message: 'Регулярная поездка успешно начата',
                ride: mapRideRow(fullRes.rows[0], driverId)
            };
        }

        await client.query("UPDATE rides SET status = 'active' WHERE id = $1", [rideId]);
        await client.query('COMMIT');

        const fullRes = await pool.query(`${BASE_RIDE_SELECT} WHERE r.id = $1`, [rideId]);
        return {
            message: 'Поездка успешно начата',
            ride: mapRideRow(fullRes.rows[0], driverId)
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Валидация возможности завершения поездки
 * @param {object} ride - Данные поездки
 * @param {string} driverId - ID водителя
 */
function validateRideFinishEligibility(ride, driverId) {
    if (ride.driver_id !== driverId) {
        throw new ServiceError('Только водитель поездки может завершить её', 403);
    }
    if (ride.status === 'completed') {
        throw new ServiceError('Поездка уже завершена', 400);
    }
    if (ride.status !== 'active') {
        throw new ServiceError('Завершить можно только активную поездку', 400);
    }
}

/**
 * Завершение поездки водителем
 * @param {object} params - Параметры завершения
 * @param {string} params.rideId - ID поездки
 * @param {string|null} params.driverId - ID водителя
 * @returns {Promise<object>} Завершенная поездка
 */
async function finishRide({ rideId, driverId }) {
    if (!isValidUuid(rideId)) {
        throw new ServiceError('Некорректный формат идентификатора поездки (UUID)', 400);
    }
    if (!driverId) {
        throw new ServiceError('Пользователь не авторизован', 401);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const rideRes = await client.query(
            'SELECT id, driver_id, status FROM rides WHERE id = $1 FOR UPDATE',
            [rideId]
        );

        if (rideRes.rows.length === 0) {
            throw new ServiceError('Поездка не найдена', 404);
        }

        const currentRide = rideRes.rows[0];
        validateRideFinishEligibility(currentRide, driverId);

        await client.query("UPDATE rides SET status = 'completed' WHERE id = $1", [rideId]);
        await client.query("UPDATE matches SET status = 'completed' WHERE ride_id = $1 AND status = 'accepted'", [rideId]);
        await client.query(`
            UPDATE ride_instances
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE instance_ride_id = $1 OR (ride_id = $1 AND status = 'active')
        `, [rideId]);

        await client.query('COMMIT');

        const fullRes = await pool.query(`${BASE_RIDE_SELECT} WHERE r.id = $1`, [rideId]);
        return {
            message: 'Поездка успешно завершена',
            ride: mapRideRow(fullRes.rows[0], driverId)
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    createRide,
    getRides,
    getRideById,
    getMyRides,
    updateRide,
    deleteRide,
    startRide,
    finishRide
};
