/**
 * Сервис-обёртка над HTTP API Яндекс Карт с автоматическим резервом:
 *  - Геокодирование: HTTP Геокодер (geocode-maps.yandex.ru/1.x) → Nominatim/OSM (без ключа);
 *  - Маршрут: API «Получение деталей маршрута» (api.routing.yandex.net/v2, с пробками)
 *    → публичный OSRM (router.project-osrm.org, по дорогам, без пробок).
 *
 * Ключи задаются в backend/.env (фронтенд их не видит):
 *   YANDEX_GEOCODER_APIKEY — продукт «JavaScript API и HTTP Геокодер» (нужна включённая опция «Геокодер HTTP API»)
 *   YANDEX_ROUTER_APIKEY   — продукт «Получение деталей маршрута»
 * Оба бесплатные: https://developer.tech.yandex.ru/
 * Пока ключи не заданы или отклонены, сервис прозрачно работает на резервах
 * (ответ содержит source: 'osm' / 'osrm'); как только ключи заработают — вернётся Яндекс.
 */

const GEOCODER_URL = 'https://geocode-maps.yandex.ru/1.x/';
const ROUTER_URL = 'https://api.routing.yandex.net/v2/route';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_URL = 'https://router.project-osrm.org/route/v1';
// Nominatim требует User-Agent, идентифицирующий приложение
const PUBLIC_UA = 'CampusRide/1.0 (student ride-sharing project)';

// Приоритетный регион геокодирования — окрестности Екатеринбурга (формат bbox: lon,lat~lon,lat)
const EKATERINBURG_BBOX = '60.10,56.55~61.30,57.15';
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 минут — ответы Яндекса меняются редко
const CACHE_MAX_ENTRIES = 300;

class YandexApiError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = 'YandexApiError';
        this.statusCode = statusCode;
    }
}

/** Простой TTL-кэш ответов, чтобы не тратить квоту API на повторные запросы */
const cache = new Map();

function cacheGet(key) {
    const hit = cache.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
        cache.delete(key);
        return undefined;
    }
    return hit.value;
}

