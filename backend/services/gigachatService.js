const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// URL эндпоинтов GigaChat API
const GIGACHAT_OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const GIGACHAT_COMPLETIONS_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
const DEFAULT_SCOPE = 'GIGACHAT_API_PERS';
const DEFAULT_MODEL = process.env.GIGACHAT_MODEL || 'GigaChat-Pro';
const REQUEST_TIMEOUT_MS = 25000;

// Допустимый список тегов поездки (строго синхронизирован с AVAILABLE_TAGS на фронтенде)
const AVAILABLE_TAGS = [
    'С музыкой',
    'Еду молча',
    'Люблю поболтать',
    'Можно с багажом',
    'Пустой багажник',
    'Не курить',
    'Чистый салон',
    'Аккуратно вожу',
    'Можно с кофе/едой',
    'Без остановок',
    'Тишина',
    'Можно с животными'
];

/**
 * Системный промпт для GigaChat со строгими правилами обработки тегов, даты и времени
 */
const SYSTEM_PROMPT = [
    'Ты — интеллектуальный ассистент студенческого сервиса совместных поездок (райдшеринга) в городе Екатеринбурге.',
    'Твоя задача — извлечь параметры поездки из неструктурированного текста пользователя и вернуть СТРОГО валидный JSON-объект без markdown-разметки и без поясняющих фраз.',
    'Схема ответа:',
    '{',
    '  "role": "driver" | "passenger", // "driver" если человек предлагает подвезти, едет на своем авто, есть свободные места; "passenger" если человек ищет поездку, спрашивает кто подвезет или просит забрать',
    '  "from": string, // Точный пункт отправления (улица, дом, микрорайон, корпус УрФУ, ориентир или метро)',
    '  "to": string, // Точный пункт назначения',
    '  "date": string | null, // Дата поездки в формате YYYY-MM-DD (или словом "сегодня", если дата не указана явно). Слово "утром", "днем", "вечером" НЕ ДОЛЖНО попадать в date!',
    '  "time": string | null, // Время отправления в формате HH:mm. Если пользователь пишет "утром", "днем", "вечером", это должно записываться в time (например, "08:00", "14:00", "19:00")',
    '  "price": number | null, // Стоимость поездки в рублях за одно пассажирское место (только число)',
    '  "seats": number | null, // Число свободных мест для водителя либо нужных мест для пассажира (по умолчанию 3 для водителя, 1 для пассажира)',
    '  "comment": string | null, // Пожелания, уточнения, детали посадки или багажа',
    '  "tags": string[] // Массив тегов поездки. Должны БУКВАЛЬНО совпадать со строками из строгого списка ниже!',
    '}',
    '',
    'СТРОГИЕ ПРАВИЛА ОБРАБОТКИ ВРЕМЕНИ И ДАТЫ:',
    '1. Если пользователь пишет "утром", "днем", "вечером", это ОБЯЗАТЕЛЬНО должно записываться в "time":',
    '   - "утром" -> "08:00"',
    '   - "днем" -> "14:00"',
    '   - "вечером" -> "19:00"',
    '2. Поле "date" должно быть датой в формате YYYY-MM-DD (или словом "сегодня", если дата не указана). Слово "утром", "днем" или "вечером" категорически ЗАПРЕЩЕНО помещать в "date".',
    '',
    'СТРОГИЙ СПИСОК РАЗРЕШЕННЫХ ТЕГОВ (tags):',
    'В массив "tags" разрешено возвращать ИСКЛЮЧИТЕЛЬНО строки из следующего фиксированного списка (точное соответствие AVAILABLE_TAGS с фронтенда):',
    '  - "С музыкой"',
    '  - "Еду молча"',
    '  - "Люблю поболтать"',
    '  - "Можно с багажом"',
    '  - "Пустой багажник"',
    '  - "Не курить"',
    '  - "Чистый салон"',
    '  - "Аккуратно вожу"',
    '  - "Можно с кофе/едой"',
    '  - "Без остановок"',
    '  - "Тишина"',
    '  - "Можно с животными"',
    '',
    'ВАЖНО: Теги в ответе должны БУКВАЛЬНО совпадать с этими строками (включая регистр и пробелы), иначе фронтенд их не отрендерит.',
    'Сопоставляй формулировки пользователя со строгим списком: например, "чистый салон", "чтобы Чистый салон" -> "Чистый салон"; "без музыки", "в тишине" -> "Тишина"; "без сигарет", "не курить" -> "Не курить"; "поболтать" -> "Люблю поболтать".',
    'Если подходящих тегов нет, возвращай пустой массив [].',
    '',
    'Если какое-то поле невозможно определить из текста, укажи null (для tags пустой массив []). Город поездки по умолчанию — Екатеринбург.'
].join('\n');

