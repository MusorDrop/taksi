const app = require('./index');
const pool = require('./db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/authMiddleware');

async function runSmokeTests() {
    console.log('=== ЗАПУСК SMOKE TEST (ДЫМОВОЕ ТЕСТИРОВАНИЕ) ===\n');
    let hasErrors = false;
    const testResults = [];
    let createdDriverId = null;
    let createdRideId = null;

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
            // Выполняем 10 обычных запросов подряд к /api/health и /api/rides
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
            // Очищаем предыдущие данные тестового водителя, если они остались
            await pool.query("DELETE FROM rides WHERE driver_id IN (SELECT id FROM users WHERE username = 'smoke_test_driver')");
            await pool.query("DELETE FROM users WHERE username = 'smoke_test_driver'");

            // Создаем временного тестового водителя
            const driverInsert = await pool.query(`
                INSERT INTO users (username, password_hash, first_name, last_name, role)
                VALUES ('smoke_test_driver', '$2a$10$dummyhashfortestusersmoke000000000000000000000000000000', 'ТестВодитель', 'Дымовой', 'driver')
                RETURNING id, username, role
            `);
            createdDriverId = driverInsert.rows[0].id;

            const driverToken = jwt.sign(
                { id: createdDriverId, username: 'smoke_test_driver', role: 'driver' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Создаем поездку БЕЗ передачи base_price или price
            const res = await fetch(`${baseUrl}/api/rides`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${driverToken}`
                },
                body: JSON.stringify({
                    start_point: { lat: 56.8885, lon: 60.5975 }, // Уралмаш
                    end_point: { lat: 56.7686, lon: 60.7712 },   // Кампус Новокольцовский
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
            console.log(`Рассчитанная стоимость: ${price} руб (Ожидалось: ~127-128 руб)`);
            console.log(`Пиковый коэффициент (isPeak): ${ride?.isPeak ?? ride?.is_peak}`);
            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при создании поездки без цены:', err.message);
            testResults.push({ test: 'POST /api/rides without base_price', passed: false, error: err.message });
            hasErrors = true;
        }

        // Тест 7: Гео-поиск поездок по координатам и радиусу (GET /api/rides?start_lat=...&start_lon=...&end_lat=...&end_lon=...&radius=1000)
        console.log('\n--- Тест 7: GET /api/rides с гео-фильтрами (координаты и радиус) ---');
        try {
            // Запрос с совпадающими координатами и радиусом 1000м
            const matchingUrl = `${baseUrl}/api/rides?start_lat=56.8885&start_lon=60.5975&end_lat=56.7686&end_lon=60.7712&radius=1000`;
            const matchRes = await fetch(matchingUrl);
            const matchStatus = matchRes.status;
            const matchData = await matchRes.json();

            const foundCreatedRide = Array.isArray(matchData.rides) &&
                                     matchData.rides.some((r) => r.id === createdRideId);

            // Запрос с далекими координатами (проверка корректной фильтрации PostGIS)
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
                passed: pass,
                details: {
                    matchedCount: matchData.count,
                    foundTargetRide: foundCreatedRide,
                    nonMatchCount: nonMatchData.count,
                    correctlyExcluded: nonMatchExcluded
                }
            });

            console.log(`Поиск в радиусе 1000м: статус ${matchStatus}, найдено ${matchData.count}, целевая поездка найдена: ${foundCreatedRide}`);
            console.log(`Поиск по далеким координатам: статус ${nonMatchStatus}, найдено ${nonMatchData.count}, целевая поездка исключена: ${nonMatchExcluded}`);
            if (!pass) hasErrors = true;
        } catch (err) {
            console.error('Ошибка при гео-поиске поездок:', err.message);
            testResults.push({ test: 'GET /api/rides geo-search', passed: false, error: err.message });
            hasErrors = true;
        }

    } finally {
        // Очистка тестовых данных
        if (createdRideId) {
            try {
                await pool.query('DELETE FROM rides WHERE id = $1', [createdRideId]);
            } catch (_) {}
        }
        if (createdDriverId) {
            try {
                await pool.query('DELETE FROM users WHERE id = $1', [createdDriverId]);
            } catch (_) {}
        }

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
