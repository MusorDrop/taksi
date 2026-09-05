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