// Переменные для кэширования access_token в памяти
let cachedAccessToken = null;
let tokenExpiresAt = 0;
let tokenPromise = null;
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
 * Выполнение сетевого запроса к OAuth-эндпоинту GigaChat для получения нового токена
 * @param {string} clientId Идентификатор клиента
 * @param {string} clientSecret Секретный ключ клиента
 * @param {string} scope Область доступа
 * @returns {Promise<{ accessToken: string, expiresAt: number }>}
 */
async function requestNewAccessToken(clientId, clientSecret, scope) {
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

    const expiresAt = authPayload.expires_at || (Date.now() + 25 * 60 * 1000);
    return {
        accessToken: authPayload.access_token,
        expiresAt
    };
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

    // Кэшируем Promise для предотвращения параллельных повторных запросов (thundering herd race condition)
    if (tokenPromise) {
        return tokenPromise;
    }

    tokenPromise = (async () => {
        try {
            const authResult = await requestNewAccessToken(clientId, clientSecret, scope);
            cachedAccessToken = authResult.accessToken;
            tokenExpiresAt = authResult.expiresAt;
            return cachedAccessToken;
        } finally {
            tokenPromise = null;
        }
    })();

    return tokenPromise;
}

/**
 * Очистка строки ответа языковой модели от Markdown-оберток (```json ... ```) и постороннего текста
 * @param {string} rawString - Необработанный строковый ответ модели
 * @returns {string} Очищенная JSON-строка
 */
function sanitizeJsonString(rawString) {
    if (!rawString || typeof rawString !== 'string') {
        return '{}';
    }

    // Сначала ищем блок кода ```json ... ``` или ``` ... ```
    const codeBlockMatch = rawString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = codeBlockMatch ? codeBlockMatch[1] : rawString;

    // Ищем первый символ '{' и последний символ '}' в полученном блоке
    const firstBraceIndex = candidate.indexOf('{');
    const lastBraceIndex = candidate.lastIndexOf('}');

    if (firstBraceIndex !== -1 && lastBraceIndex >= firstBraceIndex) {
        return candidate.slice(firstBraceIndex, lastBraceIndex + 1).trim();
    }

    // Резервный поиск первого '{' и последнего '}' во всем исходном ответе модели
    const rawFirstBrace = rawString.indexOf('{');
    const rawLastBrace = rawString.lastIndexOf('}');
    if (rawFirstBrace !== -1 && rawLastBrace >= rawFirstBrace) {
        return rawString.slice(rawFirstBrace, rawLastBrace + 1).trim();
    }

    return candidate.trim() || '{}';
}

// Смещение часового пояса Екатеринбурга (UTC+5) в миллисекундах
const EKATERINBURG_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Получение даты в формате YYYY-MM-DD для часового пояса Екатеринбурга (UTC+5)
 * @param {number} [dayOffset=0] - Смещение в днях (0 для сегодня, 1 для завтра, 2 для послезавтра)
 * @returns {string} Дата в формате YYYY-MM-DD
 */
function getEkaterinburgDate(dayOffset = 0) {
    const targetTimestamp = Date.now() + EKATERINBURG_OFFSET_MS + dayOffset * 24 * 60 * 60 * 1000;
    return new Date(targetTimestamp).toISOString().split('T')[0];
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

    if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
        return lower;
    }

    const ddmmyyyy = lower.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
    if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const currentYear = new Date(Date.now() + EKATERINBURG_OFFSET_MS).getUTCFullYear();
        const year = ddmmyyyy[3] || String(currentYear);
        return `${year}-${month}-${day}`;
    }

    if (lower.includes('послезавтра')) {
        return getEkaterinburgDate(2);
    }
    if (lower.includes('завтра')) {
        return getEkaterinburgDate(1);
    }
    if (lower.includes('сегодня')) {
        return getEkaterinburgDate(0);
    }

    // Если в дату ошибочно попало время суток, возвращаем сегодняшнюю дату в Екатеринбурге
    if (lower.includes('утр') || lower.includes('дн') || lower.includes('вечер') || lower.includes('ноч')) {
        return getEkaterinburgDate(0);
    }

    return dateStr;
}

