export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export const DAY_KEYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DAY_SHORT: Record<DayKey, string> = {
  Mon: 'Пн',
  Tue: 'Вт',
  Wed: 'Ср',
  Thu: 'Чт',
  Fri: 'Пт',
  Sat: 'Сб',
  Sun: 'Вс',
};

export const DAY_FULL: Record<DayKey, string> = {
  Mon: 'Понедельник',
  Tue: 'Вторник',
  Wed: 'Среда',
  Thu: 'Четверг',
  Fri: 'Пятница',
  Sat: 'Суббота',
  Sun: 'Воскресенье',
};

export interface User {
  id: string;
  name: string;
  telegram: string;
}

export interface Ride {
  id: string;
  driverId: string;
  driverName: string;
  from: string;
  to: string;
  days: DayKey[];
  time: string;
  telegram: string;
  price: number;
  distanceKm: number;
  isPeak: boolean;
  createdAt: number;
}

export type TabKey = 'find' | 'offer' | 'trips' | 'profile';
