const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// URL эндпоинтов GigaChat API
const GIGACHAT_OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const GIGACHAT_COMPLETIONS_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
const DEFAULT_SCOPE = 'GIGACHAT_API_PERS';
const DEFAULT_MODEL = 'GigaChat';
const REQUEST_TIMEOUT_MS = 25000;

// Переменные для кэширования access_token в памяти
let cachedAccessToken = null;
let tokenExpiresAt = 0;
let httpsAgentInstance = null;

/**
 * Загрузка сертификатов Минцифры РФ и инициализация https.Agent
 * @returns {https.Agent} Настроенный агент с доверенными корневыми сертификатами
 */
function getHttpsAgent() {
    if (httpsAgentInstance) {
        return httpsAgentInstance;
    }

    const caCertificates = [];
    const certDir = path.join(__dirname, '..', 'certs');
    const rootCertPath = path.join(certDir, 'russian_trusted_root_ca.pem');
    const subCertPath = path.join(certDir, 'russian_trusted_sub_ca.pem');

    if (fs.existsSync(rootCertPath)) {
        caCertificates.push(fs.readFileSync(rootCertPath));
    }
    if (fs.existsSync(subCertPath)) {
        caCertificates.push(fs.readFileSync(subCertPath));
    }

    if (caCertificates.length === 0) {
        console.warn('Внимание: сертификаты Минцифры не найдены в папке certs, используется системное хранилище CA');
        httpsAgentInstance = new https.Agent({
            keepAlive: true,
            timeout: REQUEST_TIMEOUT_MS
        });
        return httpsAgentInstance;
    }

    httpsAgentInstance = new https.Agent({
        ca: caCertificates,
        keepAlive: true,
        timeout: REQUEST_TIMEOUT_MS
    });

    return httpsAgentInstance;
}

/**
 * Универсальная обертка выполнения HTTPS-запросов с использованием кастомного агента
 * @param {string} targetUrl - Целевой URL запроса
 * @param {https.RequestOptions} options - Опции запроса (метод, заголовки)
 * @param {string|null} [requestBody=null] - Тело запроса
 * @returns {Promise<{ statusCode: number, headers: import('http').IncomingHttpHeaders, body: string }>}
 */
function sendHttpsRequest(targetUrl, options, requestBody = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(targetUrl);
        const agent = getHttpsAgent();

        const requestOptions = {
            protocol: parsedUrl.protocol,
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            agent: agent,
            timeout: REQUEST_TIMEOUT_MS
        };

        const req = https.request(requestOptions, (res) => {
            let responseData = '';
            res.setEncoding('utf8');

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode || 0,
                    headers: res.headers,
                    body: responseData
                });
            });
        });

        req.on('timeout', () => {
            req.destroy(new Error(`Превышен тайм-аут запроса к ${targetUrl} (${REQUEST_TIMEOUT_MS} мс)`));
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (requestBody) {
            req.write(requestBody);
        }

        req.end();
    });
}

/**
 * Получение валидного access_token GigaChat с автоматическим кэшированием в памяти
 * @returns {Promise<string>} Токен доступа Bearer
 */
