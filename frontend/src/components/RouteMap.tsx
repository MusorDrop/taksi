import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import PlaceIcon from '@mui/icons-material/Place';
import TimelineIcon from '@mui/icons-material/Timeline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { api } from '../api';
import type { RoutePreviewResponse } from '../types';

export interface RouteMapProps {
  from?: string;
  to?: string;
  polyline?: [number, number][] | null;
  startCoords?: [number, number] | null;
  endCoords?: [number, number] | null;
  distanceKm?: number | null;
  durationMin?: number | null;
  height?: number | string;
  interactive?: boolean;
}

/**
 * Создание HTML-элемента маркера для Яндекс Карт
 * @param label - Текстовая метка (А или Б)
 * @param isDestination - Флаг точки назначения
 * @returns HTMLElement маркера
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
  container.innerText = label;
  return container;
}

/**
 * Расчет центра и границ полилинии для масштабирования карты
 * @param coordinates - Список координат [lon, lat]
 * @returns Объект с центром, зумом и границами
 */
function calculateMapBounds(coordinates: [number, number][]): {
  center: [number, number];
  bounds: [[number, number], [number, number]];
} {
  const lons = coordinates.map((coord: [number, number]): number => coord[0]);
  const lats = coordinates.map((coord: [number, number]): number => coord[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  return {
    center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
    bounds: [
      [minLon, minLat],
      [maxLon, maxLat],
    ],
  };
}

export default function RouteMap({
  from,
  to,
  polyline,
  startCoords,
  endCoords,
  distanceKm,
  durationMin,
  height = 280,
}: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);

  const [currentPolyline, setCurrentPolyline] = useState<[number, number][] | null>(polyline || null);
  const [currentStart, setCurrentStart] = useState<[number, number] | null>(startCoords || null);
  const [currentEnd, setCurrentEnd] = useState<[number, number] | null>(endCoords || null);
  const [currentDistance, setCurrentDistance] = useState<number | null>(distanceKm || null);
  const [currentDuration, setCurrentDuration] = useState<number | null>(durationMin || null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);

  // Синхронизация внешних props при их обновлении
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

  // Загрузка предпросмотра маршрута, если полилиния не передана явно
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

        if (res) {
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
        }
      } catch {
        // При ошибке или отмене запроса сохраняются предыдущие данные
      } finally {
        setIsLoadingRoute(false);
      }
    }

    fetchRoute();

    return () => {
      abortController.abort();
    };
  }, [from, to, polyline]);

  // Инициализация и обновление Яндекс Карт (поддержка API 2.1 и 3.0)
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

      // 1. Проверка Яндекс Карт API 2.1 (window.ymaps)
      const ymaps2 = (window as any).ymaps;
      if (ymaps2 && typeof ymaps2.ready === 'function') {
        ymaps2.ready(() => {
          if (isCancelled || !mapContainerRef.current) {
            return;
          }

          if (mapInstanceRef.current && typeof mapInstanceRef.current.destroy === 'function') {
            try {
              mapInstanceRef.current.destroy();
            } catch {
              // ignore
            }
            mapInstanceRef.current = null;
          }

          mapContainerRef.current.innerHTML = '';

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
            const map = new ymaps2.Map(
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
              const polyCoords21 = activeCoords.map(([lon, lat]: [number, number]): [number, number] => [lat, lon]);
              const polylineGeo = new ymaps2.Polyline(
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
                  map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 30 });
                }
              } catch {
                // ignore bounds error
              }
            }

            const startPt = currentStart || (activeCoords ? activeCoords[0] : null);
            if (startPt) {
              const markerStart = new ymaps2.Placemark(
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
              const markerEnd = new ymaps2.Placemark(
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

            // Адаптация карты под реальные размеры контейнера после рендера
            setTimeout(() => {
              if (map?.container?.fitToViewport) {
                try {
                  map.container.fitToViewport();
                } catch {
                  // Игнорируем возможные ошибки при быстром размонтировании
                }
              }
            }, 150);
          } catch (err) {
            console.warn('Ошибка инициализации ymaps 2.1:', err);
            setIsMapReady(true);
          }
        });
        return;
      }

      // 2. Проверка Яндекс Карт API 3.0 (window.ymaps3)
      const ymaps3Obj = (window as any).ymaps3;
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
              // ignore
            }
            mapInstanceRef.current = null;
          }

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
          console.warn('Ошибка инициализации ymaps3 отложена:', err);
          setIsMapReady(true);
        }
      }
    }

    setupMap();

    // Автоматический пересчет размеров карты при изменении размера контейнера
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current?.container?.fitToViewport) {
          try {
            mapInstanceRef.current.container.fitToViewport();
          } catch {
            // Игнорируем возможные ошибки
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
          // ignore
        }
        mapInstanceRef.current = null;
      }
    };
  }, [currentPolyline, currentStart, currentEnd, from, to]);

  const hasRouteInfo = Boolean(currentDistance || currentDuration);

  return (
    <Box
      onClick={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
      onMouseUp={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
      onPointerDown={(e: React.PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
      onPointerUp={(e: React.PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
      sx={{
        position: 'relative',
        height,
        width: '100%',
        minHeight: 250,
        borderRadius: 3,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #e8eef5 0%, #d5dfe9 50%, #c3d2e3 100%)',
        border: '1px solid',
        borderColor: 'divider',
        m: 0,
        p: 0,
        boxSizing: 'border-box',
      }}
    >
      <Box
        ref={mapContainerRef}
        sx={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          m: 0,
          p: 0,
        }}
      />

      {(!isMapReady || isLoadingRoute) && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: isMapReady ? 'rgba(255, 255, 255, 0.4)' : 'background.paper',
            zIndex: 1,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={22} thickness={4} />
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {isLoadingRoute ? 'Расчет дорожного маршрута...' : 'Загрузка Яндекс Карт...'}
            </Typography>
          </Stack>
        </Box>
      )}

      {hasRouteInfo && (
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 2,
            display: 'flex',
            gap: 0.8,
          }}
        >
          {currentDistance !== null && (
            <Chip
              size="small"
              icon={<TimelineIcon sx={{ fontSize: 14 }} />}
              label={`${currentDistance} км`}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(4px)',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}
            />
          )}
          {currentDuration !== null && (
            <Chip
              size="small"
              icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
              label={`~${currentDuration} мин`}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(4px)',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}
            />
          )}
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: 1.2,
          background: 'linear-gradient(to top, rgba(255,255,255,0.95) 70%, transparent)',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <PlaceIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap>
            {from && to ? `${from} → ${to}` : 'Маршрут на Яндекс Картах'}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

