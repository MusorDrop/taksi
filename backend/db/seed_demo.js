const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const pool = require('./index');
const rideService = require('../services/rideService');
const bookingService = require('../services/bookingService');

/**
 * Очистка существующих данных перед наполнением
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 */
async function clearExistingData(client) {
    console.log('1. Очистка таблиц базы данных...');
    await client.query('TRUNCATE TABLE reviews, matches, ride_instances, rides, vehicles, users CASCADE;');
    console.log('   Таблицы успешно очищены.');
}

/**
 * Создание 10 реалистичных пользователей (студенты УрФУ)
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @returns {Promise<Array<object>>} Список созданных пользователей
 */
async function seedUsers(client) {
    console.log('2. Создание 10 реалистичных пользователей (студенты УрФУ)...');
    const passwordHash = await bcrypt.hash('StudentPass123!', 10);

    const usersData = [
        {
            username: 'alex_smirnov',
            firstName: 'Алексей',
            lastName: 'Смирнов',
            phone: '+79221112233',
            role: 'both',
            rating: 4.95,
            preferences: { music: true, smoking: false, talkative: false, petFriendly: false }
        },
        {
            username: 'kate_popova',
            firstName: 'Екатерина',
            lastName: 'Попова',
            phone: '+79222223344',
            role: 'both',
            rating: 4.90,
            preferences: { music: true, smoking: false, talkative: true, petFriendly: true }
        },
        {
            username: 'dmitry_volkov',
            firstName: 'Дмитрий',
            lastName: 'Волков',
            phone: '+79223334455',
            role: 'both',
            rating: 5.00,
            preferences: { music: false, smoking: false, talkative: false, petFriendly: false }
        },
        {
            username: 'maria_kuznetsova',
            firstName: 'Мария',
            lastName: 'Кузнецова',
            phone: '+79224445566',
            role: 'both',
            rating: 4.88,
            preferences: { music: true, smoking: false, talkative: true, petFriendly: false }
        },
        {
            username: 'artem_sokolov',
            firstName: 'Артём',
            lastName: 'Соколов',
            phone: '+79225556677',
            role: 'both',
            rating: 4.92,
            preferences: { music: true, smoking: false, talkative: true, petFriendly: false }
        },
        {
            username: 'anna_morozova',
            firstName: 'Анна',
            lastName: 'Морозова',
            phone: '+79226667788',
            role: 'passenger',
            rating: 5.00,
            preferences: { music: true, smoking: false, talkative: false, petFriendly: false }
        },
        {
            username: 'ivan_novikov',
            firstName: 'Иван',
            lastName: 'Новиков',
            phone: '+79227778899',
            role: 'passenger',
            rating: 4.85,
            preferences: { music: true, smoking: false, talkative: true, petFriendly: false }
        },
        {
            username: 'polina_fedorova',
            firstName: 'Полина',
            lastName: 'Фёдорова',
            phone: '+79228889900',
            role: 'passenger',
            rating: 4.95,
            preferences: { music: true, smoking: false, talkative: false, petFriendly: false }
        },
        {
            username: 'mikhail_kozlov',
            firstName: 'Михаил',
            lastName: 'Козлов',
            phone: '+79229990011',
            role: 'passenger',
            rating: 4.90,
            preferences: { music: true, smoking: false, talkative: true, petFriendly: false }
        },
        {
            username: 'elena_vasilieva',
            firstName: 'Елена',
            lastName: 'Васильева',
            phone: '+79220001122',
            role: 'passenger',
            rating: 5.00,
            preferences: { music: true, smoking: false, talkative: true, petFriendly: false }
        }
    ];

    const createdUsers = [];
    for (const u of usersData) {
        const query = `
            INSERT INTO users (
                username, password_hash, first_name, last_name,
                phone, role, rating, preferences, is_verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
            RETURNING id, username, first_name, last_name, phone, role, rating;
        `;
        const res = await client.query(query, [
            u.username,
            passwordHash,
            u.firstName,
            u.lastName,
            u.phone,
            u.role,
            u.rating,
            JSON.stringify(u.preferences)
        ]);
        createdUsers.push(res.rows[0]);
    }

    console.log(`   Создано ${createdUsers.length} пользователей.`);
    return createdUsers;
}

/**
 * Создание автомобилей для водителей
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @param {Array<object>} users - Список пользователей
 * @returns {Promise<Array<object>>} Список созданных автомобилей
 */
