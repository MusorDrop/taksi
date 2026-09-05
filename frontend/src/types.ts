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
  phone?: string;
  role?: string;
  averageRating?: number | null;
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
  currentPrice: number;
  passengerIds?: string[];
  distanceKm: number;
  isPeak: boolean;
  createdAt: number;
  availableSeats?: number;
  totalSeats?: number;
  vehicleId?: string | null;
  status?: string;
  averageRating?: number | null;
}

export type TabKey = 'find' | 'offer' | 'trips' | 'profile';

/**
 * Модель пользователя, возвращаемая сервером
 */
export interface BackendUser {
  id: string;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role?: string;
  rating?: number | null;
  average_rating?: number | string | null;
  is_verified?: boolean;
}

/**
 * Ответ сервера при авторизации или регистрации
 */
export interface AuthResponse {
  message: string;
  token: string;
  user: BackendUser;
}

/**
 * Модель поездки, возвращаемая сервером
 */
export interface BackendRide {
  id: string;
  driver_id: string;
  vehicle_id?: string | null;
  driver_name: string;
  driver_phone?: string | null;
  driver_rating?: number | null;
  average_rating?: number | string | null;
  departure_time: string;
  start_coords?: { lon: number; lat: number };
  end_coords?: { lon: number; lat: number };
  start_lon?: number;
  start_lat?: number;
  end_lon?: number;
  end_lat?: number;
  distance_km?: number;
  distanceKm?: number;
  is_peak?: boolean;
  isPeak?: boolean;
  base_price: number;
  current_price?: number;
  passenger_ids?: string[];
  total_seats?: number;
  available_seats?: number;
  status?: string;
  created_at?: string;
}

/**
 * Ответ сервера со списком поездок
 */
export interface RidesResponse {
  count: number;
  rides: BackendRide[];
}

/**
 * Модель автомобиля пользователя
 */
export interface Vehicle {
  id: string;
  driver_id: string;
  brand: string;
  color?: string | null;
  license_plate: string;
  created_at?: string;
}

/**
 * Ответ сервера со списком автомобилей
 */
export interface VehiclesResponse {
  count: number;
  vehicles: Vehicle[];
}

/**
 * Модель отзыва о поездке
 */
export interface Review {
  id: string;
  ride_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string | null;
  created_at?: string;
}

/**
 * Ответ сервера со списком отзывов
 */
export interface ReviewsResponse {
  count: number;
  reviews: Review[];
}

