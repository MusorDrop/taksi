import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { RoutePreviewResponse } from '../types';

export interface InitialRouteData {
  polyline?: [number, number][] | null;
  startCoords?: [number, number] | null;
  endCoords?: [number, number] | null;
  distanceKm?: number | null;
  durationMin?: number | null;
}

export interface UseRoutePreviewOptions {
  enabled?: boolean;
  initialPolyline?: [number, number][] | null;
  initialStartCoords?: [number, number] | null;
  initialEndCoords?: [number, number] | null;
  initialDistanceKm?: number | null;
  initialDurationMin?: number | null;
}

export interface UseRoutePreviewReturn {
  polyline: [number, number][] | null;
  routePolyline: [number, number][] | null;
  distanceKm: number | null;
  routeDistance: number | null;
  durationMin: number | null;
  routeDuration: number | null;
  startCoords: [number, number] | null;
  endCoords: [number, number] | null;
  recommendedPrice: number;
  isPeakDemand: boolean;
  isLoading: boolean;
  isRouteLoading: boolean;
  clear: () => void;
  setInitialRoute: (data: InitialRouteData) => void;
}

interface CoordinatePoint {
  lon?: number;
  lat?: number;
}

export interface ParsedRouteData {
  polyline: [number, number][] | null;
  distanceKm: number;
  durationMin: number;
  startCoords: [number, number] | null;
  endCoords: [number, number] | null;
  recommendedPrice: number;
  isPeak: boolean;
}

/**
 * Извлечение массива координат полилинии из ответа сервера
 */
function parseRoutePolyline(
  rawPoly: [number, number][] | { coordinates?: [number, number][] } | undefined | null,
): [number, number][] | null {
  if (Array.isArray(rawPoly)) {
    return rawPoly;
  }
  if (rawPoly && typeof rawPoly === 'object' && Array.isArray(rawPoly.coordinates)) {
    return rawPoly.coordinates;
  }
  return null;
}

/**
 * Извлечение координат точки [lon, lat] из объекта ответа
 */
function parseRouteCoords(point: CoordinatePoint | undefined | null): [number, number] | null {
  if (!point) {
    return null;
  }
  const { lon, lat } = point;
  if (typeof lon === 'number' && typeof lat === 'number') {
    return [lon, lat];
  }
  return null;
}

/**
 * Разбор данных маршрута из ответа сервера предварительного расчета
 */
function parseRouteResponse(res: RoutePreviewResponse): ParsedRouteData {
  const rawPoly = res.polyline ?? res.route_polyline;
  const polyline = parseRoutePolyline(rawPoly);

  const dist = res.distance_km ?? res.distanceKm ?? 5.0;
  const dur = res.duration_min ?? res.durationMin ?? Math.round(dist * 2.2);

  const startPoint = res.start ?? res.from ?? res.start_coords;
  const startCoords = parseRouteCoords(startPoint);

  const endPoint = res.end ?? res.to ?? res.end_coords;
  const endCoords = parseRouteCoords(endPoint);

  const priceVal = res.price ?? res.base_price ?? 150;
  const recommendedPrice = Math.round(priceVal / 5) * 5;
  const isPeak = Boolean(res.is_peak ?? res.isPeak);

  return {
    polyline,
    distanceKm: dist,
    durationMin: dur,
    startCoords,
    endCoords,
    recommendedPrice,
    isPeak,
  };
}

/**
 * Хук для расчета дорожного маршрута, расстояния и рекомендуемой цены между двумя адресами
 */
export function useRoutePreview(
  from: string,
  to: string,
  time?: string,
  options?: UseRoutePreviewOptions,
): UseRoutePreviewReturn {
  const enabled = options?.enabled ?? true;

  const [polyline, setPolyline] = useState<[number, number][] | null>(
    options?.initialPolyline ?? null,
  );
  const [distanceKm, setDistanceKm] = useState<number | null>(
    options?.initialDistanceKm ?? null,
  );
  const [durationMin, setDurationMin] = useState<number | null>(
    options?.initialDurationMin ?? null,
  );
  const [startCoords, setStartCoords] = useState<[number, number] | null>(
    options?.initialStartCoords ?? null,
  );
  const [endCoords, setEndCoords] = useState<[number, number] | null>(
    options?.initialEndCoords ?? null,
  );
  const [recommendedPrice, setRecommendedPrice] = useState<number>(150);
  const [isPeakDemand, setIsPeakDemand] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const clear = useCallback((): void => {
    setPolyline(null);
    setDistanceKm(null);
    setDurationMin(null);
    setStartCoords(null);
    setEndCoords(null);
    setIsLoading(false);
  }, []);

  const setInitialRoute = useCallback((data: InitialRouteData): void => {
    if (data.polyline !== undefined) setPolyline(data.polyline);
    if (data.startCoords !== undefined) setStartCoords(data.startCoords);
    if (data.endCoords !== undefined) setEndCoords(data.endCoords);
    if (data.distanceKm !== undefined) setDistanceKm(data.distanceKm);
    if (data.durationMin !== undefined) setDurationMin(data.durationMin);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const trimmedFrom = from.trim();
    const trimmedTo = to.trim();

    if (trimmedFrom.length < 2 || trimmedTo.length < 2) {
      clear();
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const timeParam = time ? `&time=${encodeURIComponent(time)}` : '';
        const query = `/api/rides/route-preview?from=${encodeURIComponent(trimmedFrom)}&to=${encodeURIComponent(trimmedTo)}${timeParam}`;
        const res = await api.get<RoutePreviewResponse>(query, {
          signal: controller.signal,
        });

        if (!res) {
          return;
        }

        const parsed = parseRouteResponse(res);
        if (parsed.polyline) {
          setPolyline(parsed.polyline);
        }
        setDistanceKm(parsed.distanceKm);
        setDurationMin(parsed.durationMin);
        if (parsed.startCoords) {
          setStartCoords(parsed.startCoords);
        }
        if (parsed.endCoords) {
          setEndCoords(parsed.endCoords);
        }
        setRecommendedPrice(parsed.recommendedPrice);
        setIsPeakDemand(parsed.isPeak);
      } catch {
        // Игнорируем сетевые сбои и отмененные запросы
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [from, to, time, enabled, clear]);

  return {
    polyline,
    routePolyline: polyline,
    distanceKm,
    routeDistance: distanceKm,
    durationMin,
    routeDuration: durationMin,
    startCoords,
    endCoords,
    recommendedPrice,
    isPeakDemand,
    isLoading,
    isRouteLoading: isLoading,
    clear,
    setInitialRoute,
  };
}
