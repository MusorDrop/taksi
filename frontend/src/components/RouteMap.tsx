import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import TimelineIcon from '@mui/icons-material/Timeline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useRouteMap, type UseRouteMapProps } from '../hooks/useRouteMap';

export interface RouteMapProps extends UseRouteMapProps {
  height?: number | string;
  interactive?: boolean;
}

const YANDEX_MAPS_SCRIPT_ID = 'yandex-maps-api-script';
let scriptLoadingPromise: Promise<void> | null = null;

/**
 * Формирование URL для скрипта API Яндекс Карт с API-ключом из переменных окружения
 */
function getYandexMapsScriptUrl(): string {
  const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY || '';
  return `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
}

/**
 * Подписка на события загрузки скрипта Яндекс Карт с таймаутом
 */
function attachScriptListeners(script: HTMLScriptElement, resolve: () => void): void {
  const timer = setTimeout(() => resolve(), 5000);

  const handleFinish = (): void => {
    clearTimeout(timer);
    if (window.ymaps && typeof window.ymaps.ready === 'function') {
      window.ymaps.ready(() => resolve());
      return;
    }
    resolve();
  };

  script.addEventListener('load', handleFinish, { once: true });
  script.addEventListener('error', () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
}

/**
 * Динамическая вставка скрипта Яндекс Карт в DOM при монтировании компонента
 */
function loadYandexMapsScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.ymaps && typeof window.ymaps.ready === 'function') {
    return new Promise<void>((resolve) => {
      window.ymaps?.ready(() => resolve());
    });
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<void>((resolve) => {
    let script = document.getElementById(YANDEX_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.querySelector<HTMLScriptElement>('script[src*="api-maps.yandex.ru"]');
    }

    if (script) {
      attachScriptListeners(script, resolve);
      return;
    }

    const newScript = document.createElement('script');
    newScript.id = YANDEX_MAPS_SCRIPT_ID;
    newScript.type = 'text/javascript';
    newScript.src = getYandexMapsScriptUrl();
    newScript.async = true;

    attachScriptListeners(newScript, resolve);
    document.head.appendChild(newScript);
  });

  return scriptLoadingPromise;
}

interface RouteMapPlaceholderProps {
  height: number | string;
}

/**
 * Заглушка ожидания загрузки скрипта Яндекс Карт
 */
function RouteMapPlaceholder({ height }: RouteMapPlaceholderProps) {
  return (
    <Box
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        m: 0,
        p: 0,
        boxSizing: 'border-box',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <CircularProgress size={22} thickness={4} />
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          Загрузка Яндекс Карт...
        </Typography>
      </Stack>
    </Box>
  );
}

/**
 * Отображение карты и маршрута после готовности скрипта API
 */
function RouteMapContent({
  from,
  to,
  polyline,
  startCoords,
  endCoords,
  distanceKm,
  durationMin,
  height = 280,
}: RouteMapProps) {
  const {
    mapContainerRef,
    isMapReady,
    isLoadingRoute,
    currentDistance,
    currentDuration,
    hasRouteInfo,
  } = useRouteMap({
    from,
    to,
    polyline,
    startCoords,
    endCoords,
    distanceKm,
    durationMin,
  });

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
        transform: 'translateZ(0)',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
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
            bgcolor: (theme) =>
              isMapReady
                ? (theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)')
                : 'background.paper',
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
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                color: (theme) =>
                  theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
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
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                color: (theme) =>
                  theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                backdropFilter: 'blur(4px)',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * Компонент интерактивной карты с динамической подгрузкой Яндекс Карт при монтировании
 */
export default function RouteMap(props: RouteMapProps) {
  const [isScriptLoaded, setIsScriptLoaded] = useState<boolean>(() => {
    return typeof window !== 'undefined' && Boolean(window.ymaps && typeof window.ymaps.ready === 'function');
  });

  useEffect(() => {
    let isCancelled = false;

    loadYandexMapsScript().then(() => {
      if (!isCancelled) {
        setIsScriptLoaded(true);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  if (!isScriptLoaded) {
    return <RouteMapPlaceholder height={props.height ?? 280} />;
  }

  return <RouteMapContent {...props} />;
}

