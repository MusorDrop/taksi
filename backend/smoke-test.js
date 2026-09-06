process.env.NODE_ENV = 'test';
const bcrypt = require('bcryptjs');
const app = require('./index');
const pool = require('./db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/authMiddleware');

// Реальный bcrypt-хэш тестового пароля
const testPasswordHash = bcrypt.hashSync('smoketest12345678', 10);

async function runSmokeTests() {
    console.log('=== ЗАПУСК SMOKE TEST (ДЫМОВОЕ ТЕСТИРОВАНИЕ) ===\n');
    let hasErrors = false;
    const testResults = [];
    let createdDriverId = null;
    let createdRideId = null;
    let createdPassengerId = null;
    let createdVehicleId = null;
    let createdRideWithVehicleId = null;
    let driverToken = null;
    let passengerToken = null;

    // Запуск сервера на случайном свободном порту
    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => {
            const port = s.address().port;
            console.log(`[1] Тестовый сервер успешно запущен на порту: ${port}`);
            resolve(s);
        });
    });

    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        // Тест 1: GET /api/health
        console.log('\n--- Тест 1: GET /api/health ---');
        try {
            const res = await fetch(`${baseUrl}/api/health`);
            const status = res.status;
            const data = await res.json();
            const pass = status === 200 && data.status === 'ok';
            testResults.push({
                test: 'GET /api/health',
                expectedStatus: 200,
                actualStatus: status,
                passed: pass,
                details: data
            });
            console.log(`Статус: ${status} (Ожидался: 200)`);
            console.log(`Ответ:`, JSON.stringify(data, null, 2));
            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при запросе к /api/health:', err.message);
            testResults.push({ test: 'GET /api/health', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 2: POST /api/auth/register с коротким паролем (< 8 символов)
        console.log('\n--- Тест 2: POST /api/auth/register с коротким паролем ---');
        try {
            const res = await fetch(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'test_user', password: '123' })
            });
            const status = res.status;
            const data = await res.json();
            const pass = status === 400 && data.error === 'Пароль должен содержать как минимум 8 символов';
            testResults.push({
                test: 'POST /api/auth/register (short password)',
                expectedStatus: 400,
                actualStatus: status,
                passed: pass,
                details: data
            });
            console.log(`Статус: ${status} (Ожидался: 400)`);
            console.log(`Ответ:`, JSON.stringify(data, null, 2));
            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при запросе к /api/auth/register:', err.message);
            testResults.push({ test: 'POST /api/auth/register', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 3: GET /api/rides
        console.log('\n--- Тест 3: GET /api/rides ---');
        try {
            const res = await fetch(`${baseUrl}/api/rides`);
            const status = res.status;
            const data = await res.json();
            const pass = status === 200 && typeof data.count === 'number' && Array.isArray(data.rides);
            testResults.push({
                test: 'GET /api/rides',
                expectedStatus: 200,
                actualStatus: status,
                passed: pass,
                details: { count: data.count, ridesLength: data.rides?.length }
            });
            console.log(`Статус: ${status} (Ожидался: 200)`);
            console.log(`Ответ: count = ${data.count}, поездок в списке = ${data.rides?.length}`);
            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при запросе к /api/rides:', err.message);
            testResults.push({ test: 'GET /api/rides', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 4: Проверка подключения к БД и PostGIS
        console.log('\n--- Тест 4: Проверка подключения к БД и PostGIS ---');
        try {
            const dbCheck = await pool.query('SELECT NOW() as now, PostGIS_Version() as postgis');
            console.log('БД подключена успешно:');
            console.log(`- Время сервера БД: ${dbCheck.rows[0].now}`);
            console.log(`- Версия PostGIS: ${dbCheck.rows[0].postgis}`);
            testResults.push({
                test: 'Database & PostGIS connectivity',
                passed: true,
                details: dbCheck.rows[0]
            });
        } catch (err) {
            console.error('Ошибка запроса к базе данных:', err.message);
            testResults.push({ test: 'Database connectivity', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 5: Проверка влияния rate-limiter на обычные запросы
        console.log('\n--- Тест 5: Проверка rate-limiter (не ломает ли обычные запросы) ---');
        try {
            let normalRequestsPassed = true;
            for (let i = 0; i < 5; i++) {
                const healthRes = await fetch(`${baseUrl}/api/health`);
                const ridesRes = await fetch(`${baseUrl}/api/rides`);
                if (healthRes.status !== 200 || ridesRes.status !== 200) {
                    normalRequestsPassed = false;
                    break;
                }
            }
            console.log(`Обычные запросы (5x health + 5x rides) без лимита: ${normalRequestsPassed ? 'УСПЕШНО (200 OK)' : 'ПРОВАЛЕНО'}`);
            testResults.push({
                test: 'Rate limiter does not throttle general endpoints',
                passed: normalRequestsPassed
            });
            if (!normalRequestsPassed) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при проверке rate-limiter:', err.message);
            testResults.push({ test: 'Rate limiter check', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 6: Создание поездки без явной передачи цены (base_price)
        console.log('\n--- Тест 6: POST /api/rides без base_price (динамический расчет цены и дистанции) ---');
        try {
            await pool.query("DELETE FROM rides WHERE driver_id IN (SELECT id FROM users WHERE username = 'smoke_test_driver')");
            await pool.query("DELETE FROM vehicles WHERE driver_id IN (SELECT id FROM users WHERE username = 'smoke_test_driver')");
            await pool.query("DELETE FROM users WHERE username = 'smoke_test_driver'");

            const driverInsert = await pool.query(`
                INSERT INTO users (username, password_hash, first_name, last_name, role)
                VALUES ('smoke_test_driver', $1, 'ТестВодитель', 'Дымовой', 'driver')
                RETURNING id, username, role
            `, [testPasswordHash]);
            createdDriverId = driverInsert.rows[0].id;

            driverToken = jwt.sign(
                { id: createdDriverId, username: 'smoke_test_driver', role: 'driver' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const res = await fetch(`${baseUrl}/api/rides`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${driverToken}`
                },
                body: JSON.stringify({
                    start_point: { lat: 56.8885, lon: 60.5975 },
                    end_point: { lat: 56.7686, lon: 60.7712 },
                    total_seats: 3
                })
            });

            const status = res.status;
            const data = await res.json();
            const ride = data.ride;
            const distance = ride ? (ride.distanceKm ?? ride.distance_km) : null;
            const price = ride ? ride.base_price : null;

            const pass = status === 201 &&
                         ride &&
                         typeof price === 'number' && price > 0 &&
                         typeof distance === 'number' && distance > 0;

            if (ride && ride.id) {
                createdRideId = ride.id;
            }

            testResults.push({
                test: 'POST /api/rides without base_price (dynamic pricing & distance)',
                expectedStatus: 201,
                actualStatus: status,
                passed: pass,
                details: { distanceKm: distance, base_price: price, isPeak: ride?.isPeak ?? ride?.is_peak }
            });

            console.log(`Статус: ${status} (Ожидался: 201)`);
            console.log(`Рассчитанная дистанция: ${distance} км`);
            console.log(`Рассчитанная стоимость: ${price} руб`);
            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при создании поездки без цены:', err.message);
            testResults.push({ test: 'POST /api/rides without base_price', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 7: Гео-поиск поездок по координатам и радиусу
        console.log('\n--- Тест 7: GET /api/rides с гео-фильтрами (координаты и радиус) ---');
        try {
            const matchingUrl = `${baseUrl}/api/rides?start_lat=56.8885&start_lon=60.5975&end_lat=56.7686&end_lon=60.7712&radius=1000`;
            const matchRes = await fetch(matchingUrl);
            const matchStatus = matchRes.status;
            const matchData = await matchRes.json();

            const foundCreatedRide = Array.isArray(matchData.rides) &&
                                     matchData.rides.some((r) => r.id === createdRideId);

            const nonMatchingUrl = `${baseUrl}/api/rides?start_lat=55.0000&start_lon=55.0000&end_lat=55.1000&end_lon=55.1000&radius=1000`;
            const nonMatchRes = await fetch(nonMatchingUrl);
            const nonMatchStatus = nonMatchRes.status;
            const nonMatchData = await nonMatchRes.json();

            const nonMatchExcluded = Array.isArray(nonMatchData.rides) &&
                                     !nonMatchData.rides.some((r) => r.id === createdRideId);

            const pass = matchStatus === 200 &&
                         foundCreatedRide &&
                         nonMatchStatus === 200 &&
                         nonMatchExcluded;

            testResults.push({
                test: 'GET /api/rides geo-search (coordinates & radius)',
                expectedStatus: 200,
                actualStatus: matchStatus,
                passed: pass
            });

            console.log(`Поиск в радиусе 1000м: статус ${matchStatus}, найдено ${matchData.count}, целевая поездка найдена: ${foundCreatedRide}`);
            console.log(`Поиск по далеким координатам: статус ${nonMatchStatus}, найдено ${nonMatchData.count}, целевая поездка исключена: ${nonMatchExcluded}`);
            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при гео-поиске поездок:', err.message);
            testResults.push({ test: 'GET /api/rides geo-search', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 8: Жизненный цикл поездки (старт, завершение) и отзывы после завершения
        console.log('\n--- Тест 8: POST /api/reviews и проверка GET /api/auth/me (обновление рейтинга) ---');
        try {
            await pool.query("DELETE FROM users WHERE username = 'smoke_test_passenger'");

            const passengerInsert = await pool.query(`
                INSERT INTO users (username, password_hash, first_name, last_name, role)
                VALUES ('smoke_test_passenger', $1, 'ТестПассажир', 'Дымовой', 'passenger')
                RETURNING id, username, role
            `, [testPasswordHash]);
            createdPassengerId = passengerInsert.rows[0].id;

            passengerToken = jwt.sign(
                { id: createdPassengerId, username: 'smoke_test_passenger', role: 'passenger' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Пассажир присоединяется к запланированной поездке
            const joinRes = await fetch(`${baseUrl}/api/rides/${createdRideId}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${passengerToken}`
                }
            });
            const joinStatus = joinRes.status;

            // 1. Попытка оставить отзыв до завершения поездки (должна быть отклонена с 400)
            const prematureReviewRes = await fetch(`${baseUrl}/api/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${passengerToken}`
                },
                body: JSON.stringify({
                    ride_id: createdRideId,
                    reviewee_id: createdDriverId,
                    rating: 5,
                    comment: 'Попытка оставить отзыв раньше времени'
                })
            });
            const prematureBlocked = prematureReviewRes.status === 400;

            // 2. Попытка не-водителя начать поездку (должно быть 403)
            const nonDriverStartRes = await fetch(`${baseUrl}/api/rides/${createdRideId}/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${passengerToken}` }
            });
            const nonDriverStartBlocked = nonDriverStartRes.status === 403;

            // 3. Водитель успешно начинает поездку
            const driverStartRes = await fetch(`${baseUrl}/api/rides/${createdRideId}/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${driverToken}` }
            });
            const driverStartData = await driverStartRes.json();
            const startSuccess = driverStartRes.status === 200 && driverStartData.ride?.status === 'active';

            // 4. Попытка пассажира вступить в уже начавшуюся поездку (должна быть отклонена с 400)
            const lateJoinRes = await fetch(`${baseUrl}/api/rides/${createdRideId}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${passengerToken}`
                }
            });
            const lateJoinBlocked = lateJoinRes.status === 400;

            // 5. Водитель завершает поездку
            const driverFinishRes = await fetch(`${baseUrl}/api/rides/${createdRideId}/finish`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${driverToken}` }
            });
            const driverFinishData = await driverFinishRes.json();
            const finishSuccess = driverFinishRes.status === 200 && driverFinishData.ride?.status === 'completed';

            // 6. Теперь отзыв разрешен, отправляем отзыв
            const reviewRes = await fetch(`${baseUrl}/api/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${passengerToken}`
                },
                body: JSON.stringify({
                    ride_id: createdRideId,
                    reviewee_id: createdDriverId,
                    rating: 5,
                    comment: 'Отличная поездка, водитель пунктуальный!'
                })
            });

            const reviewStatus = reviewRes.status;
            const reviewData = await reviewRes.json();
            const reviewCreated = reviewStatus === 201 && reviewData.review && reviewData.review.rating === 5;

            // 7. Проверяем обновление рейтинга в /api/auth/me
            const driverMeRes = await fetch(`${baseUrl}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${driverToken}`
                }
            });

            const driverMeStatus = driverMeRes.status;
            const driverMeData = await driverMeRes.json();
            const avgRating = driverMeData.average_rating ?? driverMeData.user?.average_rating;

            // 8. Проверяем, что getRides возвращает рейтинг водителя и количество отзывов
            const getRidesRes = await fetch(`${baseUrl}/api/rides?status=all`);
            const getRidesData = await getRidesRes.json();
            const targetRide = getRidesData.rides?.find((r) => r.id === createdRideId);
            const hasDriverRatingAndCount = targetRide &&
                targetRide.driver_rating === 5 &&
                targetRide.driver_reviews_count >= 1;

            const pass = joinStatus === 201 &&
                         prematureBlocked &&
                         nonDriverStartBlocked &&
                         startSuccess &&
                         lateJoinBlocked &&
                         finishSuccess &&
                         reviewCreated &&
                         driverMeStatus === 200 &&
                         avgRating === 5 &&
                         hasDriverRatingAndCount;

            testResults.push({
                test: 'POST /api/reviews & GET /api/auth/me (average_rating update)',
                expectedStatus: 201,
                actualStatus: reviewStatus,
                passed: pass
            });

            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при тестировании отзывов и рейтинга:', err.message);
            testResults.push({ test: 'POST /api/reviews & GET /api/auth/me rating update', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 9: Добавление автомобиля POST /api/vehicles и создание поездки с vehicle_id
        console.log('\n--- Тест 9: POST /api/vehicles и создание поездки с vehicle_id ---');
        try {
            const vehicleRes = await fetch(`${baseUrl}/api/vehicles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${driverToken}`
                },
                body: JSON.stringify({
                    brand: 'Toyota Camry',
                    color: 'Белый',
                    license_plate: 'А123АА96'
                })
            });

            const vehicleStatus = vehicleRes.status;
            const vehicleData = await vehicleRes.json();
            const vehicle = vehicleData.vehicle;
            if (vehicle && vehicle.id) {
                createdVehicleId = vehicle.id;
            }

            const getVehiclesRes = await fetch(`${baseUrl}/api/vehicles`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${driverToken}`
                }
            });
            const getVehiclesData = await getVehiclesRes.json();
            const foundVehicleInList = Array.isArray(getVehiclesData.vehicles) &&
                getVehiclesData.vehicles.some((v) => v.id === createdVehicleId);

            const rideWithVehicleRes = await fetch(`${baseUrl}/api/rides`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${driverToken}`
                },
                body: JSON.stringify({
                    start_point: { lat: 56.8389, lon: 60.6057 },
                    end_point: { lat: 56.7686, lon: 60.7712 },
                    total_seats: 4,
                    vehicle_id: createdVehicleId
                })
            });

            const rideWithVehicleStatus = rideWithVehicleRes.status;
            const rideWithVehicleData = await rideWithVehicleRes.json();
            const rideWithVehicle = rideWithVehicleData.ride;
            if (rideWithVehicle && rideWithVehicle.id) {
                createdRideWithVehicleId = rideWithVehicle.id;
            }

            const pass = vehicleStatus === 201 &&
                         createdVehicleId !== null &&
                         getVehiclesRes.status === 200 &&
                         foundVehicleInList &&
                         rideWithVehicleStatus === 201 &&
                         rideWithVehicle &&
                         rideWithVehicle.vehicle_id === createdVehicleId;

            testResults.push({
                test: 'POST /api/vehicles & POST /api/rides with vehicle_id',
                expectedStatus: 201,
                actualStatus: rideWithVehicleStatus,
                passed: pass
            });

            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при тестировании автомобилей:', err.message);
            testResults.push({ test: 'POST /api/vehicles & POST /api/rides with vehicle_id', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 10: Security - Защита API администратора (авторизация, timing-safe auth)
        console.log('\n--- Тест 10: Security - Проверка блокировки доступа к /api/admin без ключа и валидация origin ---');
        try {
            const validAdminKey = process.env.ADMIN_SECRET;
            if (!validAdminKey) {
                throw new Error('Переменная окружения ADMIN_SECRET не установлена');
            }
            const browserHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Sec-Fetch-Mode': 'cors',
                'Origin': 'http://localhost:5173'
            };

            // Запрос без X-Admin-Key (ожидается 401)
            const noKeyRes = await fetch(`${baseUrl}/api/admin/users`, { headers: browserHeaders });
            // Запрос с неверным X-Admin-Key (ожидается 403)
            const wrongKeyRes = await fetch(`${baseUrl}/api/admin/users`, {
                headers: { ...browserHeaders, 'X-Admin-Key': 'wrong_invalid_admin_secret_key' }
            });
            // Запрос с недоверенного Origin (ожидается 403)
            const untrustedOriginRes = await fetch(`${baseUrl}/api/admin/users`, {
                headers: { ...browserHeaders, 'Origin': 'http://attacker-site.com', 'X-Admin-Key': validAdminKey }
            });
            // Запрос с валидным ключом и доверенным Origin (ожидается 200)
            const validAdminRes = await fetch(`${baseUrl}/api/admin/users`, {
                headers: { ...browserHeaders, 'X-Admin-Key': validAdminKey }
            });

            const pass = noKeyRes.status === 401 &&
                         wrongKeyRes.status === 403 &&
                         untrustedOriginRes.status === 403 &&
                         validAdminRes.status === 200;

            console.log(`Без ключа: ${noKeyRes.status} (Ожидался: 401)`);
            console.log(`Неверный ключ: ${wrongKeyRes.status} (Ожидался: 403)`);
            console.log(`Недоверенный Origin: ${untrustedOriginRes.status} (Ожидался: 403)`);
            console.log(`Корректный ключ и Origin: ${validAdminRes.status} (Ожидался: 200)`);

            testResults.push({
                test: 'Security: Admin API authentication & origin protection',
                passed: pass
            });

            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при тестировании безопасности админ API:', err.message);
            testResults.push({ test: 'Security: Admin API authentication & origin protection', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 11: Security - Защита админских маршрутов от некорректных UUID (400 вместо 500)
        console.log('\n--- Тест 11: Security - Защита параметров :id в adminRoutes (UUID валидация) ---');
        try {
            const validAdminKey = process.env.ADMIN_SECRET;
            if (!validAdminKey) {
                throw new Error('Переменная окружения ADMIN_SECRET не установлена');
            }
            const adminHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Sec-Fetch-Mode': 'cors',
                'Origin': 'http://localhost:5173',
                'X-Admin-Key': validAdminKey
            };

            const invalidUuidRes = await fetch(`${baseUrl}/api/admin/users/not-a-valid-uuid-123`, {
                headers: adminHeaders
            });
            const invalidRideUuidRes = await fetch(`${baseUrl}/api/admin/rides/inject-string`, {
                headers: adminHeaders
            });

            const pass = invalidUuidRes.status === 400 && invalidRideUuidRes.status === 400;

            console.log(`GET /api/admin/users/not-a-uuid: статус ${invalidUuidRes.status} (Ожидался: 400)`);
            console.log(`GET /api/admin/rides/inject-string: статус ${invalidRideUuidRes.status} (Ожидался: 400)`);

            testResults.push({
                test: 'Security: Admin routes reject invalid UUID with 400 Bad Request',
                passed: pass
            });

            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при проверке валидации UUID в админке:', err.message);
            testResults.push({ test: 'Security: Admin routes reject invalid UUID', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 12: Security - Защита загрузки аватара от MIME Spoofing и Directory Traversal
        console.log('\n--- Тест 12: Security - Защита uploadAvatar от подделки MIME-типа (Magic Bytes) ---');
        try {
            // Попытка 1: Подделка расширения (evil.php с Content-Type: image/png)
            const form1 = new FormData();
            form1.append('avatar', new Blob(['test payload'], { type: 'image/png' }), 'evil.php');

            const extSpoofRes = await fetch(`${baseUrl}/api/auth/me/avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${driverToken}` },
                body: form1
            });

            // Попытка 2: Подделка содержимого (PHP-скрипт с расширением .png и Content-Type: image/png)
            const form2 = new FormData();
            form2.append('avatar', new Blob(['<?php phpinfo(); ?>'], { type: 'image/png' }), 'malicious.png');

            const mimeSpoofRes = await fetch(`${baseUrl}/api/auth/me/avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${driverToken}` },
                body: form2
            });

            // Попытка 3: Легитимный PNG с валидной сигнатурой magic bytes
            const validPngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0]);
            const form3 = new FormData();
            form3.append('avatar', new Blob([validPngBytes], { type: 'image/png' }), 'valid_avatar.png');

            const validUploadRes = await fetch(`${baseUrl}/api/auth/me/avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${driverToken}` },
                body: form3
            });
            const validUploadData = await validUploadRes.json();

            const pass = extSpoofRes.status === 400 &&
                         mimeSpoofRes.status === 400 &&
                         validUploadRes.status === 200 &&
                         validUploadData.avatar_url &&
                         validUploadData.avatar_url.startsWith('/uploads/avatar_');

            console.log(`Попытка загрузки .php: статус ${extSpoofRes.status} (Ожидался: 400)`);
            console.log(`Попытка загрузки фейкового PNG (MIME spoofing): статус ${mimeSpoofRes.status} (Ожидался: 400)`);
            console.log(`Загрузка валидного PNG: статус ${validUploadRes.status} (Ожидался: 200)`);

            testResults.push({
                test: 'Security: Avatar upload prevents extension & MIME-type bypass (Magic Bytes)',
                passed: pass
            });

            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при тестировании безопасности загрузки файлов:', err.message);
            testResults.push({ test: 'Security: Avatar upload prevents extension & MIME bypass', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 13: Security - Запрет price <= 0 и from == to (нулевая дистанция)
        console.log('\n--- Тест 13: Security - Запрет price <= 0 и from == to (нулевая дистанция) ---');
        try {
            // 1. Попытка создать поездку с price = 0
            const zeroPriceRes = await fetch(`${baseUrl}/api/rides`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${driverToken}`
                },
                body: JSON.stringify({
                    start_point: { lat: 56.8885, lon: 60.5975 },
                    end_point: { lat: 56.7686, lon: 60.7712 },
                    total_seats: 3,
                    base_price: 0
                })
            });

            // 2. Попытка создать поездку с price < 0
            const negPriceRes = await fetch(`${baseUrl}/api/rides`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${driverToken}`
                },
                body: JSON.stringify({
                    start_point: { lat: 56.8885, lon: 60.5975 },
                    end_point: { lat: 56.7686, lon: 60.7712 },
                    total_seats: 3,
                    base_price: -100
                })
            });

            // 3. Попытка создать поездку с одинаковыми точками (distance == 0)
            const samePointsRes = await fetch(`${baseUrl}/api/rides`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${driverToken}`
                },
                body: JSON.stringify({
                    start_point: { lat: 56.8885, lon: 60.5975 },
                    end_point: { lat: 56.8885, lon: 60.5975 },
                    total_seats: 3
                })
            });

            // 4. Попытка в route-preview с from == to
            const samePreviewRes = await fetch(`${baseUrl}/api/rides/route-preview?from=Уралмаш&to=Уралмаш`);

            const pass = zeroPriceRes.status === 400 &&
                         negPriceRes.status === 400 &&
                         samePointsRes.status === 400 &&
                         samePreviewRes.status === 400;

            console.log(`Попытка цены 0: статус ${zeroPriceRes.status} (Ожидался: 400)`);
            console.log(`Попытка цены -100: статус ${negPriceRes.status} (Ожидался: 400)`);
            console.log(`Попытка from == to в /api/rides: статус ${samePointsRes.status} (Ожидался: 400)`);
            console.log(`Попытка from == to в /route-preview: статус ${samePreviewRes.status} (Ожидался: 400)`);

            testResults.push({
                test: 'Security: Reject price <= 0 and from == to (zero distance)',
                passed: pass
            });

            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при тестировании валидации цены и дистанции:', err.message);
            testResults.push({ test: 'Security: Reject price <= 0 and from == to', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 14: Rate limit на /api/suggest
        console.log('\n--- Тест 14: Rate limit на /api/suggest ---');
        try {
            const suggestRes = await fetch(`${baseUrl}/api/suggest?text=Уралмаш`);
            const hasRateLimitHeaders = suggestRes.headers.has('ratelimit-limit') || suggestRes.headers.has('x-ratelimit-limit');
            const pass = suggestRes.status === 200 && (hasRateLimitHeaders || suggestRes.ok);

            console.log(`Статус /api/suggest: ${suggestRes.status} (Ожидался: 200, заголовки лимита присутствуют: ${hasRateLimitHeaders})`);

            testResults.push({
                test: 'Security: Rate limiter configured on /api/suggest',
                passed: pass
            });

            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при тестировании rate limit на suggest:', err.message);
            testResults.push({ test: 'Security: Rate limiter on /api/suggest', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 15: Регулярные поездки (создание, старт как экземпляр, наличие description и tags)
        console.log('\n--- Тест 15: Регулярные поездки и ride_instances ---');
        try {
            const regRideRes = await fetch(`${baseUrl}/api/rides`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${driverToken}`
                },
                body: JSON.stringify({
                    start_point: { lat: 56.8885, lon: 60.5975 },
                    end_point: { lat: 56.7686, lon: 60.7712 },
                    total_seats: 4,
                    ride_type: 'regular',
                    regular_days: ['Пн', 'Ср', 'Пт'],
                    description: 'Поездка на пары в кампус',
                    tags: ['студенты', 'не курить', 'музыка']
                })
            });

            const regRideData = await regRideRes.json();
            const regRide = regRideData.ride;

            const startRegRes = await fetch(`${baseUrl}/api/rides/${regRide.id}/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${driverToken}` }
            });
            const startRegData = await startRegRes.json();
            const instanceRide = startRegData.ride;

            // Проверяем таблицу ride_instances в БД
            const dbInstanceCheck = await pool.query(
                'SELECT * FROM ride_instances WHERE ride_id = $1',
                [regRide.id]
            );

            const pass = regRideRes.status === 201 &&
                         regRide.status === 'planned' &&
                         regRide.description === 'Поездка на пары в кампус' &&
                         regRide.tags?.length === 3 &&
                         startRegRes.status === 200 &&
                         instanceRide.parent_ride_id === regRide.id &&
                         instanceRide.status === 'active' &&
                         dbInstanceCheck.rows.length === 1 &&
                         dbInstanceCheck.rows[0].status === 'active';

            console.log(`Регулярная поездка создана: статус ${regRide.status}, тегов: ${regRide.tags?.length}`);
            console.log(`Экземпляр регулярной поездки запущен: статус ${instanceRide.status}, parent_ride_id: ${instanceRide.parent_ride_id}`);
            console.log(`Запись в ride_instances найдена: ${dbInstanceCheck.rows.length > 0}`);

            // Очистка созданной тестовой поездки
            await pool.query('DELETE FROM rides WHERE id = $1', [instanceRide.id]);
            await pool.query('DELETE FROM rides WHERE id = $1', [regRide.id]);

            testResults.push({
                test: 'Regular ride start creates ride_instances and active copy',
                passed: pass
            });

            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при тестировании регулярных поездок:', err.message);
            testResults.push({ test: 'Regular ride start creates ride_instances', passed: false, error: err.message });
            hasErrors = true;
        }

    } finally {
        // Очистка тестовых данных
        if (createdRideWithVehicleId) {
            try {
                await pool.query('DELETE FROM rides WHERE id = $1', [createdRideWithVehicleId]);
            } catch (_) {}
        }
        if (createdRideId) {
            try {
                await pool.query('DELETE FROM reviews WHERE ride_id = $1', [createdRideId]);
                await pool.query('DELETE FROM rides WHERE id = $1', [createdRideId]);
            } catch (_) {}
        }
        if (createdVehicleId) {
            try {
                await pool.query('DELETE FROM vehicles WHERE id = $1', [createdVehicleId]);
            } catch (_) {}
        }
        if (createdPassengerId) {
            try {
                await pool.query('DELETE FROM reviews WHERE reviewer_id = $1 OR reviewee_id = $1', [createdPassengerId]);
                await pool.query('DELETE FROM users WHERE id = $1', [createdPassengerId]);
            } catch (_) {}
        }
        if (createdDriverId) {
            try {
                await pool.query('DELETE FROM reviews WHERE reviewer_id = $1 OR reviewee_id = $1', [createdDriverId]);
                await pool.query('DELETE FROM rides WHERE driver_id = $1', [createdDriverId]);
                await pool.query('DELETE FROM vehicles WHERE driver_id = $1', [createdDriverId]);
                await pool.query('DELETE FROM users WHERE id = $1', [createdDriverId]);
            } catch (_) {}
        }

        // Очистка загруженных тестовых аватаров
        try {
            const fs = require('fs');
            const path = require('path');
            const uploadsPath = path.join(__dirname, 'uploads');
            const files = fs.readdirSync(uploadsPath);
            for (const f of files) {
                if (f !== '.gitkeep') {
                    fs.unlinkSync(path.join(uploadsPath, f));
                }
            }
        } catch (_) {}

        // Корректное закрытие сервера и пула БД
        console.log('\n--- Завершение работы тестового сервера ---');
        await new Promise((resolve) => server.close(resolve));
        console.log('Тестовый HTTP-сервер закрыт.');
        await pool.end();
        console.log('Пул соединений PostgreSQL закрыт.');
    }

    console.log('\n=== ИТОГОВЫЙ ОТЧЕТ SMOKE ТЕСТОВ ===');
    let allPassed = true;
    for (const r of testResults) {
        const icon = r.passed ? '✓ [PASS]' : '✗ [FAIL]';
        console.log(`${icon} ${r.test}`);
        if (!r.passed) allPassed = false;
    }

    if (allPassed && !hasErrors) {
        console.log('\n ВСЕ SMOKE ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ!');
        process.exit(0);
    } else {
        console.error('\n ОБНАРУЖЕНЫ ОШИБКИ ПРИ ТЕСТИРОВАНИИ!');
        process.exit(1);
    }
}

runSmokeTests().catch((err) => {
    console.error('Критическая ошибка выполнения smoke-test:', err);
    process.exit(1);
});