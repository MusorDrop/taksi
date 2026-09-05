import { useEffect, useMemo, useState } from 'react';
import { geocode } from './geo';
import { ApiError, apiGeocode } from './api';
import type { GeoPoint } from './types';

/** Как разрешён текст точки: пусто / из словаря / ищем / найдено / не найдено / сервис недоступен */
export type PointStatus = 'empty' | 'known' | 'geocoding' | 'geocoded' | 'notfound' | 'unavailable';

export interface ResolvedPoint {
  /** Координаты: словарь → HTTP Геокодер Яндекса (через бэкенд) → fallback (точка по умолчанию) */
  point: GeoPoint;
  /** true — координаты точно соответствуют введённому тексту */
  isExact: boolean;
  status: PointStatus;
}

/** Ответ геокодера привязывается к конкретному тексту запроса */
interface RemoteResult {
  query: string;
  point: GeoPoint | null;
  unavailable: boolean;
}

/**
 * Сопоставляет текст точки координатам: сначала мгновенно по локальному словарю
 * известных локаций (geo.ts), затем с дебаунсом через HTTP Геокодер Яндекса,
 * проксируемый бэкендом (/api/geo/geocode — ключи хранятся на сервере).
 * Так на карте отмечается любой адрес, а не только заранее известные локации.
 *
 * Синхронные статусы (empty/known) вычисляются при рендере; в React-стейт
 * попадает только асинхронный ответ геокодера (правило set-state-in-effect).
 */
export function useResolvedPoint(text: string, fallback: GeoPoint): ResolvedPoint {
  const local = useMemo(() => geocode(text), [text]);
  const trimmed = text.trim();
  const [remote, setRemote] = useState<RemoteResult | null>(null);

  useEffect(() => {
    if (!trimmed || local) return undefined;
    // Ответ старого запроса безопасен: он сохраняется со своим query и не
    // сопоставляется с изменившимся текстом (см. сравнение ниже)
    const timer = setTimeout(() => {
      apiGeocode(trimmed)
        .then((res) => setRemote({ query: trimmed, point: res.point, unavailable: false }))
        .catch((err: unknown) =>
          setRemote({
            query: trimmed,
            point: null,
            unavailable: err instanceof ApiError && (err.status === 503 || err.status === 502),
          }),
        );
    }, 600);
    return () => clearTimeout(timer);
  }, [trimmed, local]);

  // Результат геокодера учитывается только для текущего текста поля
  const remoteForText = remote && remote.query === trimmed ? remote : null;

  let status: PointStatus;
  if (!trimmed) {
    status = 'empty';
  } else if (local) {
    status = 'known';
  } else if (remoteForText) {
    if (remoteForText.point) status = 'geocoded';
    else status = remoteForText.unavailable ? 'unavailable' : 'notfound';
  } else {
    status = 'geocoding';
  }

  return {
    point: local ?? remoteForText?.point ?? fallback,
    isExact: local !== null || !!remoteForText?.point,
    status,
  };
}
