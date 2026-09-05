import type { Ride } from './types';

export const PEAK_START = 7 * 60 + 30;
export const PEAK_END = 9 * 60 + 30;
export const PEAK_EVENING_START = 17 * 60;
export const PEAK_EVENING_END = 19 * 60;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Соответствует логике бэкенда: утро 07:30-09:30, вечер 17:00-19:00 */
export function isPeakTime(time: string): boolean {
  const mins = timeToMinutes(time);
  const isMorning = mins >= PEAK_START && mins <= PEAK_END;
  const isEvening = mins >= PEAK_EVENING_START && mins <= PEAK_EVENING_END;
  return isMorning || isEvening;
}

export function formatPrice(price: number): string {
  return `${Math.round(price)} ₽`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function formatSeats(ride: Ride): string {
  if (ride.availableSeats > 0) return `${ride.availableSeats} из ${ride.totalSeats}`;
  return 'Нет мест';
}
