const pool = require('../db');

const {
    EKATERINBURG_BOUNDS,
    KNOWN_LOCATIONS,
    DEFAULT_COORDS
} = require('../utils/locations');

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
            ON CONFLICT (address_query) DO UPDATE
            SET longitude = EXCLUDED.longitude,
                latitude = EXCLUDED.latitude,
                full_address = EXCLUDED.full_address,
                created_at = CURRENT_TIMESTAMP
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
 * Добавление префикса "Екатеринбург, ", если в запрашиваемом адресе нет этого слова
 * @param {string} address - Исходный адрес
 * @returns {string}
 */
function ensureEkaterinburgPrefix(address) {
    if (!address || typeof address !== 'string') {
        return address;
    }
    const trimmed = address.trim();
    if (!trimmed) {
        return trimmed;
    }
    // Если переданы координаты строкой (например, "56.8439, 60.6534"), префикс не добавляем
    if (/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.test(trimmed)) {
        return trimmed;
    }
    // Если в строке уже присутствует слово "Екатеринбург" (без учета регистра), возвращаем как есть
    if (/екатеринбург/i.test(trimmed)) {
        return trimmed;
    }
    return `Екатеринбург, ${trimmed}`;
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

    // 1. Попытка парсинга, если переданы координаты строкой
    const parsedCoords = parseCoordinatePair(address);
    if (parsedCoords) {
        return { longitude: parsedCoords.lon, latitude: parsedCoords.lat, full_address: address };
    }

    // Добавляем префикс "Екатеринбург, ", если в запрашиваемом адресе нет этого слова
    const targetAddress = ensureEkaterinburgPrefix(address);

    // 2. Проверка наличия в кэше базы данных (проверяем оба варианта)
    const cached = (await getFromGeocodeCache(targetAddress)) || (await getFromGeocodeCache(address));
    if (cached) {
        return cached;
    }

    // 3. Запрос к Yandex Geocoder API
    const apiKey = process.env.YANDEX_MAPS_API_KEY;
    if (apiKey) {
        try {
            const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(targetAddress)}&format=json&results=1&bbox=${EKATERINBURG_BOUNDS.bbox}&rspn=1`;
            const response = await fetchWithTimeout(url);
            if (response.ok) {
                const data = await response.json();
                const geoObject = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
                if (geoObject) {
                    const pos = geoObject.Point?.pos?.split(' ');
                    const fullAddress = geoObject.metaDataProperty?.GeocoderMetaData?.text || geoObject.name || targetAddress;
                    if (pos && pos.length === 2) {
                        const lon = parseFloat(pos[0]);
                        const lat = parseFloat(pos[1]);
                        await saveToGeocodeCache(targetAddress, lon, lat, fullAddress);
                        if (targetAddress !== address) {
                            await saveToGeocodeCache(address, lon, lat, fullAddress);
                        }
                        return { longitude: lon, latitude: lat, full_address: fullAddress };
                    }
                }
            }
        } catch (err) {
            console.warn('Предупреждение: ошибка обращения к Yandex Geocoder:', err.message);
        }
    }

    // 4. Резервный поиск по известным локациям
    const known = findInKnownLocations(targetAddress) || findInKnownLocations(address);
    if (known) {
        await saveToGeocodeCache(targetAddress, known.lon, known.lat, known.name);
        if (targetAddress !== address) {
            await saveToGeocodeCache(address, known.lon, known.lat, known.name);
        }
        return { longitude: known.lon, latitude: known.lat, full_address: known.name };
    }

    return { longitude: DEFAULT_COORDS.lon, latitude: DEFAULT_COORDS.lat, full_address: targetAddress };
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
 * Преобразование параметра boundedBy в строку bbox (lon1,lat1~lon2,lat2)
 * @param {string|Array} [boundedBy] - Входные границы
 * @returns {string} Строка bbox для Yandex API
 */
function resolveSuggestBbox(boundedBy) {
    if (!boundedBy) {
        return EKATERINBURG_BOUNDS.bbox;
    }
    if (typeof boundedBy === 'string') {
        const trimmed = boundedBy.trim();
        if (trimmed.includes('~')) {
            return trimmed;
        }
        const parts = trimmed.split(',').map((p) => parseFloat(p.trim())).filter((n) => !isNaN(n));
        if (parts.length === 4) {
            if (parts[0] >= 50 && parts[0] <= 60) {
                const [lat1, lon1, lat2, lon2] = parts;
                return `${lon1},${lat1}~${lon2},${lat2}`;
            }
            const [lon1, lat1, lon2, lat2] = parts;
            return `${lon1},${lat1}~${lon2},${lat2}`;
        }
    }
    if (Array.isArray(boundedBy) && boundedBy.length === 2) {
        const [pt1, pt2] = boundedBy;
        if (Array.isArray(pt1) && Array.isArray(pt2) && pt1.length >= 2 && pt2.length >= 2) {
            const [lat1, lon1] = pt1;
            const [lat2, lon2] = pt2;
            return `${lon1},${lat1}~${lon2},${lat2}`;
        }
    }
    return EKATERINBURG_BOUNDS.bbox;
}

/**
 * Получение подсказок адресов через Yandex Suggest API с жесткими границами Екатеринбурга и резервным поиском
 * @param {string} query - Поисковая подстрока
 * @param {string|Array} [boundedBy] - Границы поиска (по умолчанию Екатеринбург)
 * @returns {Promise<Array<{ title: string, subtitle: string, full_address: string, address: string }>>}
 */
async function suggestAddress(query, boundedBy) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return [];
    }

    const trimmed = query.trim();
    const bbox = resolveSuggestBbox(boundedBy);
    const apiKey = process.env.YANDEX_SUGGEST_API_KEY;

    if (apiKey) {
        try {
            // Жесткие параметры поиска для Екатеринбурга (bbox + strict_bounds=1)
            const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${apiKey}&text=${encodeURIComponent(trimmed)}&lang=ru_RU&bbox=${bbox}&strict_bounds=1`;
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

    // Резервный поиск через Geocoder API в границах Екатеринбурга, если Suggest вернул 0 результатов
    const geocodeApiKey = process.env.YANDEX_MAPS_API_KEY;
    if (geocodeApiKey) {
        try {
            const geocodeUrl = `https://geocode-maps.yandex.ru/1.x/?apikey=${geocodeApiKey}&geocode=${encodeURIComponent('Екатеринбург, ' + trimmed)}&bbox=${bbox}&rspn=1&format=json&results=7`;
            const geoResponse = await fetchWithTimeout(geocodeUrl);
            if (geoResponse.ok) {
                const geoData = await geoResponse.json();
                const members = geoData?.response?.GeoObjectCollection?.featureMember;
                if (Array.isArray(members) && members.length > 0) {
                    return members.map((m) => {
                        const obj = m.GeoObject;
                        const full = obj?.metaDataProperty?.GeocoderMetaData?.text || obj?.name || trimmed;
                        const name = obj?.name || full;
                        const description = obj?.description || 'Екатеринбург, Свердловская область';
                        return {
                            title: name,
                            subtitle: description,
                            full_address: full,
                            address: full
                        };
                    });
                }
            }
        } catch (err) {
            console.warn('Предупреждение: ошибка резервного геокодирования для подсказок:', err.message);
        }
    }

    // Резервный поиск по известным локациям Екатеринбурга
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
    let resolvedStart = startCoords;
    let resolvedEnd = endCoords;

    if (typeof resolvedStart === 'string') {
        const geo = await geocodeAddress(resolvedStart);
        resolvedStart = { lat: geo.latitude, lon: geo.longitude };
    }
    if (typeof resolvedEnd === 'string') {
        const geo = await geocodeAddress(resolvedEnd);
        resolvedEnd = { lat: geo.latitude, lon: geo.longitude };
    }

    const startLat = Number(resolvedStart?.lat ?? resolvedStart?.latitude ?? DEFAULT_COORDS.lat);
    const startLon = Number(resolvedStart?.lon ?? resolvedStart?.longitude ?? DEFAULT_COORDS.lon);
    const endLat = Number(resolvedEnd?.lat ?? resolvedEnd?.latitude ?? DEFAULT_COORDS.lat);
    const endLon = Number(resolvedEnd?.lon ?? resolvedEnd?.longitude ?? DEFAULT_COORDS.lon);

    const apiKey = process.env.YANDEX_ROUTER_API_KEY;
    if (apiKey) {
        try {
            const url = `https://api.routing.yandex.net/v2/route?waypoints=${startLat},${startLon}|${endLat},${endLon}&apikey=${apiKey}&mode=driving`;
            const response = await fetchWithTimeout(url);
            if (response.ok) {
                const data = await response.json();
                const route = data?.route;
                if (route) {
                    let meters = 0;
                    let seconds = 0;
                    const allPoints = [];
                    if (Array.isArray(route.legs)) {
                        for (const leg of route.legs) {
                            if (Array.isArray(leg.steps)) {
                                for (const step of leg.steps) {
                                    meters += Number(step.length || 0);
                                    seconds += Number(step.duration || 0);
                                    if (Array.isArray(step.polyline?.points)) {
                                        for (const pt of step.polyline.points) {
                                            allPoints.push([pt[1], pt[0]]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (meters === 0) {
                        meters = Math.round(route.summary?.length ?? route.legs?.[0]?.length ?? 0);
                        seconds = Math.round(route.summary?.duration?.value ?? route.summary?.duration ?? 0);
                    }
                    if (meters > 0) {
                        return {
                            distance_meters: Math.round(meters),
                            duration_seconds: Math.round(seconds),
                            distance_km: Math.round((meters / 1000) * 100) / 100,
                            duration_minutes: Math.round(seconds / 60),
                            route_polyline: {
                                type: 'LineString',
                                coordinates: allPoints.length > 0 ? allPoints : [[startLon, startLat], [endLon, endLat]]
                            }
                        };
                    }
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
    ensureEkaterinburgPrefix,
    geocodeAddress,
    reverseGeocode,
    suggestAddress,
    buildRoute,
    calculateTripPrice,
    isPeakHour,
    getFromGeocodeCache,
    saveToGeocodeCache,
    EKATERINBURG_BOUNDS,
    KNOWN_LOCATIONS
};
