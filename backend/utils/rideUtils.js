/**
 * Модуль утилит для работы с поездками приложения Попутка ИИ.
 */

/**
 * Получение списка подтвержденных пассажиров для указанной поездки.
 * Устраняет дублирование SQL-запроса получения пассажиров.
 * @param {import('pg').Pool | import('pg').PoolClient} client - Клиент или пул PostgreSQL.
 * @param {string} rideId - Идентификатор поездки (UUID).
 * @returns {Promise<{ passenger_ids: string[], passengers: object[] }>} Объект со списками ID и данных пассажиров.
 */
async function getPassengersForRide(client, rideId) {
    const query = `
        SELECT
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', pu.id,
                        'name', COALESCE(pu.first_name, pu.username),
                        'username', pu.username,
                        'telegram', pu.username,
                        'phone', pu.phone,
                        'avatar_url', pu.avatar_url,
                        'selected_day', m.selected_day
                    )
                ) FILTER (WHERE pu.id IS NOT NULL),
                '[]'::json
            ) AS passengers,
            COALESCE(
                array_agg(m.passenger_id::text) FILTER (WHERE m.passenger_id IS NOT NULL),
                ARRAY[]::text[]
            ) AS passenger_ids
        FROM matches m
        JOIN users pu ON m.passenger_id = pu.id
        WHERE m.ride_id = $1 AND m.status = 'accepted'
    `;

    const res = await client.query(query, [rideId]);
    const row = res.rows[0];

    const passenger_ids = Array.isArray(row?.passenger_ids) ? row.passenger_ids : [];
    let passengers = [];
    if (Array.isArray(row?.passengers)) {
        passengers = row.passengers;
    } else if (typeof row?.passengers === 'string') {
        try {
            passengers = JSON.parse(row.passengers);
        } catch {
            passengers = [];
        }
    }

    return {
        passenger_ids,
        passengers
    };
}

module.exports = {
    getPassengersForRide
};