async function seedVehicles(client, users) {
    console.log('3. Создание автомобилей для водителей...');
    const vehiclesData = [
        { driverIndex: 0, brand: 'Škoda Octavia', color: 'белый', licensePlate: 'А123ВС96', seats: 4 },
        { driverIndex: 1, brand: 'Volkswagen Polo', color: 'красный', licensePlate: 'В456ОН196', seats: 4 },
        { driverIndex: 2, brand: 'Hyundai Solaris', color: 'серебристый', licensePlate: 'С789ТК96', seats: 4 },
        { driverIndex: 3, brand: 'Kia Rio', color: 'синий', licensePlate: 'Е012МР196', seats: 4 },
        { driverIndex: 4, brand: 'Toyota Camry', color: 'черный', licensePlate: 'К345АА96', seats: 4 }
    ];

    const createdVehicles = [];
    for (const v of vehiclesData) {
        const driverId = users[v.driverIndex].id;
        const res = await client.query(
            `INSERT INTO vehicles (driver_id, brand, color, license_plate, seats)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, driver_id, brand, color, license_plate, seats`,
            [driverId, v.brand, v.color, v.licensePlate, v.seats]
        );
        createdVehicles.push(res.rows[0]);
    }

    console.log(`   Создано ${createdVehicles.length} автомобилей.`);
    return createdVehicles;
}

/**
 * Создание 4 реалистичных поездок через rideService с расчетом полилиний Yandex Maps
 * @param {Array<object>} users - Пользователи
 * @param {Array<object>} vehicles - Автомобили
 * @returns {Promise<Array<object>>} Созданные поездки
 */
async function seedRides(users, vehicles) {
    console.log('4. Создание 4 поездок через rideService.createRide (с построением Yandex Maps полилиний)...');
    const now = Date.now();

    const ridesPayload = [
        // Поездка 1: Регулярная (Кампус Новокольцовский -> ГУК УрФУ)
        {
            driver: users[0],
            vehicle: vehicles[0],
            data: {
                start_point: { lat: 56.7686, lon: 60.7712, name: 'Кампус Новокольцовский УрФУ (ул. 100-летия УрФУ, 1)' },
                end_point: { lat: 56.8439, lon: 60.6534, name: 'Главный учебный корпус УрФУ (ул. Мира, 19)' },
                departure_time: new Date(now + 21 * 3600 * 1000).toISOString(),
                total_seats: 4,
                available_seats: 4,
                base_price: 150,
                ride_type: 'regular',
                regular_days: ['Пн', 'Ср', 'Пт'],
                description: 'Регулярный утренний рейс из кампуса Новокольцовский к первой паре в Главный корпус УрФУ (ГУК). Выезд от КПП общаг ровно в 08:30. В салоне чисто, не курим, играет спокойная музыка.',
                tags: ['Чистый салон', 'Не курить', 'Без остановок', 'Утренний рейс'],
                vehicle_id: vehicles[0].id
            }
        },
        // Поездка 2: Разовая (ГУК УрФУ -> Кампус Новокольцовский)
        {
            driver: users[1],
            vehicle: vehicles[1],
            data: {
                start_point: { lat: 56.8439, lon: 60.6534, name: 'Главный учебный корпус УрФУ (ул. Мира, 19)' },
                end_point: { lat: 56.7686, lon: 60.7712, name: 'Кампус Новокольцовский УрФУ (ул. 100-летия УрФУ, 1)' },
                departure_time: new Date(now + 2 * 3600 * 1000).toISOString(),
                total_seats: 4,
                available_seats: 4,
                base_price: 160,
                ride_type: 'one_off',
                description: 'Поездка после пар из ГУКа в кампус Новокольцовский. Забираю с парковки у фонтана. Приятная музыка, есть место для рюкзаков и ноутбуков.',
                tags: ['С музыкой', 'Можно с кофе/едой', 'Пустой багажник', 'Чистый салон'],
                vehicle_id: vehicles[1].id
            }
        },
        // Поездка 3: Запланированная (Кампус Новокольцовский -> УрФУ пр. Ленина 51)
        {
            driver: users[2],
            vehicle: vehicles[2],
            data: {
                start_point: { lat: 56.7686, lon: 60.7712, name: 'Кампус Новокольцовский УрФУ (ул. 100-летия УрФУ, 1)' },
                end_point: { lat: 56.8396, lon: 60.6172, name: 'УрФУ на Ленина (пр. Ленина, 51)' },
                departure_time: new Date(now + 26 * 3600 * 1000).toISOString(),
                total_seats: 4,
                available_seats: 4,
                base_price: 170,
                ride_type: 'one_off',
                description: 'Дневная поездка в корпус УГИ/ИЕНИМ на пр. Ленина 51 на лабораторные работы. Выезжаю от общежитий Новокольцовского. Вожу аккуратно, без резких маневров.',
                tags: ['Аккуратно вожу', 'Не курить', 'Тишина', 'Без опозданий'],
                vehicle_id: vehicles[2].id
            }
        },
        // Поездка 4: Запланированная регулярная (ТРЦ Гринвич -> Кампус Новокольцовский)
        {
            driver: users[3],
            vehicle: vehicles[3],
            data: {
                start_point: { lat: 56.8295, lon: 60.5980, name: 'ТРЦ Гринвич (ул. 8 Марта, 46)' },
                end_point: { lat: 56.7686, lon: 60.7712, name: 'Кампус Новокольцовский УрФУ (ул. 100-летия УрФУ, 1)' },
                departure_time: new Date(now + 55 * 3600 * 1000).toISOString(),
                total_seats: 4,
                available_seats: 4,
                base_price: 190,
                ride_type: 'regular',
                regular_days: ['Вт', 'Чт'],
                description: 'Вечерний регулярный рейс из центра (от ТРЦ Гринвич) обратно в Новокольцовский. Удобно после прогулки или доп. занятий. Багажник свободен для пакетов и сумок.',
                tags: ['Пустой багажник', 'С музыкой', 'Чистый салон', 'Можно с кофе/едой'],
                vehicle_id: vehicles[3].id
            }
        }
    ];

    const createdRides = [];
    for (const item of ridesPayload) {
        const result = await rideService.createRide({
            userId: item.driver.id,
            userRole: item.driver.role,
            rideData: item.data
        });
        const r = result.ride;
        const coordsCount = r.route_polyline?.coordinates?.length || 0;
        console.log(`   Создана поездка ${r.id}: ${r.start_address} -> ${r.end_address} (${r.distance_km} км, полилиния: ${coordsCount} точек)`);
        createdRides.push(r);
    }

    return createdRides;
}

