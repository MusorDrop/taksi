import type { GeoPoint } from './types';
import { isPeakTime } from './utils';

// Точки по умолчанию — зеркалят DEFAULT_START / DEFAULT_END в backend
export const DEFAULT_START: GeoPoint = { lat: 56.8885, lon: 60.5975 }; // Уралмаш
export const DEFAULT_END: GeoPoint = { lat: 56.7686, lon: 60.7712 }; // Кампус Новокольцовский

interface KnownLocation {
  name: string;
  aliases: string[];
  point: GeoPoint;
}

export const KNOWN_LOCATIONS: KnownLocation[] = [
  { name: 'Уралмаш', aliases: ['уралмаш'], point: { lat: 56.8885, lon: 60.5975 } },
  { name: 'Кампус Новокольцовский', aliases: ['новокольцовский', 'новокольцовск'], point: { lat: 56.7686, lon: 60.7712 } },
  { name: 'Центр', aliases: ['центр'], point: { lat: 56.8389, lon: 60.6057 } },
  { name: 'Главный корпус УрФУ', aliases: ['урфу', 'втузгородок', 'мира'], point: { lat: 56.8439, lon: 60.6534 } },
  { name: 'Академический', aliases: ['академический'], point: { lat: 56.7865, lon: 60.5186 } },
  { name: 'ЖБИ', aliases: ['жби'], point: { lat: 56.8285, lon: 60.686 } },
];

/** Поиск координат известной локации по тексту */
export function geocode(text: string): GeoPoint | null {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;
  for (const loc of KNOWN_LOCATIONS) {
    if (loc.aliases.some((alias) => lower.includes(alias))) return { ...loc.point };
  }
  return null;
}

const MATCH_KILOMETERS = 3;

/** Обратный поиск: ближайшая известная локация к точке (иначе координаты) */
export function reverseGeocode(point: GeoPoint): string {
  let best: KnownLocation | null = null;
  let bestKm = Infinity;
  for (const loc of KNOWN_LOCATIONS) {
    const km = haversineKm(point, loc.point);
    if (km < bestKm) {
      bestKm = km;
      best = loc;
    }
  }
  if (best && bestKm <= MATCH_KILOMETERS) return best.name;
  return `${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}`;
}

/** Формула гаверсинусов — расстояние между двумя точками в километрах */
export function haversineKm(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (p2.lat - p1.lat) * toRad;
  const dLon = (p2.lon - p1.lon) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.lat * toRad) * Math.cos(p2.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Предпросмотр цены, зеркалит формулу бэкенда: 6 ₽/км, х1.3 в часы пик */
export function estimatePrice(distanceKm: number, time: string): number {
  const ratePerKm = 6;
  const peakMultiplier = isPeakTime(time) ? 1.3 : 1;
  return Math.round(distanceKm * ratePerKm * peakMultiplier * 100) / 100;
}

/** ISO-строка для ближайшего наступления времени HH:MM */
export function nextDepartureIso(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isNaN(h) ? 8 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function localDateTimeToIso(date: string, time: string): string {
  const d = new Date(`${date}T${time || '08:00'}`);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export interface ParsedRideQuery {
  start: GeoPoint | null;
  end: GeoPoint | null;
  startName: string | null;
  endName: string | null;
  time: string | null;
}

/**
 * Примитивный парсер естественного языка (замена LLM на первом этапе):
 * находит упомянутые локации (первая = откуда, вторая = куда) и время "к 8:30".
 */
export function parseNaturalQuery(text: string): ParsedRideQuery {
  const lower = text.toLowerCase().trim();
  if (!lower) {
    return { start: null, end: null, startName: null, endName: null, time: null };
  }

  const timeMatch = lower.match(/(?:в|к|~|около|примерно)\s*(\d{1,2})[:.](\d{2})/) ?? lower.match(/(?:^|\s)(\d{1,2})[:.](\d{2})/);
  const time = timeMatch
    ? `${String(Number(timeMatch[1])).padStart(2, '0')}:${timeMatch[2]}`
    : null;

  const hits: { index: number; loc: KnownLocation }[] = [];
  for (const loc of KNOWN_LOCATIONS) {
    let idx = -1;
    for (const alias of loc.aliases) {
      const found = lower.indexOf(alias);
      if (found !== -1 && (idx === -1 || found < idx)) idx = found;
    }
    if (idx !== -1) hits.push({ index: idx, loc });
  }
  hits.sort((a, b) => a.index - b.index);

  const start = hits[0];
  const end = hits[1];

  return {
    start: start ? { ...start.loc.point } : null,
    end: end ? { ...end.loc.point } : null,
    startName: start ? start.loc.name : null,
    endName: end ? end.loc.name : null,
    time,
  };
}