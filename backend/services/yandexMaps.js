const pool = require('../db');

// Ключи локаций Екатеринбурга по умолчанию (долгота lon, широта lat)
const KNOWN_LOCATIONS = {
    'уралмаш': { lon: 60.5975, lat: 56.8885, name: 'Екатеринбург, район Уралмаш' },
    'новокольцовский': { lon: 60.7712, lat: 56.7686, name: 'Екатеринбург, Кампус Новокольцовский' },
    'центр': { lon: 60.6057, lat: 56.8389, name: 'Екатеринбург, Центр' },
    'урфу': { lon: 60.6534, lat: 56.8439, name: 'Екатеринбург, Главный корпус УрФУ (Мира 19)' },
    'мира': { lon: 60.6534, lat: 56.8439, name: 'Екатеринбург, улица Мира, 19' },
    'втузгородок': { lon: 60.6530, lat: 56.8430, name: 'Екатеринбург, Втузгородок' },
    'академический': { lon: 60.5186, lat: 56.7865, name: 'Екатеринбург, Академический' },
    'жби': { lon: 60.6860, lat: 56.8285, name: 'Екатеринбург, ЖБИ' }
};

const DEFAULT_COORDS = { lon: 60.6057, lat: 56.8389, name: 'Екатеринбург' };
const REQUEST_TIMEOUT_MS = 3000;

/**
 * Выполнение HTTP-запроса с тайм-аутом
 * @param {string} url - URL ресурса
 * @param {number} [timeoutMs=REQUEST_TIMEOUT_MS] - Таймаут в мс
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeoutMs = REQUEST_TIMEOUT_MS) {
    return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * Получение закэшированных координат адреса из БД
 * @param {string} query - Поисковая строка адреса
 * @returns {Promise<{ longitude: number, latitude: number, full_address: string } | null>}
 */
async function getFromGeocodeCache(query) {
    if (!query || typeof query !== 'string') {
        return null;
    }
    const normalized = query.trim().toLowerCase();
    const sql = `
        SELECT longitude, latitude, full_address 
        FROM geocode_cache 
        WHERE LOWER(address_query) = $1 
        ORDER BY created_at DESC 
        LIMIT 1
    `;
    const res = await pool.query(sql, [normalized]);
    if (res.rows.length === 0) {
        return null;
    }
    const row = res.rows[0];
    return {
        longitude: Number(row.longitude),
        latitude: Number(row.latitude),
        full_address: row.full_address
    };
}

/**
 * Сохранение координат адреса в кэш БД
 * @param {string} query - Поисковая строка адреса
 * @param {number} longitude - Долгота
 * @param {number} latitude - Широта
 * @param {string} fullAddress - Полный стандартизированный адрес
 */
async function saveToGeocodeCache(query, longitude, latitude, fullAddress) {
    if (!query || longitude === undefined || latitude === undefined) {
        return;
    }
    try {
        const sql = `
            INSERT INTO geocode_cache (address_query, longitude, latitude, full_address)
            VALUES ($1, $2, $3, $4)
        `;
        await pool.query(sql, [query.trim().toLowerCase(), longitude, latitude, fullAddress]);
    } catch (err) {
        // Ошибки кэширования не должны прерывать основной бизнес-процесс
        console.warn('Предупреждение: не удалось сохранить адрес в geocode_cache:', err.message);
    }
}

/**
 * Поиск локации по словарю известных ориентиров Екатеринбурга
 * @param {string} address - Строка адреса
 * @returns {{ lon: number, lat: number, name: string } | null}
 */
function findInKnownLocations(address) {
    if (!address || typeof address !== 'string') {
        return null;
    }
    const lower = address.toLowerCase().trim();
    for (const [key, value] of Object.entries(KNOWN_LOCATIONS)) {
        if (lower.includes(key)) {
            return value;
        }
    }
    return null;
}

/**
 * Парсинг строки вида "56.8439, 60.6534" в координаты
 * @param {string} str - Строка с координатами
 * @returns {{ lat: number, lon: number } | null}
 */
function parseCoordinatePair(str) {
    if (!str || typeof str !== 'string') {
        return null;
    }
    const match = str.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) {
        return null;
    }
    const first = parseFloat(match[1]);
    const second = parseFloat(match[2]);
    if (isNaN(first) || isNaN(second)) {
        return null;
    }
    // Если первый компонент в пределах широты РФ (40-80), считаем его lat
    if (first >= -90 && first <= 90 && second >= -180 && second <= 180) {
        return { lat: first, lon: second };
    }
    return null;
}

/**
 * Расчет расстояния по формуле гаверсинусов в метрах
 * @param {number} lat1 - Широта 1
 * @param {number} lon1 - Долгота 1
 * @param {number} lat2 - Широта 2
 * @param {number} lon2 - Долгота 2
 * @returns {number} Расстояние в метрах
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const earthRadiusMeters = 6371000;
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
}

/**
 * Определение часа пик по времени Екатеринбурга (07:30-09:30 и 17:00-19:00)
 * @param {Date|string} [dateInput] - Дата и время отправления
 * @returns {boolean}
 */
