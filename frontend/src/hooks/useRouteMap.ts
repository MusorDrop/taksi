import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { RoutePreviewResponse } from '../types';

export interface UseRouteMapProps {
  from?: string;
  to?: string;
  polyline?: [number, number][] | null;
  startCoords?: [number, number] | null;
  endCoords?: [number, number] | null;
  distanceKm?: number | null;
  durationMin?: number | null;
}

export interface UseRouteMapReturn {
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  isMapReady: boolean;
  isLoadingRoute: boolean;
  currentDistance: number | null;
  currentDuration: number | null;
  hasRouteInfo: boolean;
}

interface DisposableMap {
  destroy: () => void;
  container?: {
    fitToViewport?: () => void;
  };
}

interface YMaps2Geometry {
  getBounds: () => [[number, number], [number, number]] | null;
}

interface YMaps2Polyline {
  geometry: YMaps2Geometry;
}

interface YMaps2GeoObjects {
  add: (obj: unknown) => void;
}

interface YMaps2Map {
  destroy: () => void;
  geoObjects: YMaps2GeoObjects;
  setBounds: (bounds: unknown, options?: unknown) => void;
  container?: {
    fitToViewport?: () => void;
  };
}

/**
 * Очистка дочерних элементов DOM-контейнера без использования innerHTML
 */
function clearDomContainer(container: HTMLElement): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

/**
 * Создание HTML-элемента маркера для Яндекс Карт API 3.0
 */
function createMarkerElement(label: string, isDestination: boolean): HTMLElement {
  const container = document.createElement('div');
  const bgColor = isDestination ? '#d32f2f' : '#1565c0';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.width = '28px';
  container.style.height = '28px';
  container.style.backgroundColor = bgColor;
  container.style.color = '#ffffff';
  container.style.borderRadius = '50%';
  container.style.fontWeight = 'bold';
  container.style.fontSize = '12px';
  container.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.35)';
  container.style.border = '2px solid #ffffff';
  container.style.cursor = 'pointer';
  container.style.userSelect = 'none';
  container.textContent = label;
  return container;
}

/**
 * Расчет центра и границ полилинии для автомасштабирования карты
 */