/**
 * Стандартизация времени отправления в формате HH:mm
 * @param {string|null} timeStr - Исходная строка времени
 * @returns {string|null} Время в формате HH:mm либо null
 */
function resolveTimeString(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        return null;
    }
    const trimmed = timeStr.trim();
    if (!trimmed) {
        return null;
    }

    const lower = trimmed.toLowerCase();

    // Жесткая конвертация словесных обозначений времени суток
    if (lower.includes('утр')) {
        return '08:00';
    }
    if (lower.includes('дн') || lower.includes('обед')) {
        return '14:00';
    }
    if (lower.includes('вечер')) {
        return '19:00';
    }
    if (lower.includes('ноч')) {
        return '23:00';
    }

    // Проверка явного формата HH:mm или H:mm
    const match = trimmed.match(/(\d{1,2})[:.](\d{2})/);
    if (match) {
        const hours = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        if (hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59) {
            return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        }
        return null;
    }

    // Проверка одиночного указания часа
    const singleHourMatch = trimmed.match(/^(\d{1,2})(?:\s*(?:ч|час|часов))?$/i);
    if (singleHourMatch) {
        const h = parseInt(singleHourMatch[1], 10);
        if (h >= 0 && h <= 23) {
            return `${String(h).padStart(2, '0')}:00`;
        }
        return null;
    }

    // Если строка содержит любые другие буквы или невалидный формат — возвращаем null
    return null;
}

/**
 * Извлечение характерных тегов поездки по ключевым словам
 * @param {string} sourceText - Текст описания или комментария
 * @returns {string[]} Список выявленных тегов, строго соответствующих AVAILABLE_TAGS
 */
function extractKeywordTags(sourceText) {
    if (!sourceText || typeof sourceText !== 'string') {
        return [];
    }
    const lower = sourceText.toLowerCase();
    const tags = [];

    if (lower.includes('не кур') || lower.includes('без кур') || lower.includes('курить нельзя') || lower.includes('без сигарет') || lower.includes('не курят')) {
        tags.push('Не курить');
    }
    if (lower.includes('пустой багажник')) {
        tags.push('Пустой багажник');
    } else if (lower.includes('багаж') || lower.includes('чемодан') || lower.includes('сумк')) {
        tags.push('Можно с багажом');
    }
    if (lower.includes('музык')) {
        tags.push('С музыкой');
    }
    if (lower.includes('тишин') || lower.includes('без музыки') || lower.includes('в тишине') || lower.includes('тихо')) {
        tags.push('Тишина');
    }
    if (lower.includes('чист')) {
        tags.push('Чистый салон');
    }
    if (lower.includes('молч') || lower.includes('еду молча') || lower.includes('не разговар')) {
        tags.push('Еду молча');
    }
    if (lower.includes('поболтать') || lower.includes('поговорить') || lower.includes('общительн')) {
        tags.push('Люблю поболтать');
    }
    if (lower.includes('аккуратн')) {
        tags.push('Аккуратно вожу');
    }
    if (lower.includes('кофе') || lower.includes('едой') || lower.includes('перекус') || lower.includes('кушать') || lower.includes('поесть')) {
        tags.push('Можно с кофе/едой');
    }
    if (lower.includes('без остановок') || lower.includes('без пересадок')) {
        tags.push('Без остановок');
    }
    if (lower.includes('животн') || lower.includes('собак') || lower.includes('кошк') || lower.includes('питомц')) {
        tags.push('Можно с животными');
    }

    return tags;
}

/**
 * Нормализация значений даты и времени поездки
 * @param {string|null} rawDate - Сырая строка даты от модели
 * @param {string|null} rawTime - Сырая строка времени от модели
 * @param {string} originalText - Исходный текст запроса пользователя
 * @returns {{ date: string|null, time: string|null }} Нормализованные дата и время
 */
