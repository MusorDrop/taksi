const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const bcrypt = require('bcryptjs');
const pool = require('./index');

/**
 * Полный сброс схемы базы данных и пересоздание
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 */
async function resetDatabase(client) {
    console.log('1. Сброс схемы public и очистка таблиц...');
    await client.query('DROP SCHEMA public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');

    console.log('2. Применение миграции 001_initial_schema.sql...');
    const migrationPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);

    // Фиксация миграции в schema_migrations
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO schema_migrations (version) VALUES ('001_initial_schema.sql')
        ON CONFLICT DO NOTHING;
    `);
    console.log('   Схема успешно развернута.');
}

/**
 * Создание 10 реалистичных пользователей сервиса
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @returns {Promise<Array<object>>} Список созданных пользователей
 */
async function seedUsers(client) {
    console.log('3. Наполнение 10 пользователей...');
    const passwordHash = await bcrypt.hash('StudentPass123!', 10);

    const usersData = [
        {
            username: 'alex_smirnov',
            firstName: 'Алексей',
            lastName: 'Смирнов',
            phone: '+79221112233',
            role: 'both',
            rating: 4.90
        },
        {
            username: 'kate_popova',
            firstName: 'Екатерина',
            lastName: 'Попова',
            phone: '+79222223344',
            role: 'both',
            rating: 4.85
        },
        {
            username: 'dmitry_volkov',
            firstName: 'Дмитрий',
            lastName: 'Волков',
            phone: '+79223334455',
            role: 'both',
            rating: 5.00
        },
        {
            username: 'maria_kuznetsova',
            firstName: 'Мария',
            lastName: 'Кузнецова',
            phone: '+79224445566',
            role: 'both',
            rating: null
        },
        {
            username: 'artem_sokolov',
            firstName: 'Артём',
            lastName: 'Соколов',
            phone: '+79225556677',
            role: 'both',
            rating: null
        },
        {
            username: 'anna_morozova',
            firstName: 'Анна',
            lastName: 'Морозова',
            phone: '+79226667788',
            role: 'passenger',
            rating: 5.00
        },
        {
            username: 'ivan_novikov',
            firstName: 'Иван',
            lastName: 'Новиков',
            phone: '+79227778899',
            role: 'passenger',
            rating: 4.80
        },
        {
            username: 'polina_fedorova',
            firstName: 'Полина',
            lastName: 'Федорова',
            phone: '+79228889900',
            role: 'passenger',
            rating: 4.95
        },
        {
            username: 'mikhail_kozlov',
            firstName: 'Михаил',
            lastName: 'Козлов',
            phone: '+79229990011',
            role: 'passenger',
            rating: 4.90
        },
        {
            username: 'elena_vasilieva',
            firstName: 'Елена',
            lastName: 'Васильева',
            phone: '+79220001122',
            role: 'both',
            rating: 5.00
        }
    ];

    const createdUsers = [];
    for (const u of usersData) {
        const res = await client.query(
            `INSERT INTO users (
                username, password_hash, first_name, last_name, phone, role, rating, is_verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            RETURNING id, username, first_name, last_name, phone, role, rating`,
            [u.username, passwordHash, u.firstName, u.lastName, u.phone, u.role, u.rating]
        );
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
    console.log('4. Создание автомобилей для водителей...');
    const vehiclesData = [
        { driverIndex: 0, brand: 'Škoda Octavia', color: 'белый', licensePlate: 'А123ВС96', seats: 4 },
        { driverIndex: 1, brand: 'Toyota Camry', color: 'черный', licensePlate: 'В456ОН196', seats: 4 },
        { driverIndex: 2, brand: 'Hyundai Solaris', color: 'серебристый', licensePlate: 'С789ТК96', seats: 4 },
        { driverIndex: 3, brand: 'Kia Rio', color: 'синий', licensePlate: 'Е012МР196', seats: 4 },
        { driverIndex: 4, brand: 'Volkswagen Polo', color: 'серый', licensePlate: 'К345АА96', seats: 4 }
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
 * Создание 5 реалистичных поездок в Екатеринбурге
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @param {Array<object>} users - Список пользователей
 * @param {Array<object>} vehicles - Список автомобилей
 * @returns {Promise<Array<object>>} Список созданных поездок
 */
async function seedRides(client, users, vehicles) {
    console.log('5. Создание 5 реалистичных поездок в Екатеринбурге...');
    const now = Date.now();

    const ridesData = [
        // Поездка 1: Регулярная (Кампус Новокольцовский -> Главный корпус УрФУ)
        {
            driverIndex: 0,
            vehicleIndex: 0,
            departureTime: new Date(now + 1 * 24 * 3600 * 1000 + 8 * 3600 * 1000).toISOString(),
            startLon: 60.7712,
            startLat: 56.7686,
            endLon: 60.6534,
            endLat: 56.8439,
            startAddress: 'Кампус Новокольцовский (ул. 100-летия УрФУ, 1)',
            endAddress: 'Главный корпус УрФУ (ул. Мира, 19)',
            totalSeats: 4,
            availableSeats: 2,
            status: 'planned',
            basePrice: 150.00,
            rideType: 'regular',
            regularDays: 'Пн, Ср',
            distanceMeters: 14500,
            durationSeconds: 1500,
            tags: ['Чистый салон', 'Не курить', 'Без остановок', 'Еду молча'],
            description: 'Ежедневный утренний рейс на пары в главный корпус УрФУ через Сибирский тракт. Выезжаем ровно по расписанию!'
        },
        // Поездка 2: Регулярная (Академический -> ТРЦ Гринвич / Центр)
        {
            driverIndex: 1,
            vehicleIndex: 1,
            departureTime: new Date(now + 2 * 24 * 3600 * 1000 + 7 * 3600 * 1000).toISOString(),
            startLon: 60.5186,
            startLat: 56.7865,
            endLon: 60.5980,
            endLat: 56.8295,
            startAddress: 'Академический район (ул. Краснолесья, 125)',
            endAddress: 'ТРЦ Гринвич (ул. 8 Марта, 46)',
            totalSeats: 4,
            availableSeats: 3,
            status: 'planned',
            basePrice: 200.00,
            rideType: 'regular',
            regularDays: 'Вт, Чт',
            distanceMeters: 9800,
            durationSeconds: 1200,
            tags: ['С музыкой', 'Можно с кофе/едой', 'Чистый салон', 'Можно с багажом'],
            description: 'Утренний маршрут из Академического до центра (Гринвич). Приятная музыка, кофе и стаканчики с крышкой разрешены.'
        },
        // Поездка 3: Обычная (Уралмаш -> ИРИТ-РТФ Новокольцовский)
        {
            driverIndex: 2,
            vehicleIndex: 2,
            departureTime: new Date(now + 3 * 24 * 3600 * 1000 + 9 * 3600 * 1000).toISOString(),
            startLon: 60.5975,
            startLat: 56.8885,
            endLon: 60.7712,
            endLat: 56.7686,
            startAddress: 'Уралмаш (пр. Космонавтов, 32)',
            endAddress: 'ИРИТ-РТФ (Новокольцовский)',
            totalSeats: 4,
            availableSeats: 4,
            status: 'planned',
            basePrice: 280.00,
            rideType: 'one_off',
            regularDays: null,
            distanceMeters: 21000,
            durationSeconds: 2100,
            tags: ['Аккуратно вожу', 'Не курить', 'Тишина', 'Пустой багажник'],
            description: 'Поездка в новый кампус ИРИТ-РТФ на лабораторные через ЕКАД. Большой свободный багажник для учебных проектов.'
        },
        // Поездка 4: Обычная, Завершенная (ЖБИ -> Гуманитарный институт Ленина 51)
        {
            driverIndex: 3,
            vehicleIndex: 3,
            departureTime: new Date(now - 1 * 24 * 3600 * 1000 + 9 * 3600 * 1000).toISOString(),
            startLon: 60.6860,
            startLat: 56.8285,
            endLon: 60.6172,
            endLat: 56.8396,
            startAddress: 'ЖБИ (ул. Высоцкого, 14)',
            endAddress: 'УрФУ (Гуманитарный институт, пр. Ленина, 51)',
            totalSeats: 3,
            availableSeats: 1,
            status: 'completed',
            basePrice: 130.00,
            rideType: 'one_off',
            regularDays: null,
            distanceMeters: 6200,
            durationSeconds: 900,
            tags: ['Люблю поболтать', 'С музыкой', 'Можно с кофе/едой'],
            description: 'Едем к первой паре на Ленина 51 через Малышева. Отличная компания и позитивная музыка перед парами!'
        },
        // Поездка 5: Обычная, Завершенная (Ботаника -> Аэропорт Кольцово)
        {
            driverIndex: 4,
            vehicleIndex: 4,
            departureTime: new Date(now - 2 * 24 * 3600 * 1000 + 14 * 3600 * 1000).toISOString(),
            startLon: 60.6310,
            startLat: 56.7970,
            endLon: 60.8043,
            endLat: 56.7431,
            startAddress: 'Ботаника (ул. Академика Шварца, 14)',
            endAddress: 'Аэропорт Кольцово (терминал А)',
            totalSeats: 3,
            availableSeats: 2,
            status: 'completed',
            basePrice: 350.00,
            rideType: 'one_off',
            regularDays: null,
            distanceMeters: 15400,
            durationSeconds: 1300,
            tags: ['Можно с багажом', 'Пустой багажник', 'Аккуратно вожу', 'Не курить'],
            description: 'Быстрый комфортный рейс в аэропорт Кольцово по Кольцовскому тракту. Помогу аккуратно погрузить багаж.'
        }
    ];

    const createdRides = [];
    for (const r of ridesData) {
        const driverId = users[r.driverIndex].id;
        const vehicleId = vehicles[r.vehicleIndex].id;
        const polyline = {
            type: 'LineString',
            coordinates: [
                [r.startLon, r.startLat],
                [r.endLon, r.endLat]
            ]
        };

        const res = await client.query(
            `INSERT INTO rides (
                driver_id, vehicle_id, departure_time,
                start_point, end_point,
                start_address, end_address,
                total_seats, available_seats, status,
                base_price, ride_type, regular_days,
                distance_meters, duration_seconds, route_polyline,
                description, tags
            ) VALUES (
                $1, $2, $3,
                ST_SetSRID(ST_MakePoint($4, $5), 4326),
                ST_SetSRID(ST_MakePoint($6, $7), 4326),
                $8, $9,
                $10, $11, $12,
                $13, $14, $15,
                $16, $17, $18,
                $19, $20
            ) RETURNING id, driver_id, status, ride_type, base_price, available_seats, total_seats`,
            [
                driverId,
                vehicleId,
                r.departureTime,
                r.startLon,
                r.startLat,
                r.endLon,
                r.endLat,
                r.startAddress,
                r.endAddress,
                r.totalSeats,
                r.availableSeats,
                r.status,
                r.basePrice,
                r.rideType,
                r.regularDays,
                r.distanceMeters,
                r.durationSeconds,
                JSON.stringify(polyline),
                r.description,
                r.tags
            ]
        );
        createdRides.push(res.rows[0]);
    }

    console.log(`   Создано ${createdRides.length} поездок.`);
    return createdRides;
}

/**
 * Создание бронирований и добавление пассажиров в поездки
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @param {Array<object>} rides - Список поездок
 * @param {Array<object>} users - Список пользователей
 */
async function seedMatches(client, rides, users) {
    console.log('6. Добавление пассажиров в поездки (прогон цикла)...');

    const matchesData = [
        // Поездка 1 (регулярная, planned): 2 пассажира (Анна Морозова и Иван Новиков)
        {
            rideId: rides[0].id,
            passengerId: users[5].id,
            agreedPrice: 150.00,
            status: 'accepted',
            selectedDay: 'Пн'
        },
        {
            rideId: rides[0].id,
            passengerId: users[6].id,
            agreedPrice: 150.00,
            status: 'accepted',
            selectedDay: 'Пн'
        },
        // Поездка 2 (регулярная, planned): 1 пассажир (Полина Федорова)
        {
            rideId: rides[1].id,
            passengerId: users[7].id,
            agreedPrice: 200.00,
            status: 'accepted',
            selectedDay: 'Вт'
        },
        // Поездка 4 (обычная, completed): 2 пассажира (Михаил Козлов и Елена Васильева)
        {
            rideId: rides[3].id,
            passengerId: users[8].id,
            agreedPrice: 130.00,
            status: 'completed',
            selectedDay: null
        },
        {
            rideId: rides[3].id,
            passengerId: users[9].id,
            agreedPrice: 130.00,
            status: 'completed',
            selectedDay: null
        },
        // Поездка 5 (обычная, completed): 1 пассажир (Анна Морозова)
        {
            rideId: rides[4].id,
            passengerId: users[5].id,
            agreedPrice: 350.00,
            status: 'completed',
            selectedDay: null
        }
    ];

    for (const m of matchesData) {
        await client.query(
            `INSERT INTO matches (ride_id, passenger_id, agreed_price, status, selected_day)
             VALUES ($1, $2, $3, $4, $5)`,
            [m.rideId, m.passengerId, m.agreedPrice, m.status, m.selectedDay]
        );
    }

    console.log(`   Создано ${matchesData.length} бронирований пассажиров.`);
}

/**
 * Создание отзывов пассажиров для водителей завершенных поездок
 * @param {import('pg').PoolClient} client - Клиент PostgreSQL
 * @param {Array<object>} rides - Список поездок
 * @param {Array<object>} users - Список пользователей
 */
async function seedReviews(client, rides, users) {
    console.log('7. Добавление отзывов для водителей завершенных поездок...');

    const reviewsData = [
        // Отзыв 1 для Марии Кузнецовой (водитель поездки 4) от Михаила Козлова
        {
            rideId: rides[3].id,
            reviewerId: users[8].id,
            revieweeId: users[3].id,
            rating: 5,
            comment: 'Отличная поездка! Доехали быстро и без пробок, очень комфортная и приятная атмосфера в салоне.'
        },
        // Отзыв 2 для Марии Кузнецовой (водитель поездки 4) от Елены Васильевой
        {
            rideId: rides[3].id,
            reviewerId: users[9].id,
            revieweeId: users[3].id,
            rating: 5,
            comment: 'Мария водит очень аккуратно, машина чистая, приятная музыка. Обязательно поеду еще!'
        },
        // Отзыв 3 для Артёма Соколова (водитель поездки 5) от Анны Морозовой
        {
            rideId: rides[4].id,
            reviewerId: users[5].id,
            revieweeId: users[4].id,
            rating: 5,
            comment: 'Очень выручил с утренней поездкой в аэропорт, помог с тяжелым чемоданом. Доехали быстро и комфортно!'
        }
    ];

    for (const r of reviewsData) {
        await client.query(
            `INSERT INTO reviews (ride_id, reviewer_id, reviewee_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5)`,
            [r.rideId, r.reviewerId, r.revieweeId, r.rating, r.comment]
        );
    }

    // Пересчет и обновление среднего рейтинга водителей в таблице users
    await client.query(`
        UPDATE users u
        SET rating = sub.avg_rating
        FROM (
            SELECT reviewee_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating
            FROM reviews
            GROUP BY reviewee_id
        ) sub
        WHERE u.id = sub.reviewee_id;
    `);

    console.log(`   Создано ${reviewsData.length} отзывов и пересчитаны рейтинги водителей.`);
}

/**
 * Основная точка входа для сброса и наполнения базы данных
 */
async function reseed() {
    console.log('=== ЗАПУСК ПОЛНОЙ ОЧИСТКИ И ПЕРЕНАПОЛНЕНИЯ БД (RESEED) ===\n');
    const client = await pool.connect();
    try {
        await resetDatabase(client);
        const users = await seedUsers(client);
        const vehicles = await seedVehicles(client, users);
        const rides = await seedRides(client, users, vehicles);
        await seedMatches(client, rides, users);
        await seedReviews(client, rides, users);

        console.log('\n=== БАЗА ДАННЫХ УСПЕШНО ОЧИЩЕНА И НАПОЛНЕНА НОВЫМИ ДАННЫМИ! ===');
    } catch (err) {
        console.error('Ошибка при выполнении reseed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    reseed();
}

module.exports = reseed;
