import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import TimelineIcon from '@mui/icons-material/Timeline';
import type { GeoPoint } from '../types';
import YandexRouteMap from './YandexRouteMap';

export interface RouteMapProps {
  from?: string;
  to?: string;
  height?: number;
  /** Известные координаты точки А — маршрут строится точно, без геокодирования по названию */
  fromPoint?: GeoPoint | null;
  /** Известные координаты точки Б */
  toPoint?: GeoPoint | null;
}

/** Ключ JavaScript API Яндекс Карт (задаётся в frontend/.env → VITE_YANDEX_MAPS_APIKEY) */
const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_MAPS_APIKEY?.trim() || '';

/**
 * Карта маршрута. Если настроен VITE_YANDEX_MAPS_APIKEY — настоящая Яндекс-карта
 * с автомобильным маршрутом (см. YandexRouteMap); иначе локальная заглушка-предпросмотр,
 * чтобы UI оставался работоспособным без ключа.
 */
export default function RouteMap(props: RouteMapProps) {
  if (!YANDEX_API_KEY) return <RouteMapPlaceholder {...props} />;
  return <YandexRouteMap apiKey={YANDEX_API_KEY} {...props} />;
}

interface RouteMapPlaceholderProps extends RouteMapProps {
  /** Подсказка в нижней плашке вместо строки «А → Б» */
  note?: string;
}

interface PointPx {
  x: number;
  y: number;
}

/** Проекция пары точек в проценты SVG-бокса (упрощённая равнопромежуточная) */
function projectPoints(
  from?: GeoPoint | null,
  to?: GeoPoint | null,
): { a: PointPx; b: PointPx } | null {
  if (!from || !to) return null;
  const kmPerDegLat = 111.32;
  const kmPerDegLon = (111.32 * Math.cos((from.lat * Math.PI) / 180)) || 1;
  const midLat = (from.lat + to.lat) / 2;
  const midLon = (from.lon + to.lon) / 2;
  const minSpanKm = 1.5;
  const spanLat = Math.max(Math.abs(to.lat - from.lat) * kmPerDegLat, minSpanKm);
  const spanLon = Math.max(Math.abs(to.lon - from.lon) * kmPerDegLon, minSpanKm);
  const px = (p: GeoPoint): PointPx => ({
    x: 50 + (((p.lon - midLon) * kmPerDegLon) / spanLon) * 42,
    y: 50 - (((p.lat - midLat) * kmPerDegLat) / spanLat) * 42,
  });
  return { a: px(from), b: px(to) };
}

/** Круглая метка точки А/Б на заглушке */
function PointBadge({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        width: 26,
        height: 26,
        borderRadius: '50%',
        bgcolor: color,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      {label}
    </Box>
  );
}

function RouteMapPlaceholder({
  from,
  to,
  height = 200,
  note,
  fromPoint,
  toPoint,
}: RouteMapPlaceholderProps) {
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
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(25, 118, 210, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(25, 118, 210, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      {projectPoints(fromPoint, toPoint) ? (
        (() => {
          const pts = projectPoints(fromPoint, toPoint)!;
          return (
            <>
              <svg
                width="100%"
                height="100%"
                style={{ position: 'absolute', inset: 0 }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1565c0" />
                    <stop offset="100%" stopColor="#42a5f5" />
                  </linearGradient>
                </defs>
                <line
                  x1={pts.a.x}
                  y1={pts.a.y}
                  x2={pts.b.x}
                  y2={pts.b.y}
                  stroke="url(#routeGrad)"
                  strokeWidth="2.5"
                  strokeDasharray="5 3"
                  strokeLinecap="round"
                />
              </svg>
              <PointBadge x={pts.a.x} y={pts.a.y} label="А" color="primary.main" />
              <PointBadge x={pts.b.x} y={pts.b.y} label="Б" color="error.main" />
            </>
          );
        })()
      ) : (
        <>
          <Box sx={{ position: 'absolute', top: '20%', left: 0, right: 0, height: 3, bgcolor: 'rgba(255,255,255,0.7)' }} />
          <Box sx={{ position: 'absolute', top: '60%', left: 0, right: 0, height: 2, bgcolor: 'rgba(255,255,255,0.5)' }} />
          <Box sx={{ position: 'absolute', left: '30%', top: 0, bottom: 0, width: 3, bgcolor: 'rgba(255,255,255,0.7)' }} />
          <Box sx={{ position: 'absolute', left: '70%', top: 0, bottom: 0, width: 2, bgcolor: 'rgba(255,255,255,0.5)' }} />

          <svg
            width="100%"
            height="100%"
            style={{ position: 'absolute', inset: 0 }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1565c0" />
                <stop offset="100%" stopColor="#42a5f5" />
              </linearGradient>
            </defs>
            <path
              d="M 15 80 Q 35 60 50 55 T 85 20"
              fill="none"
              stroke="url(#routeGrad)"
              strokeWidth="2.5"
              strokeDasharray="4 2"
              strokeLinecap="round"
            />
          </svg>

          <Box
            sx={{
              position: 'absolute',
              left: '12%',
              bottom: '16%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <MyLocationIcon sx={{ fontSize: 16 }} />
            </Box>
          </Box>

          <Box
            sx={{
              position: 'absolute',
              right: '10%',
              top: '12%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: 'error.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <PlaceIcon sx={{ fontSize: 16 }} />
            </Box>
          </Box>
        </>
      )}

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
            {note ?? (from && to ? `${from} → ${to}` : 'Предпросмотр маршрута на карте')}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
