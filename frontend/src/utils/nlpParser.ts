import type { Ride, DayKey } from '../types';
import { getRideDayKey } from '../utils';

export interface ParsedNlpQuery {
  words: string[];
  dayFilter: DayKey | null;
  timeFilter: string | null;
}

export const DAY_NLP_MAP: Record<string, DayKey> = {
  понедельник: 'Mon',
  пн: 'Mon',
  вторник: 'Tue',
  вт: 'Tue',
  среда: 'Wed',
  среду: 'Wed',
  ср: 'Wed',
  четверг: 'Thu',
  чт: 'Thu',
  пятница: 'Fri',
  пт: 'Fri',
  суббота: 'Sat',
  сб: 'Sat',
  воскресенье: 'Sun',
  вс: 'Sun',
  wednesday: 'Wed',
  wed: 'Wed',
  monday: 'Mon',
  tuesday: 'Tue',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

/**
 * Извлекает время в формате HH:mm из текстового токена.
 */
function extractTime(token: string): string | null {
  const timeMatch = token.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
  if (!timeMatch) {
    return null;
  }

  let hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const ampm = timeMatch[3]?.toLowerCase();

  if (ampm === 'pm' && hours < 12) {
    hours += 12;
  }
  if (ampm === 'am' && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Парсит строку запроса естественного языка на токены, день недели и целевое время.
 */
export function parseNlpQuery(query: string): ParsedNlpQuery {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let dayFilter: DayKey | null = null;
  let timeFilter: string | null = null;

  for (const word of words) {
    const lower = word.toLowerCase();
    if (DAY_NLP_MAP[lower]) {
      dayFilter = DAY_NLP_MAP[lower];
    }
    const parsedTime = extractTime(word);
    if (parsedTime) {
      timeFilter = parsedTime;
    }
  }

  return { words, dayFilter, timeFilter };
}

/**
 * Вычисляет релевантность поездки запросу естественного языка.
 */
function calculateRideScore(ride: Ride, parsedQuery: ParsedNlpQuery): number {
  const { words, dayFilter, timeFilter } = parsedQuery;
  let score = 0;

  const fromLower = ride.from.toLowerCase();
  const toLower = ride.to.toLowerCase();
  const driverLower = ride.driverName.toLowerCase();

  for (const word of words) {
    if (fromLower.includes(word)) score++;
    if (toLower.includes(word)) score++;
    if (driverLower.includes(word)) score++;
  }

  if (dayFilter && getRideDayKey(ride) === dayFilter) {
    score += 2;
  }
  if (timeFilter && ride.time === timeFilter) {
    score += 2;
  }

  return score;
}

/**
 * Фильтрует список поездок по запросу на естественном языке с учетом текстового сходства, дня недели и времени.
 */
export function filterRidesByNlpQuery(rides: Ride[], query: string): Ride[] {
  if (!query.trim()) {
    return rides;
  }

  const parsedQuery = parseNlpQuery(query);
  const { words, dayFilter, timeFilter } = parsedQuery;

  return rides.filter((ride) => {
    const score = calculateRideScore(ride, parsedQuery);
    const fromLower = ride.from.toLowerCase();
    const toLower = ride.to.toLowerCase();
    const driverLower = ride.driverName.toLowerCase();

    const hasTextMatch = words.some(
      (word) => fromLower.includes(word) || toLower.includes(word) || driverLower.includes(word),
    );

    return score > 0 || hasTextMatch || (!dayFilter && !timeFilter && words.length === 0);
  });
}
