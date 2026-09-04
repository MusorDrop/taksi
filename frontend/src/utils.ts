import type { DayKey } from './types';
import { DAY_SHORT } from './types';

export const PEAK_START = 8 * 60;
export const PEAK_END = 9 * 60 + 30;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function isPeakTime(time: string): boolean {
  const mins = timeToMinutes(time);
  return mins >= PEAK_START && mins <= PEAK_END;
}

export function estimateDistance(from: string, to: string): number {
  const base = 3;
  const fromLen = from.length;
  const toLen = to.length;
  const seed = (fromLen * 7 + toLen * 13) % 10;
  return Math.round((base + seed * 0.8) * 10) / 10;
}

export function calculatePrice(distanceKm: number, time: string): number {
  const baseFare = 1.0;
  const perKm = 0.4;
  let price = baseFare + distanceKm * perKm;
  if (isPeakTime(time)) {
    price *= 1.3;
  }
  return Math.round(price * 100) / 100;
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
