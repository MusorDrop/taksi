const app = require('./index');
const pool = require('./db');

async function runSmokeTests() {
    console.log('=== ЗАПУСК SMOKE TEST (ДЫМОВОЕ ТЕСТИРОВАНИЕ) ===\n');
    let hasErrors = false;
    const testResults = [];

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

    } finally {
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