/**
 * Создание отзыва и пересчет среднего рейтинга
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @param {object} params - Параметры отзыва
 */
async function addReview(client, { rideId, reviewerId, revieweeId, rating, comment }) {
    await client.query(`
        INSERT INTO reviews (ride_id, reviewer_id, reviewee_id, rating, comment)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (ride_id, reviewer_id, reviewee_id) DO UPDATE
        SET rating = EXCLUDED.rating, comment = EXCLUDED.comment;
    `, [rideId, reviewerId, revieweeId, rating, comment]);

    await client.query(`
        WITH calculated AS (
            SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating
            FROM reviews
            WHERE reviewee_id = $1
        )
        UPDATE users
        SET rating = calculated.avg_rating
        FROM calculated
        WHERE users.id = $1;
    `, [revieweeId]);
}

/**
 * Симуляция жизненного цикла поездок (присоединение, старт, завершение, отзывы)
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @param {Array<object>} users - Пользователи
 * @param {Array<object>} rides - Поездки
 */
async function simulateLifecycle(client, users, rides) {
    console.log('5. Симуляция жизненного цикла (бронирование, старт, финиш, отзывы)...');

    // --- Жизненный цикл Поездки 1 (Регулярная) ---
    console.log('   [Поездка 1] Бронирование мест пассажирами (Анна Морозова и Иван Новиков)...');
    await bookingService.joinRide({ rideId: rides[0].id, passengerId: users[5].id, selectedDay: 'Пн' });
    await bookingService.joinRide({ rideId: rides[0].id, passengerId: users[6].id, selectedDay: 'Пн' });

    console.log('   [Поездка 1] Старт регулярной поездки водителем (создание ride_instance)...');
    const startRes1 = await rideService.startRide({ rideId: rides[0].id, driverId: users[0].id });
    const instanceRideId = startRes1.ride.id;
    console.log(`   [Поездка 1] Создан активный экземпляр поездки: ${instanceRideId}`);

    console.log('   [Поездка 1] Завершение поездки водителем...');
    await rideService.finishRide({ rideId: instanceRideId, driverId: users[0].id });

    console.log('   [Поездка 1] Добавление отзывов от пассажиров для Алексея Смирнова...');
    await addReview(client, {
        rideId: instanceRideId,
        reviewerId: users[5].id,
        revieweeId: users[0].id,
        rating: 5,
        comment: 'Отличная поездка! Алексей приехал вовремя к КПП, доехали до ГУКа без пробок всего за 20 минут. Салон очень чистый, играло ненавязчивое радио. Буду ездить регулярно!'
    });
    await addReview(client, {
        rideId: instanceRideId,
        reviewerId: users[6].id,
        revieweeId: users[0].id,
        rating: 5,
        comment: 'Очень выручил утром перед коллоквиумом! Водитель пунктуальный, аккуратный за рулём. Доехали спокойно и с комфортом.'
    });

    // Бронирование места на будущую среду для демонстрации в интерфейсе
    console.log('   [Поездка 1] Бронирование места на Ср Полиной Фёдоровой (поездка останется запланированной)...');
    await bookingService.joinRide({ rideId: rides[0].id, passengerId: users[7].id, selectedDay: 'Ср' });

    // --- Жизненный цикл Поездки 2 (Разовая) ---
    console.log('   [Поездка 2] Бронирование мест пассажирами (Михаил Козлов и Елена Васильева)...');
    await bookingService.joinRide({ rideId: rides[1].id, passengerId: users[8].id });
    await bookingService.joinRide({ rideId: rides[1].id, passengerId: users[9].id });

    console.log('   [Поездка 2] Старт разовой поездки водителем...');
    await rideService.startRide({ rideId: rides[1].id, driverId: users[1].id });

    console.log('   [Поездка 2] Завершение поездки водителем...');
    await rideService.finishRide({ rideId: rides[1].id, driverId: users[1].id });

    console.log('   [Поездка 2] Добавление отзывов от пассажиров для Екатерины Поповой...');
    await addReview(client, {
        rideId: rides[1].id,
        reviewerId: users[8].id,
        revieweeId: users[1].id,
        rating: 5,
        comment: 'Прекрасная поездка! Екатерина водит плавно и уверенно, приятный собеседник. Быстро добрались до общежитий после пар, очень комфортно.'
    });
    await addReview(client, {
        rideId: rides[1].id,
        reviewerId: users[9].id,
        revieweeId: users[1].id,
        rating: 5,
        comment: 'Очень понравилось ехать с Екатериной! Чистая машина, приятная музыка и доехали прямо до нашего корпуса. Огромное спасибо!'
    });

    // --- Жизненный цикл Поездки 3 (Запланированная, ожидает участников) ---
    console.log('   [Поездка 3] Бронирование 1 места Полиной Фёдоровой (поездка planned, доступна в поиске)...');
    await bookingService.joinRide({ rideId: rides[2].id, passengerId: users[7].id });

    // --- Жизненный цикл Поездки 4 (Запланированная регулярная, ожидает участников) ---
    console.log('   [Поездка 4] Бронирование 1 места Иваном Новиковым (поездка planned, доступна в поиске)...');
    await bookingService.joinRide({ rideId: rides[3].id, passengerId: users[6].id, selectedDay: 'Вт' });

    console.log('   Симуляция жизненного цикла успешно завершена.');
}

/**
 * Основная точка входа для генерации демонстрационных данных
 */
async function seedDemo() {
    console.log('=== НАЧАЛО ГЕНЕРАЦИИ РЕАЛИСТИЧНЫХ ДЕМО-ДАННЫХ (SEED DEMO) ===\n');
    const client = await pool.connect();
    try {
        await clearExistingData(client);
        const users = await seedUsers(client);
        const vehicles = await seedVehicles(client, users);
        const rides = await seedRides(users, vehicles);
        await simulateLifecycle(client, users, rides);

        console.log('\n=== ДЕМО-ДАННЫЕ УСПЕШНО СГЕНЕРИРОВАНЫ И ГОТОВЫ К ВИДЕО-ПРЕЗЕНТАЦИИ! ===');
    } catch (err) {
        console.error('Ошибка при генерации демо-данных:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    seedDemo();
}

module.exports = seedDemo;
