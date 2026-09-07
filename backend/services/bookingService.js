/**
 * @file bookingService.js
 * Сервис управления бронированиями мест и пассажирами в поездках.
 */

const pool = require('../db');
const { isValidUuid } = require('../utils/validation');
const { getPassengersForRide } = require('../utils/rideUtils');
const { ServiceError } = require('../utils/errors');

/**
 * Валидация идентификаторов поездки и пользователя
 * @param {string} rideId - Идентификатор поездки
 * @param {string|null} userId - Идентификатор пользователя
 */
function validateRideAndUser(rideId, userId) {
    if (!isValidUuid(rideId)) {
        throw new ServiceError('Некорректный формат идентификатора поездки (UUID)', 400);
    }
    if (!userId) {
        throw new ServiceError('Пользователь не авторизован', 401);
    }
}

/**
 * Получение и блокировка записи поездки для безопасного выполнения транзакции
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @param {string} rideId - Идентификатор поездки
 * @returns {Promise<object>} Строка поездки
 */
async function getLockedRide(client, rideId) {
    const query = `
        SELECT id, driver_id, status, available_seats, total_seats, base_price, ride_type, regular_days
        FROM rides
        WHERE id = $1
        FOR UPDATE
    `;
    const res = await client.query(query, [rideId]);
    if (res.rows.length === 0) {
        throw new ServiceError('Поездка не найдена', 404);
    }
    return res.rows[0];
}

/**
 * Валидация возможности присоединения к поездке
 * @param {object} ride - Данные поездки
 * @param {string} passengerId - Идентификатор пассажира
 */
function validateJoinEligibility(ride, passengerId) {
    if (ride.status !== 'planned' && ride.status !== 'scheduled') {
        throw new ServiceError('Присоединиться можно только к запланированной поездке', 400);
    }
    if (ride.driver_id === passengerId) {
        throw new ServiceError('Водитель не может присоединиться к собственной поездке', 400);
    }
    if (ride.available_seats <= 0) {
        throw new ServiceError('В поездке нет свободных мест', 400);
    }
}

/**
 * Проверка отсутствия уже существующего бронирования
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @param {string} rideId - Идентификатор поездки
 * @param {string} passengerId - Идентификатор пассажира
 */
async function ensureNotAlreadyJoined(client, rideId, passengerId) {
    const query = 'SELECT id FROM matches WHERE ride_id = $1 AND passenger_id = $2 AND status = $3';
    const res = await client.query(query, [rideId, passengerId, 'accepted']);
    if (res.rows.length > 0) {
        throw new ServiceError('Вы уже присоединились к этой поездке', 400);
    }
}

/**
 * Присоединение пассажира к поездке
 * @param {object} params - Параметры вызова
 * @param {string} params.rideId - Идентификатор поездки
 * @param {string} params.passengerId - Идентификатор пассажира
 * @param {string|null} [params.selectedDay] - Выбранный день недели (для регулярных)
 * @returns {Promise<object>} Результат бронирования
 */