function isPeakHour(dateInput) {
    const date = dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date());
    if (isNaN(date.getTime())) {
        return false;
    }
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: process.env.APP_TIMEZONE || 'Asia/Yekaterinburg',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    const totalMinutes = hour * 60 + minute;
    const isMorning = totalMinutes >= 450 && totalMinutes <= 570;
    const isEvening = totalMinutes >= 1020 && totalMinutes <= 1140;
    return isMorning || isEvening;
}

/**
 * Прямое геокодирование адреса в координаты через Yandex Geocoder API с кэшированием в geocode_cache
 * @param {string} address - Строка адреса
 * @returns {Promise<{ longitude: number, latitude: number, full_address: string }>}
 */
async function geocodeAddress(address) {
    if (!address) {
        return { longitude: DEFAULT_COORDS.lon, latitude: DEFAULT_COORDS.lat, full_address: DEFAULT_COORDS.name };
    }

    // 1. Проверка наличия в кэше базы данных
    const cached = await getFromGeocodeCache(address);
    if (cached) {
        return cached;
    }

    // 2. Попытка парсинга, если переданы координаты строкой
    const parsedCoords = parseCoordinatePair(address);
    if (parsedCoords) {
        return { longitude: parsedCoords.lon, latitude: parsedCoords.lat, full_address: address };
    }

    // 3. Запрос к Yandex Geocoder API
    const apiKey = process.env.YANDEX_MAPS_API_KEY;
    if (apiKey) {
        try {
            const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(address)}&format=json&results=1`;
            const response = await fetchWithTimeout(url);
            if (response.ok) {
                const data = await response.json();
                const geoObject = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
                if (geoObject) {
                    const pos = geoObject.Point?.pos?.split(' ');
                    const fullAddress = geoObject.metaDataProperty?.GeocoderMetaData?.text || geoObject.name || address;
                    if (pos && pos.length === 2) {
                        const lon = parseFloat(pos[0]);
                        const lat = parseFloat(pos[1]);
                        await saveToGeocodeCache(address, lon, lat, fullAddress);
                        return { longitude: lon, latitude: lat, full_address: fullAddress };
                    }
                }
            }
        } catch (err) {
            console.warn('Предупреждение: ошибка обращения к Yandex Geocoder:', err.message);
        }
    }

    // 4. Резервный поиск по известным локациям
    const known = findInKnownLocations(address);
    if (known) {
        await saveToGeocodeCache(address, known.lon, known.lat, known.name);
        return { longitude: known.lon, latitude: known.lat, full_address: known.name };
    }

    return { longitude: DEFAULT_COORDS.lon, latitude: DEFAULT_COORDS.lat, full_address: address };
}

/**
 * Обратное геокодирование: определение адреса по координатам (широта, долгота)
 * @param {number} latitude - Широта
 * @param {number} longitude - Долгота
 * @returns {Promise<{ full_address: string, address: string, latitude: number, longitude: number }>}
 */
async function reverseGeocode(latitude, longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    const defaultText = `Екатеринбург (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

    const apiKey = process.env.YANDEX_MAPS_API_KEY;
    if (apiKey) {
        try {
            const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${lon},${lat}&format=json&results=1`;
            const response = await fetchWithTimeout(url);
            if (response.ok) {
                const data = await response.json();
                const geoObject = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
                if (geoObject) {
                    const fullAddress = geoObject.metaDataProperty?.GeocoderMetaData?.text || geoObject.name || defaultText;
                    return { full_address: fullAddress, address: fullAddress, latitude: lat, longitude: lon };
                }
            }
        } catch (err) {
            console.warn('Предупреждение: ошибка обратного геокодирования Yandex:', err.message);
        }
    }

    return { full_address: defaultText, address: defaultText, latitude: lat, longitude: lon };
}

/**
 * Получение подсказок адресов через Yandex Suggest API с резервным локальным поиском
 * @param {string} query - Поисковая подстрока
 * @returns {Promise<Array<{ title: string, subtitle: string, full_address: string, address: string }>>}
 */
async function suggestAddress(query) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return [];
    }

    const trimmed = query.trim();
    const apiKey = process.env.YANDEX_SUGGEST_API_KEY;
    if (apiKey) {
        try {
            const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${apiKey}&text=${encodeURIComponent(trimmed)}&lang=ru_RU`;
            const response = await fetchWithTimeout(url);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data?.results) && data.results.length > 0) {
                    return data.results.map((item) => {
                        const full = item.address?.formatted_address || item.title?.text || trimmed;
                        return {
                            title: item.title?.text || trimmed,
                            subtitle: item.subtitle?.text || '',
                            full_address: full,
                            address: full
                        };
                    });
                }
            }
        } catch (err) {
            console.warn('Предупреждение: ошибка Yandex Suggest API:', err.message);
        }
    }

    // Резервный поиск по известным локациям
    const lower = trimmed.toLowerCase();
    const suggestions = [];
    for (const loc of Object.values(KNOWN_LOCATIONS)) {
        if (loc.name.toLowerCase().includes(lower)) {
            suggestions.push({
                title: loc.name,
                subtitle: 'Екатеринбург',
                full_address: loc.name,
                address: loc.name
            });
        }
    }
    return suggestions;
}