function normalizeDateTime(rawDate, rawTime, originalText) {
    let extractedDate = rawDate;
    let extractedTime = rawTime;

    // Если время суток ошибочно записано в поле date, переносим его в time
    if (extractedDate) {
        const lowerDate = extractedDate.toLowerCase();
        if (lowerDate.includes('утр')) {
            if (!extractedTime) extractedTime = '08:00';
            extractedDate = 'сегодня';
        } else if (lowerDate.includes('дн') || lowerDate.includes('обед')) {
            if (!extractedTime) extractedTime = '14:00';
            extractedDate = 'сегодня';
        } else if (lowerDate.includes('вечер')) {
            if (!extractedTime) extractedTime = '19:00';
            extractedDate = 'сегодня';
        } else if (lowerDate.includes('ноч')) {
            if (!extractedTime) extractedTime = '23:00';
            extractedDate = 'сегодня';
        }
    }

    // Если время не указано в ответе модели, но упомянуто в исходном тексте
    if (!extractedTime && originalText) {
        const lowerText = originalText.toLowerCase();
        if (lowerText.includes('утр')) {
            extractedTime = '08:00';
        } else if (lowerText.includes('днем') || lowerText.includes('в обед')) {
            extractedTime = '14:00';
        } else if (lowerText.includes('вечер')) {
            extractedTime = '19:00';
        } else if (lowerText.includes('ночью')) {
            extractedTime = '23:00';
        }
    }

    // Если дата не была указана, но есть время или текст запроса
    if (!extractedDate && (extractedTime || originalText)) {
        extractedDate = 'сегодня';
    }

    return {
        date: resolveDateString(extractedDate),
        time: resolveTimeString(extractedTime)
    };
}

/**
 * Нормализация и валидация тегов поездки по строгому списку AVAILABLE_TAGS
 * @param {unknown} rawTags - Массив тегов из ответа модели
 * @param {string|null} comment - Текст комментария
 * @param {string} originalText - Исходный текст запроса пользователя
 * @returns {string[]} Список проверенных тегов
 */
function normalizeTags(rawTags, comment, originalText) {
    const list = Array.isArray(rawTags) ? rawTags : [];
    const normalized = [];

    const processTagCandidate = (tagCandidate) => {
        if (!tagCandidate || typeof tagCandidate !== 'string') {
            return;
        }
        const trimmed = tagCandidate.trim();
        if (!trimmed) {
            return;
        }
        const lowerTag = trimmed.toLowerCase();

        // Если строка от LLM содержит корень "чист", добавляем тег "Чистый салон"
        if (lowerTag.includes('чист')) {
            if (!normalized.includes('Чистый салон')) {
                normalized.push('Чистый салон');
            }
        }

        // Проверяем прямое совпадение со списком разрешенных тегов
        const matched = AVAILABLE_TAGS.find(
            (item) => item.toLowerCase() === lowerTag
        );
        if (matched && !normalized.includes(matched)) {
            normalized.push(matched);
        }

        // Также проверяем совпадение по ключевым фразам
        const keywordMatched = extractKeywordTags(trimmed);
        for (const kw of keywordMatched) {
            if (!normalized.includes(kw)) {
                normalized.push(kw);
            }
        }
    };

    for (const rawTag of list) {
        processTagCandidate(rawTag);
    }

    if (typeof rawTags === 'string') {
        processTagCandidate(rawTags);
    }

    // Дополняем ключевыми тегами из текста комментария и запроса
    const combinedText = `${comment || ''} ${originalText}`;
    const keywordTags = extractKeywordTags(combinedText);
    for (const kwTag of keywordTags) {
        if (!normalized.includes(kwTag)) {
            normalized.push(kwTag);
        }
    }

    return normalized;
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
    const rawTime = typeof rawObject?.time === 'string' && rawObject.time.trim().length > 0
        ? rawObject.time.trim()
        : null;

    const { date, time } = normalizeDateTime(rawDate, rawTime, originalText);

    const parsedPrice = Number(rawObject?.price);
    const price = !isNaN(parsedPrice) && parsedPrice >= 0 ? Math.round(parsedPrice) : null;

    const parsedSeats = Number(rawObject?.seats);
    const seats = !isNaN(parsedSeats) && parsedSeats > 0 ? Math.round(parsedSeats) : (role === 'driver' ? 3 : 1);

    const comment = typeof rawObject?.comment === 'string' && rawObject.comment.trim().length > 0
        ? rawObject.comment.trim()
        : null;

    const tags = normalizeTags(rawObject?.tags, comment, originalText);

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

    const requestPayload = {
        model: DEFAULT_MODEL,
        messages: [
            {
                role: 'system',
                content: SYSTEM_PROMPT
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
    getHttpsAgent,
    AVAILABLE_TAGS,
    SYSTEM_PROMPT,
    sanitizeJsonString,
    resolveDateString,
    getEkaterinburgDate
};