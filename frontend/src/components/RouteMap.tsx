import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import PlaceIcon from '@mui/icons-material/Place';
import TimelineIcon from '@mui/icons-material/Timeline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useRouteMap, type UseRouteMapProps } from '../hooks/useRouteMap';

export interface RouteMapProps extends UseRouteMapProps {
  height?: number | string;
  interactive?: boolean;
}

/**
 * Компонент интерактивной карты маршрута поездки на базе Яндекс Карт
 */
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

      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: 1.2,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 70%, transparent)'
              : 'linear-gradient(to top, rgba(255, 255, 255, 0.95) 70%, transparent)',
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