async function joinRide({ rideId, passengerId, selectedDay = null }) {
    validateRideAndUser(rideId, passengerId);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ride = await getLockedRide(client, rideId);
        validateJoinEligibility(ride, passengerId);
        await ensureNotAlreadyJoined(client, rideId, passengerId);

        const updateRideRes = await client.query(
            'UPDATE rides SET available_seats = available_seats - 1 WHERE id = $1 RETURNING available_seats',
            [rideId]
        );

        const insertMatchQuery = `
            INSERT INTO matches (ride_id, passenger_id, agreed_price, status, selected_day)
            VALUES ($1, $2, $3, 'accepted', $4)
            RETURNING *
        `;
        const matchRes = await client.query(insertMatchQuery, [rideId, passengerId, ride.base_price, selectedDay]);

        const { passenger_ids, passengers } = await getPassengersForRide(client, rideId);
        const current_price = Number(ride.base_price);

        await client.query('COMMIT');

        return {
            message: 'Вы успешно присоединились к поездке',
            match: matchRes.rows[0],
            available_seats: updateRideRes.rows[0].available_seats,
            current_price,
            passenger_ids,
            passengers
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Валидация возможности отмены участия
 * @param {object} ride - Данные поездки
 */
function validateLeaveEligibility(ride) {
    if (ride.status !== 'planned' && ride.status !== 'scheduled') {
        throw new ServiceError('Отменить участие можно только в запланированной поездке', 400);
    }
}

/**
 * Отмена участия пассажира в поездке
 * @param {object} params - Параметры отмены
 * @param {string} params.rideId - Идентификатор поездки
 * @param {string} params.passengerId - Идентификатор пассажира
 * @returns {Promise<object>} Результат отмены участия
 */
async function leaveRide({ rideId, passengerId }) {
    validateRideAndUser(rideId, passengerId);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ride = await getLockedRide(client, rideId);
        validateLeaveEligibility(ride);

        const deleteRes = await client.query(
            "DELETE FROM matches WHERE ride_id = $1 AND passenger_id = $2 AND status = 'accepted' RETURNING id",
            [rideId, passengerId]
        );

        if (deleteRes.rowCount === 0) {
            throw new ServiceError('Бронирование пассажира для данной поездки не найдено', 404);
        }

        const updateRideRes = await client.query(
            'UPDATE rides SET available_seats = LEAST(total_seats, available_seats + 1) WHERE id = $1 RETURNING available_seats',
            [rideId]
        );

        const { passenger_ids, passengers } = await getPassengersForRide(client, rideId);
        const current_price = Number(ride.base_price);

        await client.query('COMMIT');

        return {
            message: 'Вы успешно отменили участие в поездке',
            available_seats: updateRideRes.rows[0]?.available_seats,
            current_price,
            passenger_ids,
            passengers
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Валидация прав водителя для исключения пассажира
 * @param {object} ride - Данные поездки
 * @param {string} driverId - Идентификатор водителя
 */
function validateDriverKickEligibility(ride, driverId) {
    if (ride.driver_id !== driverId) {
        throw new ServiceError('Только водитель может исключать пассажиров из поездки', 403);
    }
    if (ride.status !== 'planned' && ride.status !== 'scheduled') {
        throw new ServiceError('Исключать пассажиров можно только из запланированной поездки', 400);
    }
}

/**
 * Исключение пассажира водителем
 * @param {object} params - Параметры исключения
 * @param {string} params.rideId - Идентификатор поездки
 * @param {string} params.passengerId - Идентификатор пассажира
 * @param {string} params.driverId - Идентификатор водителя
 * @returns {Promise<object>} Результат исключения пассажира
 */
async function kickPassenger({ rideId, passengerId, driverId }) {
    if (!isValidUuid(rideId) || !isValidUuid(passengerId)) {
        throw new ServiceError('Некорректный формат идентификатора (UUID)', 400);
    }
    if (!driverId) {
        throw new ServiceError('Пользователь не авторизован', 401);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ride = await getLockedRide(client, rideId);
        validateDriverKickEligibility(ride, driverId);

        const deleteRes = await client.query(
            "DELETE FROM matches WHERE ride_id = $1 AND passenger_id = $2 AND status = 'accepted' RETURNING id",
            [rideId, passengerId]
        );

        if (deleteRes.rowCount === 0) {
            throw new ServiceError('Пассажир не найден среди участников этой поездки', 404);
        }

        const updateRideRes = await client.query(
            'UPDATE rides SET available_seats = LEAST(total_seats, available_seats + 1) WHERE id = $1 RETURNING available_seats',
            [rideId]
        );

        const { passenger_ids: remainingPassengerIds, passengers: remainingPassengers } = await getPassengersForRide(client, rideId);

        await client.query('COMMIT');

        return {
            message: 'Пассажир успешно исключен из поездки',
            available_seats: updateRideRes.rows[0]?.available_seats,
            current_price: Number(ride.base_price),
            passenger_ids: remainingPassengerIds,
            passengers: remainingPassengers
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    joinRide,
    leaveRide,
    kickPassenger
};
