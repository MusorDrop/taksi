import type { DayKey } from './types';
import { DAY_SHORT } from './types';

// Morning campus rush: 08:00–09:30
export const PEAK_MORNING_START = 8 * 60;
export const PEAK_MORNING_END = 9 * 60 + 30;
// Evening campus rush: 17:30–19:00
export const PEAK_EVENING_START = 17 * 60 + 30;
export const PEAK_EVENING_END = 19 * 60;

// Used by the AI recommendation when no route distance has been resolved yet
// (e.g. the "Откуда"/"Куда" fields are still empty).
export const AI_DEFAULT_BASE_PRICE = 150;
// Simulated traffic/demand surge applied during peak windows.
export const AI_PEAK_SURGE_MULTIPLIER = 1.3;
// Recommendations are rounded to a clean, human-friendly step.
export const AI_PRICE_ROUNDING_STEP = 5;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function isPeakTime(time: string): boolean {
  const mins = timeToMinutes(time);
  const isMorningPeak = mins >= PEAK_MORNING_START && mins <= PEAK_MORNING_END;
  const isEveningPeak = mins >= PEAK_EVENING_START && mins <= PEAK_EVENING_END;
  return isMorningPeak || isEveningPeak;
}

export function estimateDistance(from: string, to: string): number {
  const base = 3;
  const fromLen = from.length;
  const toLen = to.length;
  const seed = (fromLen * 7 + toLen * 13) % 10;
  return Math.round((base + seed * 0.8) * 10) / 10;
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * AI smart price recommendation for drivers.
 *
 * - Base fare comes from the resolved route distance (6₽/km).
 * - Falls back to a flat AI_DEFAULT_BASE_PRICE while the route hasn't resolved
 *   to a distance yet (e.g. "Откуда"/"Куда" not filled in).
 * - During simulated peak-hour traffic, a surge multiplier is applied.
 * - The result is always rounded to a clean step for a nicer-looking suggestion.
 */
export function getAiRecommendedPrice(distanceKm: number | null | undefined, time: string): number {
  const baseFare =
    distanceKm && distanceKm > 0 ? distanceKm * 6 : AI_DEFAULT_BASE_PRICE;
  const withSurge = isPeakTime(time) ? baseFare * AI_PEAK_SURGE_MULTIPLIER : baseFare;
  return roundToStep(withSurge, AI_PRICE_ROUNDING_STEP);
}

export function formatDays(days: DayKey[]): string {
  if (days.length === 7) return 'Ежедневно';
  if (days.length === 5) {
    const weekdaySet: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    if (weekdaySet.every((d) => days.includes(d))) return 'Будни';
  }
  if (days.length === 0) return 'Дни не выбраны';
  return days.map((d) => DAY_SHORT[d]).join(', ');
}

export function formatPrice(price: number): string {
  return `${price.toFixed(0)} ₽`;
}

/**
 * Определение читаемого названия локации по координатам
 * @param lon - Долгота
 * @param lat - Широта
 * @param fallbackName - Название по умолчанию
 */
export function resolveCoordsToName(lon?: number, lat?: number, fallbackName: string = 'Локация'): string {
  if (lon === undefined || lat === undefined || isNaN(lon) || isNaN(lat)) {
    return fallbackName;
  }

  const KNOWN_POINTS: Array<{ name: string; lon: number; lat: number }> = [
    { name: 'Уралмаш', lon: 60.5975, lat: 56.8885 },
    { name: 'Кампус Новокольцовский', lon: 60.7712, lat: 56.7686 },
    { name: 'Центр', lon: 60.6057, lat: 56.8389 },
    { name: 'Главный корпус УрФУ', lon: 60.6534, lat: 56.8439 },
    { name: 'Втузгородок', lon: 60.6530, lat: 56.8430 },
    { name: 'Академический', lon: 60.5186, lat: 56.7865 },
    { name: 'ЖБИ', lon: 60.6860, lat: 56.8285 },
  ];

  for (const point of KNOWN_POINTS) {
    const dLon = point.lon - lon;
    const dLat = point.lat - lat;
    const distSquared = dLon * dLon + dLat * dLat;
    if (distSquared < 0.005) {
      return point.name;
    }
  }

  return fallbackName;
}

/**
 * Преобразование модели поездки с бэкенда в формат интерфейса фронтенда
 * @param backendRide - Модель поездки из ответа API
 */
export function mapBackendRideToRide(backendRide: import('./types').BackendRide): import('./types').Ride {
  const departureDate = new Date(backendRide.departure_time);
  const isValidDate = !isNaN(departureDate.getTime());

  const hours = isValidDate ? String(departureDate.getHours()).padStart(2, '0') : '08';
  const minutes = isValidDate ? String(departureDate.getMinutes()).padStart(2, '0') : '00';
  const time = `${hours}:${minutes}`;

  const dayIndex = isValidDate ? departureDate.getDay() : 1;
  const dayKeys: import('./types').DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = dayKeys[dayIndex] || 'Mon';

  const price = Number(backendRide.base_price || 0);
  const passengerIds = Array.isArray(backendRide.passenger_ids) ? backendRide.passenger_ids : [];
  const currentPrice = backendRide.current_price !== undefined && backendRide.current_price !== null
    ? Number(backendRide.current_price)
    : Math.ceil(price / Math.max(passengerIds.length, 1));

  return {
    id: backendRide.id,
    driverId: backendRide.driver_id,
    driverName: backendRide.driver_name || 'Водитель',
    from: resolveCoordsToName(backendRide.start_lon, backendRide.start_lat, 'Уралмаш'),
    to: resolveCoordsToName(backendRide.end_lon, backendRide.end_lat, 'Кампус Новокольцовский'),
    days: [day],
    time,
    telegram: backendRide.driver_phone
      ? backendRide.driver_phone.replace('+', '')
      : (backendRide.driver_name ? backendRide.driver_name.toLowerCase().replace(/\s+/g, '') : 'campus_driver'),
    price,
    currentPrice,
    passengerIds,
    distanceKm: Number(backendRide.distance_km ?? backendRide.distanceKm ?? 5.0),
    isPeak: Boolean(backendRide.is_peak ?? backendRide.isPeak),
    createdAt: backendRide.created_at ? new Date(backendRide.created_at).getTime() : Date.now(),
    availableSeats: backendRide.available_seats,
    totalSeats: backendRide.total_seats,
    vehicleId: backendRide.vehicle_id || null,
    status: backendRide.status || 'scheduled',
    averageRating: backendRide.average_rating ? Number(backendRide.average_rating) : null,
  };
}