async function getAccessToken() {
    const clientId = process.env.GIGACHAT_CLIENT_ID;
    const clientSecret = process.env.GIGACHAT_CLIENT_SECRET;
    const scope = process.env.GIGACHAT_SCOPE || DEFAULT_SCOPE;

    if (!clientId || !clientSecret) {
        throw new Error('Не заданы переменные окружения GIGACHAT_CLIENT_ID или GIGACHAT_CLIENT_SECRET в .env');
    }

    // Проверяем актуальность кэшированного токена (с запасом 60 секунд до истечения)
    const nowTimestamp = Date.now();
    if (cachedAccessToken && nowTimestamp < tokenExpiresAt - 60000) {
        return cachedAccessToken;
    }

    const credentialsBase64 = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const requestId = crypto.randomUUID();
    const postData = `scope=${encodeURIComponent(scope)}`;

    const response = await sendHttpsRequest(
        GIGACHAT_OAUTH_URL,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'RqUID': requestId,
                'Authorization': `Basic ${credentialsBase64}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        },
        postData
    );

    if (response.statusCode !== 200) {
        throw new Error(`Ошибка авторизации GigaChat (HTTP ${response.statusCode}): ${response.body}`);
    }

    let authPayload;
    try {
        authPayload = JSON.parse(response.body);
    } catch (parseError) {
        throw new Error(`Некорректный JSON при авторизации GigaChat: ${response.body}`);
    }

    if (!authPayload.access_token) {
        throw new Error('Ответ авторизации GigaChat не содержит access_token');
    }

    cachedAccessToken = authPayload.access_token;
    tokenExpiresAt = authPayload.expires_at || (nowTimestamp + 25 * 60 * 1000);

    return cachedAccessToken;
}

/**
 * Очистка строки ответа языковой модели от Markdown-оберток (```json ... ```)
 * @param {string} rawString - Необработанный строковый ответ модели
 * @returns {string} Очищенная JSON-строка
 */
function sanitizeJsonString(rawString) {
    if (!rawString || typeof rawString !== 'string') {
        return '{}';
    }
    const trimmed = rawString.trim();
    const cleanedLeading = trimmed.replace(/^```(?:json)?\s*/i, '');
    const cleanedBoth = cleanedLeading.replace(/\s*```$/i, '');
    return cleanedBoth.trim();
}

/**
 * Стандартизация даты поездки в формате YYYY-MM-DD
 * @param {string|null} dateStr - Исходная строка даты
 * @returns {string|null}
 */
function resolveDateString(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        return null;
    }
    const lower = dateStr.toLowerCase().trim();
    const now = new Date();

    if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
        return lower;
    }

    const ddmmyyyy = lower.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
    if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3] || String(now.getFullYear());
        return `${year}-${month}-${day}`;
    }

    if (lower.includes('послезавтра')) {
        const target = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        return target.toISOString().split('T')[0];
    }
    if (lower.includes('завтра')) {
        const target = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return target.toISOString().split('T')[0];
    }
    if (lower.includes('сегодня')) {
        return now.toISOString().split('T')[0];
    }

    return dateStr;
}

/**
 * Стандартизация времени отправления в формате HH:mm
 * @param {string|null} timeStr - Исходная строка времени
 * @returns {string|null}
 */
function resolveTimeString(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        return null;
    }
    const match = timeStr.trim().match(/(\d{1,2})[:.](\d{2})/);
    if (match) {
        const hours = match[1].padStart(2, '0');
        const mins = match[2];
        return `${hours}:${mins}`;
    }
    return timeStr.trim();
}

/**
 * Извлечение характерных тегов поездки по ключевым словам
 * @param {string} sourceText - Текст описания или комментария
 * @returns {string[]} Список выявленных тегов
 */
function extractKeywordTags(sourceText) {
    if (!sourceText || typeof sourceText !== 'string') {
        return [];
    }
    const lower = sourceText.toLowerCase();
    const tags = [];

    if (lower.includes('не кур') || lower.includes('без кур') || lower.includes('курить нельзя')) {
        tags.push('Не курить');
    }
    if (lower.includes('багаж') || lower.includes('чемодан') || lower.includes('сумк')) {
        tags.push('Багаж');
    }
    if (lower.includes('музык')) {
        tags.push('С музыкой');
    }
    if (lower.includes('животн') || lower.includes('собак') || lower.includes('кошк')) {
        tags.push('Можно с животными');
    }
    if (lower.includes('студент')) {
        tags.push('Только студенты');
    }
    if (lower.includes('детск') || lower.includes('бустер')) {
        tags.push('Детское кресло');
    }

    return tags;
}

/**
 * Приведение извлеченных AI параметров к строгому формату объекта поездки
 * @param {Record<string, unknown>} rawObject - Сырой объект после JSON.parse
 * @param {string} [originalText=''] - Исходный текст запроса пользователя
 * @returns {{
 *   role: 'driver'|'passenger',
 *   from: string,
 *   to: string,
 *   date: string|null,
 *   time: string|null,
 *   price: number|null,
 *   seats: number|null,
 *   comment: string|null,
 *   tags: string[]
 * }} Нормализованные параметры поездки
 */
function normalizeExtractedRideData(rawObject, originalText = '') {
    const rawRole = String(rawObject?.role || '').toLowerCase();
    const role = rawRole.includes('driver') || rawRole.includes('вод') ? 'driver' : 'passenger';

    const fromAddress = typeof rawObject?.from === 'string' ? rawObject.from.trim() : '';
    const toAddress = typeof rawObject?.to === 'string' ? rawObject.to.trim() : '';

    const rawDate = typeof rawObject?.date === 'string' && rawObject.date.trim().length > 0
        ? rawObject.date.trim()
        : null;
    const date = resolveDateString(rawDate);

    const rawTime = typeof rawObject?.time === 'string' && rawObject.time.trim().length > 0
        ? rawObject.time.trim()
        : null;
    const time = resolveTimeString(rawTime);

    const parsedPrice = Number(rawObject?.price);
    const price = !isNaN(parsedPrice) && parsedPrice >= 0 ? Math.round(parsedPrice) : null;

    const parsedSeats = Number(rawObject?.seats);
    const seats = !isNaN(parsedSeats) && parsedSeats > 0 ? Math.round(parsedSeats) : (role === 'driver' ? 3 : 1);

    const comment = typeof rawObject?.comment === 'string' && rawObject.comment.trim().length > 0
        ? rawObject.comment.trim()
        : null;

    let tags = Array.isArray(rawObject?.tags)
        ? rawObject.tags.map((tag) => String(tag).trim()).filter((tag) => tag.length > 0)
        : [];

    if (tags.length === 0) {
        const combinedText = `${comment || ''} ${originalText}`;
        tags = extractKeywordTags(combinedText);
    }

    return {
        role,
        from: fromAddress,
        to: toAddress,
        date,
        time,
        price,
        seats,
        comment,
        tags
    };
}

/**
 * Извлечение структурированных параметров поездки из текста с помощью GigaChat
 * @param {string} text - Пользовательский текст объявления о поездке
 * @returns {Promise<{
 *   role: 'driver'|'passenger',
 *   from: string,
 *   to: string,
 *   date: string|null,
 *   time: string|null,
 *   price: number|null,
 *   seats: number|null,
 *   comment: string|null,
 *   tags: string[]
 * }>} Извлеченные параметры поездки
 */
async function parseRideRequest(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Текст для распознавания поездки не может быть пустым');
    }

    const token = await getAccessToken();

    const systemPrompt = [
        'Ты — интеллектуальный ассистент студенческого сервиса совместных поездок (райдшеринга) в городе Екатеринбурге.',
        'Твоя задача — извлечь параметры поездки из неструктурированного текста пользователя и вернуть СТРОГО валидный JSON-объект без markdown-разметки и без поясняющих фраз.',
        'Схема ответа:',
        '{',
        '  "role": "driver" | "passenger", // "driver" если человек предлагает подвезти, едет на своем авто, есть свободные места; "passenger" если человек ищет поездку, спрашивает кто подвезет или просит забрать',
        '  "from": string, // Точный пункт отправления (улица, дом, микрорайон, корпус УрФУ, ориентир или метро)',
        '  "to": string, // Точный пункт назначения',
        '  "date": string | null, // Дата поездки в формате YYYY-MM-DD (если указано "сегодня", "завтра" и т.п., вычисли относительно текущей даты) или текстовое описание',
        '  "time": string | null, // Время отправления в формате HH:mm (например, "18:00") или интервал',
        '  "price": number | null, // Стоимость поездки в рублях за одно пассажирское место (только число)',
        '  "seats": number | null, // Число свободных мест для водителя либо нужных мест для пассажира (по умолчанию 3 для водителя, 1 для пассажира)',
        '  "comment": string | null, // Пожелания, уточнения, детали посадки или багажа',
        '  "tags": string[] // Список ключевых тегов (например: ["не курим", "с багажом", "быстро", "только студенты"])',
        '}',
        'Если какое-то поле невозможно определить из текста, укажи null (для tags пустой массив []). Город поездки по умолчанию — Екатеринбург.'
    ].join('\n');

    const requestPayload = {
        model: DEFAULT_MODEL,
        messages: [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: text.trim()
            }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
    };

    const payloadString = JSON.stringify(requestPayload);

    const response = await sendHttpsRequest(
        GIGACHAT_COMPLETIONS_URL,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': Buffer.byteLength(payloadString)
            }
        },
        payloadString
    );

    if (response.statusCode !== 200) {
        throw new Error(`Ошибка запроса к GigaChat Completions (HTTP ${response.statusCode}): ${response.body}`);
    }

    let completionData;
    try {
        completionData = JSON.parse(response.body);
    } catch (parseError) {
        throw new Error(`Некорректный JSON-ответ от GigaChat: ${response.body}`);
    }

    const messageContent = completionData?.choices?.[0]?.message?.content;
    if (!messageContent) {
        throw new Error('GigaChat вернул пустой ответ или некорректную структуру choices');
    }

    const cleanedJson = sanitizeJsonString(messageContent);
    let parsedJson;
    try {
        parsedJson = JSON.parse(cleanedJson);
    } catch (err) {
        throw new Error(`Не удалось распарсить JSON из ответа GigaChat: ${cleanedJson}`);
    }

    return normalizeExtractedRideData(parsedJson, text);
}

module.exports = {
    getAccessToken,
    parseRideRequest,
    getHttpsAgent
};