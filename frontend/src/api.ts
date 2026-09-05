/**
 * Модуль для выполнения HTTP-запросов к API без внешних библиотек.
 * Реализует автоматическое добавление JWT-токена, обработку 401 ошибки и поддержку AbortSignal.
 */


const TOKEN_KEY = 'auth_token';

/**
 * Получение сохраненного JWT-токена из локального хранилища браузера
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Сохранение JWT-токена в локальное хранилище
 * @param token - JWT токен
 */
export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Удаление JWT-токена из локального хранилища
 */
export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Получение ключа администратора из сессионного хранилища
 */
export function getAdminKey(): string | null {
  return sessionStorage.getItem('admin_key') || sessionStorage.getItem('adminKey');
}

/**
 * Сохранение ключа администратора в сессионное хранилище
 * @param key - Ключ администратора (30 символов)
 */
export function setAdminKey(key: string): void {
  sessionStorage.setItem('admin_key', key);
  sessionStorage.setItem('adminKey', key);
}

/**
 * Удаление ключа администратора из сессионного хранилища
 */
export function removeAdminKey(): void {
  sessionStorage.removeItem('admin_key');
  sessionStorage.removeItem('adminKey');
}

/**
 * Обработка неавторизованного ответа от сервера (401).
 * Удаляет невалидный токен и рассылает событие для перехода на окно авторизации.
 */
function handleUnauthorized(): void {
  removeAuthToken();
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
}

/**
 * Извлечение текстового сообщения об ошибке из тела HTTP-ответа
 * @param response - Объект ответа fetch
 */
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const errorBody = (await response.json()) as { error?: string; message?: string };
    if (errorBody && typeof errorBody === 'object') {
      const extracted = errorBody.error || errorBody.message;
      if (extracted) {
        return extracted;
      }
    }
  } catch {
    // Ответ не в формате JSON или пустой
  }
  return `Ошибка ${response.status}: ${response.statusText || 'Неизвестная ошибка сервера'}`;
}

/**
 * Формирование заголовков запроса с добавлением авторизационного токена и ключа администратора
 * @param endpoint - URL адрес запроса
 * @param customHeaders - Пользовательские заголовки
 * @param isFormData - Флаг передачи данных формы (multipart)
 */
function buildRequestHeaders(
  endpoint: string,
  customHeaders?: HeadersInit,
  isFormData: boolean = false
): Headers {
  const headers = new Headers(customHeaders);
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (endpoint.includes('/api/admin')) {
    const adminKey = getAdminKey();
    if (adminKey && !headers.has('X-Admin-Key')) {
      headers.set('X-Admin-Key', adminKey);
    }
  }
  return headers;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Базовый метод для отправки типизированных запросов к API через fetch
 * @param endpoint - Относительный или абсолютный URL запроса
 * @param options - Дополнительные параметры запроса (метод, заголовки, AbortSignal)
 */
export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...restOptions } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestHeaders = buildRequestHeaders(endpoint, headers, isFormData);

  const config: RequestInit = {
    ...restOptions,
    headers: requestHeaders,
  };

  if (body !== undefined) {
    config.body = isFormData ? (body as BodyInit) : JSON.stringify(body);
  }

  const response = await fetch(endpoint, config);

  if (!response.ok) {
    const isAdminRequest = endpoint.startsWith('/api/admin') || requestHeaders.has('X-Admin-Key');
    if (response.status === 401 && !isAdminRequest) {
      handleUnauthorized();
    }
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  const data = (await response.json()) as T;
  return data;
}

/**
 * Объект API с вспомогательными методами GET, POST, PUT, PATCH, DELETE
 */
export const api = {
  get: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  joinRide: <T = unknown>(rideId: string, selectedDay?: string): Promise<T> =>
    joinRideApi<T>(rideId, selectedDay),
};

/**
 * Вызов API для присоединения к поездке с возможностью передачи выбранного дня
 * @param rideId - Идентификатор поездки
 * @param selectedDay - Выбранный день для регулярных поездок (опционально)
 */
export async function joinRideApi<T = unknown>(rideId: string, selectedDay?: string): Promise<T> {
  const body = selectedDay ? { selected_day: selectedDay } : undefined;
  return api.post<T>(`/api/rides/${rideId}/join`, body);
}

