/**
 * Скрипт тестирования связки: Поиск организаций -> Геокодер -> Маршрутизатор Яндекса
 */
require('dotenv').config();
const yandexMaps = require('./services/yandexMaps');
const pool = require('./db');

/**
 * Основная функция выполнения теста маршрутизации
 */
async function runRouteTest() {
    console.log('=== Запуск тестирования Яндекс Карт и маршрутизации ===\n');

    try {
        // 1. Геокодирование начальной точки ("Гринвич")
        console.log('1. Геокодирование точки отправления: "Гринвич"...');
        const startResult = await yandexMaps.geocodeAddress('Гринвич');
        console.log(`   Найденный адрес: ${startResult.full_address}`);
        console.log(`   Координаты: широта=${startResult.latitude}, долгота=${startResult.longitude}\n`);

        // 2. Геокодирование конечной точки ("Кампус Новокольцовский")
        console.log('2. Геокодирование точки назначения: "Кампус Новокольцовский"...');
        const endResult = await yandexMaps.geocodeAddress('Кампус Новокольцовский');
        console.log(`   Найденный адрес: ${endResult.full_address}`);
        console.log(`   Координаты: широта=${endResult.latitude}, долгота=${endResult.longitude}\n`);

        // 3. Построение маршрута между полученными координатами
        const startCoords = { lat: startResult.latitude, lon: startResult.longitude };
        const endCoords = { lat: endResult.latitude, lon: endResult.longitude };

        console.log('3. Запрос маршрута через yandexMaps.getRouteInfo...');
        const routeInfo = await yandexMaps.getRouteInfo(startCoords, endCoords);

        console.log('--------------------------------------------------');
        console.log('Результаты построения маршрута:');
        console.log(`- Адрес отправления: ${startResult.full_address}`);
        console.log(`- Адрес назначения: ${endResult.full_address}`);
        console.log(`- Дистанция (distance_km): ${routeInfo.distance_km} км`);
        console.log(`- Продолжительность (duration_min): ${routeInfo.duration_min} мин`);
        console.log(`- Дистанция в метрах: ${routeInfo.distance_meters} м`);
        console.log(`- Длительность в секундах: ${routeInfo.duration_seconds} с`);
        if (routeInfo.route_polyline && routeInfo.route_polyline.coordinates) {
            console.log(`- Количество точек в полилинии: ${routeInfo.route_polyline.coordinates.length}`);
        }
        console.log('--------------------------------------------------');
        console.log('\n=== Тестирование успешно завершено! ===');
    } catch (error) {
        console.error('Ошибка при выполнении тестирования маршрутизации:', error);
    } finally {
        // Закрытие пула соединений БД для корректного завершения процесса
        try {
            await pool.end();
        } catch (dbErr) {
            // Игнорируем ошибки при закрытии пула
        }
    }
}

runRouteTest();