function cacheSet(key, value) {
    if (cache.size >= CACHE_MAX_ENTRIES) {
        // удаляем самую старую запись (Map хранит порядок вставки)
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

function geocoderKey() {
    return (process.env.YANDEX_GEOCODER_APIKEY || '').trim();
}

function routerKey() {
    return (process.env.YANDEX_ROUTER_APIKEY || '').trim();
}

/** HTTP GET с таймаутом и разбором JSON; ошибки Яндекса → YandexApiError */
async function fetchJson(url) {
    let res;
    try {
        res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
        throw new YandexApiError('Яндекс API недоступен (нет сети или таймаут ответа)', 502);
    }

    let body = null;
    try {
        body = await res.json();
    } catch {
        // тело не JSON — разберём по статусу ниже
    }

    if (!res.ok) {
        if (res.status === 403) {
            throw new YandexApiError(
                'Яндекс отклонил API-ключ (403 Invalid api key): проверьте в Кабинете разработчика ' +
                    '(developer.tech.yandex.ru), что ключ создан для нужного продукта, и дождитесь активации (~15 минут)',
                502,
            );
        }
        const detail =
            body && Array.isArray(body.errors) && body.errors.length > 0
                ? body.errors.join('; ')
                : `HTTP ${res.status}`;
        throw new YandexApiError(`Ошибка Яндекс API: ${detail}`, 502);
    }
    return body;
}

/** То же для keyless-сервисов (Nominatim/OSRM) — без яндекс-специфики разбора ошибок */
async function fetchJsonPlain(url, headers) {
    let res;
    try {
        res = await fetch(url, { headers: headers || {}, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
        throw new YandexApiError('Сервис недоступен (нет сети или таймаут ответа)', 502);
    }

    let body = null;
    try {
        body = await res.json();
    } catch {
        // тело не JSON — разберём по статусу ниже
    }

    if (!res.ok) {
        throw new YandexApiError(`Сервис ответил ошибкой HTTP ${res.status}`, 502);
    }
    return body;
}

/**
 * Резервное геокодирование через Nominatim (OpenStreetMap) — без ключа.
 * Включается автоматически, если Яндекс-геокодер не настроен или отклонил ключ.
 */
async function geocodeOsm(query) {
    const refined = /екатеринбург|екб/i.test(query) ? query : `Екатеринбург, ${query}`;
    const params = new URLSearchParams({
        q: refined,
        format: 'jsonv2',
        limit: '1',
        lang: 'ru',
        // окрестности Екатеринбурга как приоритет поиска (без жёсткого bounded)
        viewbox: '60.10,57.15,61.30,56.55',
    });
    const data = await fetchJsonPlain(`${NOMINATIM_URL}?${params}`, {
        'User-Agent': PUBLIC_UA,
        'Accept-Language': 'ru',
    });
    const first = Array.isArray(data) ? data[0] : null;
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);
    if (!first || Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon, name: first.display_name || query };
}

/**
 * Геокодирование текста через Яндекс-геокодер (требуется ключ в backend/.env).
 * Без упоминания города запрос уточняется префиксом «Екатеринбург, …»,
 * поиск ограничен окрестностями Екатеринбурга (bbox).
 * @returns {Promise<{lat: number, lon: number, name: string} | null>} null — если ничего не найдено
 */
async function geocodeYandex(text) {
    const query = String(text || '').trim();
    if (!query) return null;

    const refined = /екатеринбург/i.test(query) ? query : `Екатеринбург, ${query}`;
    const params = new URLSearchParams({
        apikey: geocoderKey(),
        geocode: refined,
        format: 'json',
        results: '1',
        lang: 'ru_RU',
        bbox: EKATERINBURG_BBOX,
    });

    const data = await fetchJson(`${GEOCODER_URL}?${params}`);
    const members = data?.response?.GeoObjectCollection?.featureMember;
    const geoObject = Array.isArray(members) ? members[0]?.GeoObject : null;
    // Point.pos — строка «<долгота> <широта>»
    const pos = typeof geoObject?.Point?.pos === 'string' ? geoObject.Point.pos : '';
    const [lonStr, latStr] = pos.split(' ');
    const lon = Number(lonStr);
    const lat = Number(latStr);

    if (Number.isNaN(lon) || Number.isNaN(lat)) return null;
    return {
        lat,
        lon,
        name: geoObject?.metaDataProperty?.GeocoderMetaData?.text || geoObject?.name || query,
    };
}

/**
 * Геокодирование текста: сначала Яндекс-геокодер (если ключ задан), затем
 * резервный Nominatim/OSM (без ключа). Результат кэшируется на 10 минут.
 * @returns {Promise<{lat: number, lon: number, name: string, source: string} | null>}
 *          null — если ничего не найдено ни одним источником
 */
async function geocodeText(text) {
    const query = String(text || '').trim();
    if (!query) return null;

    const cacheKey = `geocode:${query.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    let result = null;
    let answered = false;
    const errors = [];

    if (geocoderKey()) {
        try {
            result = await geocodeYandex(query);
            if (result) result.source = 'yandex';
            answered = true;
        } catch (err) {
            errors.push(err.message);
            console.error('Яндекс-геокодер недоступен, пробую резерв (OSM):', err.message);
        }
    }
    if (!result) {
        try {
            result = await geocodeOsm(query);
            if (result) result.source = 'osm';
            answered = true;
        } catch (err) {
            errors.push(err.message);
            console.error('Резервный геокодер (OSM) недоступен:', err.message);
        }
    }

    cacheSet(cacheKey, result);
    if (result || answered) return result;

    throw new YandexApiError(
        `Геокодирование недоступно: ${errors.join('; ') || 'не задан YANDEX_GEOCODER_APIKEY в backend/.env'}`,
        502,
    );
}

/**
 * Резервный расчёт маршрута через публичный OSRM (OpenStreetMap) — без ключа:
 * расстояние и время в пути по дорогам (без учёта пробок).
 */
async function routeOsrm({ fromLat, fromLon, toLat, toLon }) {
    // OSRM принимает координаты в порядке «долгота,широта»
    const url = `${OSRM_URL}/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
    const data = await fetchJsonPlain(url, { 'User-Agent': PUBLIC_UA });
    const route = Array.isArray(data?.routes) ? data.routes[0] : null;
    const distanceM = Number(route?.distance);
    const durationS = Number(route?.duration);
    if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) return null;
    return { distanceM, durationS };
}

/**
 * Детали маршрута: API «Получение деталей маршрута» (Router API v2, с пробками)
 * → резервный OSRM (по дорогам). Результат кэшируется на 10 минут.
 * @returns {Promise<{distanceM: number, durationS: number, distanceKm: number, durationMin: number, source: string} | null>}
 *          null — маршрут между точками построить не удалось
 */
async function getRouteDetails({ fromLat, fromLon, toLat, toLon, mode = 'driving' }) {
    const round4 = (n) => Math.round(Number(n) * 10000) / 10000;
    const cacheKey = `route:${mode}:${round4(fromLat)},${round4(fromLon)}:${round4(toLat)},${round4(toLon)}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    let result = null;
    const errors = [];

    if (routerKey()) {
        try {
            result = await routeYandex({ fromLat, fromLon, toLat, toLon, mode, round4 });
            if (result) result.source = 'yandex-router';
        } catch (err) {
            errors.push(err.message);
            console.error('Router API Яндекса недоступен, пробую резерв (OSRM):', err.message);
        }
    }
    if (!result) {
        try {
            result = await routeOsrm({ fromLat, fromLon, toLat, toLon });
            if (result) result.source = 'osrm';
        } catch (err) {
            errors.push(err.message);
            console.error('Резервная маршрутизация (OSRM) недоступна:', err.message);
        }
    }

    if (result) {
        result.distanceKm = Math.round((result.distanceM / 1000) * 100) / 100;
        result.durationMin = Math.max(1, Math.round(result.durationS / 60));
        cacheSet(cacheKey, result);
        return result;
    }
    if (errors.length > 0) {
        throw new YandexApiError(`Маршрутизация недоступна: ${errors.join('; ')}`, 502);
    }
    cacheSet(cacheKey, null);
    return null;
}

/** Ядро запроса к Router API v2 (используется в getRouteDetails) */
async function routeYandex({ fromLat, fromLon, toLat, toLon, mode, round4 }) {

    // Router API v2: waypoints — пары «широта,долгота», разделитель «|»
    const params = new URLSearchParams({
        apikey: routerKey(),
        waypoints: `${round4(fromLat)},${round4(fromLon)}|${round4(toLat)},${round4(toLon)}`,
        mode,
    });

    const data = await fetchJson(`${ROUTER_URL}?${params}`);
    const route = data?.route;
    // Формат ответа v2: route.paths[0].{distance,duration}; защитный fallback — route.{distance,duration}
    const path = Array.isArray(route?.paths) && route.paths.length > 0 ? route.paths[0] : null;
    const distanceM = Number(path?.distance ?? route?.distance);
    const durationS = Number(path?.duration ?? route?.duration);

    if (
        Number.isFinite(distanceM) &&
        Number.isFinite(durationS) &&
        distanceM >= 0 &&
        durationS >= 0
    ) {
        return { distanceM, durationS };
    }
    return null;
}

module.exports = { YandexApiError, geocodeText, getRouteDetails };