/**
 * Построение маршрута между двумя точками через Yandex Router API с резервным математическим расчетом
 * @param {{ lat?: number, lon?: number, latitude?: number, longitude?: number }} startCoords - Начальные координаты
 * @param {{ lat?: number, lon?: number, latitude?: number, longitude?: number }} endCoords - Конечные координаты
 * @returns {Promise<{ distance_meters: number, duration_seconds: number, distance_km: number, duration_minutes: number, route_polyline: object }>}
 */
async function buildRoute(startCoords, endCoords) {
    const startLat = Number(startCoords?.lat ?? startCoords?.latitude ?? DEFAULT_COORDS.lat);
    const startLon = Number(startCoords?.lon ?? startCoords?.longitude ?? DEFAULT_COORDS.lon);
    const endLat = Number(endCoords?.lat ?? endCoords?.latitude ?? DEFAULT_COORDS.lat);
    const endLon = Number(endCoords?.lon ?? endCoords?.longitude ?? DEFAULT_COORDS.lon);

    const apiKey = process.env.YANDEX_ROUTER_API_KEY;
    if (apiKey) {
        try {
            const url = `https://api.routing.yandex.net/v2/route?waypoints=${startLat},${startLon}|${endLat},${endLon}&apikey=${apiKey}&mode=driving`;
            const response = await fetchWithTimeout(url);
            if (response.ok) {
                const data = await response.json();
                const route = data?.route;
                if (route) {
                    const meters = Math.round(route.summary?.length ?? route.legs?.[0]?.length ?? 0);
                    const seconds = Math.round(route.summary?.duration?.value ?? route.summary?.duration ?? 0);
                    return {
                        distance_meters: meters,
                        duration_seconds: seconds,
                        distance_km: Math.round((meters / 1000) * 100) / 100,
                        duration_minutes: Math.round(seconds / 60),
                        route_polyline: route.geometry || {
                            type: 'LineString',
                            coordinates: [[startLon, startLat], [endLon, endLat]]
                        }
                    };
                }
            }
        } catch (err) {
            console.warn('Предупреждение: ошибка Yandex Router API:', err.message);
        }
    }

    // Резервный расчет дистанции и длительности
    const meters = Math.round(calculateHaversineDistance(startLat, startLon, endLat, endLon));
    // Средняя скорость в городе: 10 м/с (36 км/ч), минимальная длительность 5 минут (300с)
    const seconds = Math.max(300, Math.round(meters / 10));

    return {
        distance_meters: meters,
        duration_seconds: seconds,
        distance_km: Math.round((meters / 1000) * 100) / 100,
        duration_minutes: Math.round(seconds / 60),
        route_polyline: {
            type: 'LineString',
            coordinates: [
                [startLon, startLat],
                [endLon, endLat]
            ]
        }
    };
}

/**
 * Расчет рекомендуемой цены поездки по расстоянию, длительности и коэффициенту часа пик
 * @param {number} distanceMeters - Дистанция в метрах
 * @param {number} [durationSeconds=0] - Длительность в секундах
 * @param {Date|string} [departureTime] - Время отправления
 * @returns {{ base_price: number, price: number, distance_km: number, duration_minutes: number, is_peak: boolean }}
 */
function calculateTripPrice(distanceMeters, durationSeconds = 0, departureTime = null) {
    const distanceKm = Math.round((Number(distanceMeters || 0) / 1000) * 100) / 100;
    const isPeak = isPeakHour(departureTime);
    const ratePerKm = 6;
    const peakMultiplier = isPeak ? 1.3 : 1.0;
    const rawPrice = distanceKm * ratePerKm * peakMultiplier;
    // Округляем рекомендуемую цену до кратного 5 (минимум 5 руб., если дистанция > 0)
    const basePrice = rawPrice > 0 ? Math.max(5, Math.round(rawPrice / 5) * 5) : 0;
    const durationMinutes = Math.round(Number(durationSeconds || 0) / 60);

    return {
        base_price: basePrice,
        price: basePrice,
        distance_km: distanceKm,
        duration_minutes: durationMinutes,
        is_peak: isPeak
    };
}

module.exports = {
    geocodeAddress,
    reverseGeocode,
    suggestAddress,
    buildRoute,
    calculateTripPrice,
    isPeakHour,
    getFromGeocodeCache,
    saveToGeocodeCache
};
