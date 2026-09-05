/**
 * Интеграция JavaScript API Яндекс Карт 2.1: общие типы, загрузчик скрипта
 * и геокодирование текста в координаты.
 * Ключ задаётся в frontend/.env → VITE_YANDEX_MAPS_APIKEY
 * (Кабинет разработчика: https://developer.tech.yandex.ru/ → «JavaScript API и HTTP Геокодер»).
 */
/** Ключ JS API Яндекс Карт (пустая строка — карта и геокодирование недоступны) */
export const YMAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_APIKEY?.trim() || '';

// ---- Минимальные структурные типы JS API 2.1 (официальных типов в зависимостях нет) ----

export interface YMapEvent {
  get: (key: string) => unknown;
}

export interface YEventCollection {
  add(type: string, handler: (e: YMapEvent) => void): void;
  remove(type: string, handler: (e: YMapEvent) => void): void;
}

/** Маршрут (multiRouter.MultiRoute) */
export interface YMultiRoute {
  model: { events: YEventCollection };
}

/** Метка на карте (Placemark) */
export interface YPlacemark {
  geometry: { getCoordinates(): [number, number] };
}

export interface YMap {
  geoObjects: {
    add(obj: YMultiRoute | YPlacemark): void;
    remove(obj: YMultiRoute | YPlacemark): void;
  };
  setCenter(center: [number, number], zoom?: number): void;
  destroy(): void;
}

export interface YMapsApi {
  ready(onReady: () => void): void;
  Map: new (
    container: HTMLElement,
    state: { center: [number, number]; zoom: number; controls?: string[] },
    options?: { suppressMapOpenBlock?: boolean },
  ) => YMap;
  Placemark: new (
    coords: [number, number],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YPlacemark;
  multiRouter: {
    MultiRoute: new (
      model: { referencePoints: (string | [number, number])[]; params: { routingMode: 'auto' } },
      options?: Record<string, unknown>,
    ) => YMultiRoute;
  };
  geocode(request: string, options?: Record<string, unknown>): PromiseLike<YGeoCollection>;
}

export interface YGeoCollection {
  geoObjects: {
    getLength(): number;
    get(index: number): { geometry: { getCoordinates(): [number, number] } } | null;
  };
}

declare global {
  interface Window {
    ymaps?: YMapsApi;
  }
}

/** Центр Екатеринбурга — стартовое состояние карты до построения маршрута */
export const EKATERINBURG_CENTER: [number, number] = [56.8389, 60.6057];

/** Приоритетный регион геокодирования (окрестности Екатеринбурга, [lat, lon]) */
export const EKATERINBURG_BBOX: [[number, number], [number, number]] = [
  [56.55, 60.1],
  [57.15, 61.3],
];

let ymapsPromise: Promise<YMapsApi> | null = null;

/** Однократная динамическая загрузка JS API 2.1 с ожиданием инициализации */
export function loadYmaps(apiKey: string = YMAPS_API_KEY): Promise<YMapsApi> {
  if (window.ymaps) return Promise.resolve(window.ymaps);
  if (ymapsPromise) return ymapsPromise;

  ymapsPromise = new Promise<YMapsApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      const api = window.ymaps;
      if (!api) {
        reject(new Error('Скрипт Яндекс Карт загрузился, но API недоступен — проверьте ключ'));
        return;
      }
      // Ждём полной инициализации API, ограничивая ожидание таймаутом
      const timeout = setTimeout(
        () => reject(new Error('Яндекс Карты не инициализировались (проверьте ключ)')),
        15000,
      );
      api.ready(() => {
        clearTimeout(timeout);
        resolve(api);
      });
    };
    script.onerror = () => {
      ymapsPromise = null;
      reject(new Error('Не удалось загрузить Яндекс Карты'));
    };
    document.head.appendChild(script);
  });
  return ymapsPromise;
}

/**
 * Геокодирование произвольного текста выполняется на бэкенде через HTTP Геокодер
 * (/api/geo/geocode, сервис backend/services/yandexMaps.js) — там хранится ключ.
 * Здесь остаётся только загрузка JS API для отрисовки карты и маршрута.
 */
