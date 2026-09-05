/**
 * Реальная карта на JavaScript API Яндекс Карт 2.1 (модуль multiRouter).
 * Точки приходят уже геокодированными (словарь + геокодер на бэкенде), поэтому
 * метки А/Б видны всегда, а маршрут строится по координатам.
 * Загрузка API и типы — в ../ymaps.
 */
import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import TimelineIcon from '@mui/icons-material/Timeline';
import type { RouteMapProps } from './RouteMap';
import {
  EKATERINBURG_CENTER,
  loadYmaps,
  type YMap,
  type YMultiRoute,
  type YPlacemark,
} from '../ymaps';

interface YandexRouteMapProps extends RouteMapProps {
  apiKey: string;
}

/** Задержка перед перестроением маршрута, чтобы не дёргать карту на каждое нажатие клавиши */
const ROUTE_DEBOUNCE_MS = 500;

/** Человекочитаемое описание маршрута: время в пути и расстояние */
function describeRoute(route: YMultiRoute): string {
  try {
    const withApi = route as YMultiRoute & {
      getActiveRoute?():
        | {
            properties: {
              get(key: 'duration' | 'distance'): { text?: string } | undefined;
            };
          }
        | undefined;
    };
    const active = withApi.getActiveRoute?.();
    if (!active) return 'Маршрут построен';
    const duration = active.properties.get('duration')?.text;
    const distance = active.properties.get('distance')?.text;
    if (duration && distance) return `≈ ${duration} · ${distance}`;
    if (duration) return `≈ ${duration}`;
    return 'Маршрут построен';
  } catch {
    return 'Маршрут построен';
  }
}

export default function YandexRouteMap({
  from,
  to,
  height = 200,
  fromPoint,
  toPoint,
  apiKey,
}: YandexRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMap | null>(null);
  const routeRef = useRef<YMultiRoute | null>(null);
  const placemarkARef = useRef<YPlacemark | null>(null);
  const placemarkBRef = useRef<YPlacemark | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [routeStatus, setRouteStatus] = useState('');

  // Карта создаётся один раз при монтировании; в cleanup уничтожается (учтён StrictMode)
  useEffect(() => {
    let cancelled = false;
    loadYmaps(apiKey)
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new ymaps.Map(
          containerRef.current,
          { center: EKATERINBURG_CENTER, zoom: 11, controls: ['zoomControl'] },
          { suppressMapOpenBlock: true },
        );
        setMapReady(true);
      })
      .catch((err: unknown) => {
        console.warn('[RouteMap]', err instanceof Error ? err.message : err);
        setMapFailed(true);
      });
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      routeRef.current = null;
      placemarkARef.current = null;
      placemarkBRef.current = null;
    };
  }, [apiKey]);

  // Метки и маршрут перестраиваются с дебаунсом при изменении точек.
  // Маршрут строится только по координатам (текст геокодирует бэкенд), поэтому
  // метки А/Б остаются на карте даже если сервис маршрутов недоступен.
  useEffect(() => {
    if (!mapReady) return undefined;
    const timer = setTimeout(rebuild, ROUTE_DEBOUNCE_MS);
    return () => clearTimeout(timer);

    function rebuild(): void {
      const map = mapRef.current;
      const ymaps = window.ymaps;
      if (!map || !ymaps) return;

      const dropAll = (): void => {
        for (const ref of [routeRef, placemarkARef, placemarkBRef]) {
          if (ref.current) {
            map.geoObjects.remove(ref.current);
            ref.current = null;
          }
        }
      };

      const makePlacemark = (
        coords: [number, number],
        label: 'А' | 'Б',
        title: string | undefined,
      ): YPlacemark =>
        new ymaps.Placemark(
          coords,
          { balloonContent: `Точка ${label}${title ? `: ${title}` : ''}` },
          { preset: label === 'А' ? 'islands/blue-circle-dot' : 'islands/red-circle-dot' },
        );

      const coordsA: [number, number] | null = fromPoint
        ? [fromPoint.lat, fromPoint.lon]
        : null;
      const coordsB: [number, number] | null = toPoint ? [toPoint.lat, toPoint.lon] : null;

      // Обе точки известны — обе метки + автомобильный маршрут
      if (coordsA && coordsB) {
        dropAll();
        const placemarkA = makePlacemark(coordsA, 'А', from);
        const placemarkB = makePlacemark(coordsB, 'Б', to);
        placemarkARef.current = placemarkA;
        placemarkBRef.current = placemarkB;
        map.geoObjects.add(placemarkA);
        map.geoObjects.add(placemarkB);

        setRouteStatus('Строим маршрут…');
        const multiRoute = new ymaps.multiRouter.MultiRoute(
          { referencePoints: [coordsA, coordsB], params: { routingMode: 'auto' } },
          {
            boundsAutoApply: true,
            routeStrokeColor: '#9dc3f0',
            routeActiveStrokeColor: '#1565c0',
            routeActiveStrokeWidth: 5,
          },
        );
        routeRef.current = multiRoute;
        map.geoObjects.add(multiRoute);
        multiRoute.model.events.add('requestsuccess', () => {
          if (routeRef.current === multiRoute) setRouteStatus(describeRoute(multiRoute));
        });
        multiRoute.model.events.add('requestfail', (e) => {
          if (routeRef.current !== multiRoute) return;
          const detail = e.get('error');
          const message =
            typeof detail === 'object' && detail !== null && 'message' in detail
              ? String((detail as { message?: unknown }).message)
              : 'Не удалось построить маршрут';
          setRouteStatus(`${message} — точки отмечены метками`);
        });
        return;
      }

      // Известна одна точка — метка + центрирование карты
      const single = coordsA ?? coordsB;
      if (single) {
        dropAll();
        const isStart = coordsA !== null;
        const placemark = makePlacemark(single, isStart ? 'А' : 'Б', isStart ? from : to);
        if (isStart) placemarkARef.current = placemark;
        else placemarkBRef.current = placemark;
        map.geoObjects.add(placemark);
        map.setCenter(single, 14);
        setRouteStatus(
          isStart
            ? 'Точка А отмечена на карте — укажите пункт Б'
            : 'Точка Б отмечена на карте — укажите пункт А',
        );
        return;
      }

      // Точки не заданы — общий вид Екатеринбурга
      dropAll();
      map.setCenter(EKATERINBURG_CENTER, 11);
      setRouteStatus('Укажите точки А и Б — построим маршрут');
    }
  }, [mapReady, from, to, fromPoint, toPoint]);

  // API не загрузился (нет сети, отозванный ключ) — деградируем до простого предпросмотра
  if (mapFailed) {
    return (
      <Box
        sx={{
          position: 'relative',
          height,
          width: '100%',
          borderRadius: 3,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #e8eef5 0%, #d5dfe9 50%, #c3d2e3 100%)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: 1.5,
            background: 'linear-gradient(to top, rgba(255,255,255,0.95) 60%, transparent)',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <TimelineIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              {from && to ? `${from} → ${to}` : 'Предпросмотр маршрута на карте'}
            </Typography>
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        width: '100%',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Сюда монтируется карта Яндекс (ymaps.Map) */}
      <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />

      {!mapReady && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            bgcolor: '#e8eef5',
          }}
        >
          <CircularProgress size={28} />
          <Typography variant="caption" color="text.secondary">
            Загружаем Яндекс Карты…
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: 1.5,
          background: 'linear-gradient(to top, rgba(255,255,255,0.95) 60%, transparent)',
          pointerEvents: 'none',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <TimelineIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            {routeStatus || (from && to ? `${from} → ${to}` : 'Маршрут на Яндекс Карте')}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