function calculateMapBounds(coordinates: [number, number][]): {
  center: [number, number];
  bounds: [[number, number], [number, number]];
} {
  const lons = coordinates.map((coord) => coord[0]);
  const lats = coordinates.map((coord) => coord[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const lonPadding = Math.max((maxLon - minLon) * 0.15, 0.008);
  const latPadding = Math.max((maxLat - minLat) * 0.15, 0.008);

  return {
    center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
    bounds: [
      [minLon - lonPadding, minLat - latPadding * 1.3],
      [maxLon + lonPadding, maxLat + latPadding],
    ],
  };
}

/**
 * Кастомный хук для инициализации, управления и синхронизации Яндекс Карт (API 2.1 и 3.0)
 */
export function useRouteMap({
  from,
  to,
  polyline,
  startCoords,
  endCoords,
  distanceKm,
  durationMin,
}: UseRouteMapProps): UseRouteMapReturn {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<DisposableMap | null>(null);

  const [currentPolyline, setCurrentPolyline] = useState<[number, number][] | null>(polyline || null);
  const [currentStart, setCurrentStart] = useState<[number, number] | null>(startCoords || null);
  const [currentEnd, setCurrentEnd] = useState<[number, number] | null>(endCoords || null);
  const [currentDistance, setCurrentDistance] = useState<number | null>(distanceKm || null);
  const [currentDuration, setCurrentDuration] = useState<number | null>(durationMin || null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);

  // Синхронизация внешних props с локальным состоянием
  useEffect(() => {
    if (polyline !== undefined) {
      setCurrentPolyline(polyline);
    }
    if (startCoords !== undefined) {
      setCurrentStart(startCoords);
    }
    if (endCoords !== undefined) {
      setCurrentEnd(endCoords);
    }
    if (distanceKm !== undefined) {
      setCurrentDistance(distanceKm);
    }
    if (durationMin !== undefined) {
      setCurrentDuration(durationMin);
    }
  }, [polyline, startCoords, endCoords, distanceKm, durationMin]);

  // Загрузка предпросмотра маршрута от бэкенда, если полилиния не передана родительским компонентом
  useEffect(() => {
    const hasExternalPolyline = Boolean(polyline && polyline.length > 0);
    const hasValidAddresses = Boolean(
      from &&
        to &&
        from.trim().length >= 2 &&
        to.trim().length >= 2 &&
        from !== 'Точка А' &&
        to !== 'Точка Б'
    );

    if (hasExternalPolyline || !hasValidAddresses) {
      return;
    }

    const abortController = new AbortController();
    setIsLoadingRoute(true);

    async function fetchRoute(): Promise<void> {
      try {
        const query = `/api/rides/route-preview?from=${encodeURIComponent(from!)}&to=${encodeURIComponent(to!)}`;
        const res = await api.get<RoutePreviewResponse>(query, {
          signal: abortController.signal,
        });

        if (!res) {
          return;
        }

        const rawPoly = res.polyline ?? res.route_polyline;
        let coords: [number, number][] | null = null;
        if (Array.isArray(rawPoly)) {
          coords = rawPoly as [number, number][];
        } else if (rawPoly && typeof rawPoly === 'object' && Array.isArray(rawPoly.coordinates)) {
          coords = rawPoly.coordinates;
        }

        if (coords) {
          setCurrentPolyline(coords);
        }

        const sLon = res.start?.lon ?? res.from?.lon ?? res.start_coords?.lon;
        const sLat = res.start?.lat ?? res.from?.lat ?? res.start_coords?.lat;
        if (sLon !== undefined && sLat !== undefined) {
          setCurrentStart([sLon, sLat]);
        }

        const eLon = res.end?.lon ?? res.to?.lon ?? res.end_coords?.lon;
        const eLat = res.end?.lat ?? res.to?.lat ?? res.end_coords?.lat;
        if (eLon !== undefined && eLat !== undefined) {
          setCurrentEnd([eLon, eLat]);
        }

        const dist = res.distance_km ?? res.distanceKm;
        if (dist !== undefined) {
          setCurrentDistance(dist);
        }

        const dur = res.duration_min ?? res.durationMin;
        if (dur !== undefined) {
          setCurrentDuration(dur);
        }
      } catch {
        // При ошибке или отмене запроса сохраняются текущие данные
      } finally {
        setIsLoadingRoute(false);
      }
    }

    fetchRoute();

    return () => {
      abortController.abort();
    };
  }, [from, to, polyline]);

  // Инициализация карты Яндекс
  useEffect(() => {
    let isCancelled = false;

    const fallbackTimer = setTimeout(() => {
      if (!isCancelled) {
        setIsMapReady(true);
      }
    }, 3000);

    async function setupMap(): Promise<void> {
      if (!mapContainerRef.current) {
        return;
      }

      // 1. Проверка API 2.1 (window.ymaps)
      const ymaps2 = window.ymaps;
      if (ymaps2 && typeof ymaps2.ready === 'function') {
        ymaps2.ready(() => {
          if (isCancelled || !mapContainerRef.current) {
            return;
          }

          if (mapInstanceRef.current && typeof mapInstanceRef.current.destroy === 'function') {
            try {
              mapInstanceRef.current.destroy();
            } catch {
              // Игнорируем ошибки при уничтожении инстанса
            }
            mapInstanceRef.current = null;
          }

          // Очистка контейнера без манипулирования innerHTML
          clearDomContainer(mapContainerRef.current);

          const activeCoords = currentPolyline && currentPolyline.length > 0 ? currentPolyline : null;
          let center21: [number, number] = [56.8439, 60.6534];
          let zoom21 = 11;

          if (activeCoords && activeCoords.length > 0) {
            const lons = activeCoords.map((c) => c[0]);
            const lats = activeCoords.map((c) => c[1]);
            const avgLon = (Math.min(...lons) + Math.max(...lons)) / 2;
            const avgLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            center21 = [avgLat, avgLon];
            zoom21 = 12;
          }

          try {
            const YMapConstructor = ymaps2['Map'] as new (
              el: HTMLElement,
              state: { center: [number, number]; zoom: number; controls: string[] },
              options: { suppressMapOpenBlock: boolean }
            ) => YMaps2Map;

            const map = new YMapConstructor(
              mapContainerRef.current,
              {
                center: center21,
                zoom: zoom21,
                controls: ['zoomControl'],
              },
              {
                suppressMapOpenBlock: true,
              }
            );

            if (activeCoords && activeCoords.length >= 2) {
              const polyCoords21 = activeCoords.map(([lon, lat]): [number, number] => [lat, lon]);
              const PolylineConstructor = ymaps2['Polyline'] as new (
                coords: [number, number][],
                properties: { hintContent: string },
                options: { strokeColor: string; strokeWidth: number; strokeOpacity: number }
              ) => YMaps2Polyline;

              const polylineGeo = new PolylineConstructor(
                polyCoords21,
                { hintContent: 'Маршрут поездки' },
                {
                  strokeColor: '#1565c0',
                  strokeWidth: 5,
                  strokeOpacity: 0.9,
                }
              );
              map.geoObjects.add(polylineGeo);

              try {
                const bounds = polylineGeo.geometry.getBounds();
                if (bounds) {
                  map.setBounds(bounds, { checkZoomRange: true, zoomMargin: [35, 20, 50, 20] });
                }
              } catch {
                // Игнорируем ошибку границ геометрии
              }
            }

            const PlacemarkConstructor = ymaps2['Placemark'] as new (
              coords: [number, number],
              properties: { iconContent: string; hintContent: string; balloonContent: string },
              options: { preset: string }
            ) => unknown;

            const startPt = currentStart || (activeCoords ? activeCoords[0] : null);
            if (startPt) {
              const markerStart = new PlacemarkConstructor(
                [startPt[1], startPt[0]],
                {
                  iconContent: 'А',
                  hintContent: from || 'Точка А',
                  balloonContent: from || 'Точка отправления',
                },
                {
                  preset: 'islands#blueCircleIcon',
                }
              );
              map.geoObjects.add(markerStart);
            }

            const endPt = currentEnd || (activeCoords ? activeCoords[activeCoords.length - 1] : null);
            if (endPt) {
              const markerEnd = new PlacemarkConstructor(
                [endPt[1], endPt[0]],
                {
                  iconContent: 'Б',
                  hintContent: to || 'Точка Б',
                  balloonContent: to || 'Точка назначения',
                },
                {
                  preset: 'islands#redCircleIcon',
                }
              );
              map.geoObjects.add(markerEnd);
            }

            mapInstanceRef.current = map;
            setIsMapReady(true);

            const adjustViewport = (): void => {
              if (map?.container?.fitToViewport) {
                try {
                  map.container.fitToViewport();
                } catch {
                  // Игнорируем ошибку подгонки размеров
                }
              }
            };
            setTimeout(adjustViewport, 150);
            setTimeout(adjustViewport, 350);
          } catch (err) {
            console.warn('Предупреждение: ошибка инициализации ymaps 2.1:', err);
            setIsMapReady(true);
          }
        });
        return;
      }

      // 2. Проверка API 3.0 (window.ymaps3)
      const ymaps3Obj = window.ymaps3;
      if (ymaps3Obj) {
        try {
          await ymaps3Obj.ready;
          if (isCancelled || !mapContainerRef.current) {
            return;
          }

          if (mapInstanceRef.current && typeof mapInstanceRef.current.destroy === 'function') {
            try {
              mapInstanceRef.current.destroy();
            } catch {
              // Игнорируем
            }
            mapInstanceRef.current = null;
          }

          // Очистка контейнера без innerHTML
          clearDomContainer(mapContainerRef.current);

          const activeCoords = currentPolyline && currentPolyline.length > 0 ? currentPolyline : null;
          let initialCenter: [number, number] = [60.6534, 56.8439];
          let initialZoom = 11;
          let bounds: [[number, number], [number, number]] | undefined = undefined;

          if (activeCoords) {
            const calculated = calculateMapBounds(activeCoords);
            initialCenter = calculated.center;
            bounds = calculated.bounds;
            initialZoom = 12;
          }

          const map = new ymaps3Obj.YMap(mapContainerRef.current, {
            location: bounds
              ? { bounds, zoom: initialZoom }
              : { center: initialCenter, zoom: initialZoom },
          });

          map.addChild(new ymaps3Obj.YMapDefaultSchemeLayer({}));
          map.addChild(new ymaps3Obj.YMapDefaultFeaturesLayer({}));

          if (activeCoords && activeCoords.length >= 2) {
            const polylineFeature = new ymaps3Obj.YMapFeature({
              geometry: {
                type: 'LineString',
                coordinates: activeCoords,
              },
              style: {
                stroke: [{ color: '#1565c0', width: 5, opacity: 0.9 }],
              },
            });
            map.addChild(polylineFeature);
          }

          const startPt = currentStart || (activeCoords ? activeCoords[0] : null);
          if (startPt) {
            const markerStart = new ymaps3Obj.YMapMarker(
              { coordinates: startPt, title: from || 'Точка А' },
              createMarkerElement('А', false)
            );
            map.addChild(markerStart);
          }

          const endPt = currentEnd || (activeCoords ? activeCoords[activeCoords.length - 1] : null);
          if (endPt) {
            const markerEnd = new ymaps3Obj.YMapMarker(
              { coordinates: endPt, title: to || 'Точка Б' },
              createMarkerElement('Б', true)
            );
            map.addChild(markerEnd);
          }

          mapInstanceRef.current = map;
          setIsMapReady(true);
        } catch (err: unknown) {
          console.warn('Предупреждение: ошибка инициализации ymaps3:', err);
          setIsMapReady(true);
        }
      }
    }

    setupMap();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current?.container?.fitToViewport) {
          try {
            mapInstanceRef.current.container.fitToViewport();
          } catch {
            // Игнорируем
          }
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      isCancelled = true;
      clearTimeout(fallbackTimer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current && typeof mapInstanceRef.current.destroy === 'function') {
        try {
          mapInstanceRef.current.destroy();
        } catch {
          // Игнорируем
        }
        mapInstanceRef.current = null;
      }
    };
  }, [currentPolyline, currentStart, currentEnd, from, to]);

  const hasRouteInfo = Boolean(currentDistance || currentDuration);

  return {
    mapContainerRef,
    isMapReady,
    isLoadingRoute,
    currentDistance,
    currentDuration,
    hasRouteInfo,
  };
}
