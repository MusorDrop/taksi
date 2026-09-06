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

export interface PassengerInfo {
  id: string;
  name?: string;
  username?: string;
  telegram?: string;
  phone?: string | null;
  avatar_url?: string | null;
  selected_day?: string | null;
}

export interface User {
  id: string;
  name: string;
  telegram: string;
  phone?: string;
  role?: string;
  averageRating?: number | null;
  avatar_url?: string | null;
  is_blocked?: boolean;
}

/**
 * Сведения об автомобиле поездки
 */
export interface VehicleDetails {
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  plate_number?: string | null;
}

export interface Ride {
  id: string;
  driverId: string;
  driverName: string;
  driverUsername?: string | null;
  driverPhone?: string | null;
  vehicle?: VehicleDetails | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  plate_number?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  vehiclePlateNumber?: string | null;
  from: string;
  to: string;
  dateFormatted: string;
  dateString?: string;
  departure_time?: string;
  departureTime?: string;
  time: string;
  telegram: string;
  price: number;
  currentPrice: number;
  passengerIds?: string[];
  passengers?: PassengerInfo[];
  distanceKm: number;
  isPeak: boolean;
  createdAt: number;
  availableSeats?: number;
  totalSeats?: number;
  vehicleId?: string | null;
  status?: string;
  rideType?: 'one_off' | 'regular';
  ride_type?: 'one_off' | 'regular';
  regularDays?: string | null;
  regular_days?: string | null;
  averageRating?: number | null;
  driverRating?: number | null;
  driver_rating?: number | null;
  driverReviewsCount?: number;
  driver_reviews_count?: number;
  description?: string | null;
  tags?: string[];
  driverAvatarUrl?: string | null;
  startLon?: number;
  startLat?: number;
  endLon?: number;
  endLat?: number;
  startCoords?: { lon: number; lat: number };
  endCoords?: { lon: number; lat: number };
  polyline?: [number, number][];
  durationMin?: number;
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
  avatar_url?: string | null;
  is_blocked?: boolean;
  created_at?: string;
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
  vehicle?: VehicleDetails | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  plate_number?: string | null;
  vehicle_brand?: string | null;
  vehicle_color?: string | null;
  vehicle_license_plate?: string | null;
  vehicle_seats?: number | null;
  driver_name: string;
  driver_username?: string | null;
  driver_phone?: string | null;
  driver_rating?: number | null;
  driver_reviews_count?: number;
  average_rating?: number | string | null;
  driver_avatar_url?: string | null;
  description?: string | null;
  tags?: string[];
  departure_time: string;
  start_address?: string;
  end_address?: string;
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
  passengers?: PassengerInfo[];
  total_seats?: number;
  available_seats?: number;
  status?: string;
  ride_type?: 'one_off' | 'regular';
  regular_days?: string | null;
  polyline?: [number, number][];
  duration_min?: number;
  created_at?: string;
}

/**
 * Ответ сервера на расчет предварительного маршрута
 */
export interface RoutePreviewResponse {
  start?: { lon: number; lat: number; name?: string };
  end?: { lon: number; lat: number; name?: string };
  from?: { lon: number; lat: number; address?: string };
  to?: { lon: number; lat: number; address?: string };
  start_coords?: { lon: number; lat: number };
  end_coords?: { lon: number; lat: number };
  distance_km?: number;
  distanceKm?: number;
  distance_meters?: number;
  duration_min?: number;
  durationMin?: number;
  duration_seconds?: number;
  price?: number;
  base_price?: number;
  is_peak?: boolean;
  isPeak?: boolean;
  polyline?: [number, number][] | { coordinates?: [number, number][] };
  route_polyline?: [number, number][] | { coordinates?: [number, number][] };
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
  seats?: number;
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
  reviewer_username?: string | null;
  reviewer_first_name?: string | null;
  created_at?: string;
}

/**
 * Ответ сервера со списком отзывов
 */
export interface ReviewsResponse {
  count: number;
  reviews: Review[];
}

/**
 * Модель поездки для панели администратора
 */
export interface AdminRide {
  id: string;
  driver_id: string;
  vehicle_id?: string | null;
  driver_username?: string | null;
  driver_first_name?: string | null;
  driver_last_name?: string | null;
  driver_avatar_url?: string | null;
  departure_time: string;
  start_lon?: number | null;
  start_lat?: number | null;
  end_lon?: number | null;
  end_lat?: number | null;
  total_seats: number;
  available_seats: number;
  status: string;
  base_price: number;
  created_at?: string;
}

/**
 * Модель автомобиля для панели администратора
 */
export interface AdminVehicle extends Vehicle {
  driver_username?: string | null;
  driver_first_name?: string | null;
}

/**
 * Ответ сервера на запрос списка пользователей в админке
 */
export interface AdminUsersResponse {
  count: number;
  users: BackendUser[];
}

/**
 * Ответ сервера на запрос списка поездок в админке
 */
export interface AdminRidesResponse {
  count: number;
  rides: AdminRide[];
}

/**
 * Ответ сервера на запрос списка автомобилей в админке
 */
export interface AdminVehiclesResponse {
  count: number;
  vehicles: AdminVehicle[];
}

/**
 * Географическая точка с координатами и адресом, возвращаемая AI парсером
 */
export interface AiParsedPoint {
  lat: number;
  lon: number;
  address: string;
}

/**
 * Распарсенные данные поездки от сервиса GigaChat AI
 */
export interface AiParsedRide {
  role?: 'passenger' | 'driver' | null;
  from?: string | null;
  to?: string | null;
  date?: string | null;
  time?: string | null;
  departure_time?: string | null;
  price?: number | null;
  seats?: number | null;
  comment?: string | null;
  tags?: string[] | null;
  start_point?: AiParsedPoint | null;
  end_point?: AiParsedPoint | null;
}

/**
 * Ответ сервиса GigaChat AI на запрос распознавания параметров поездки
 */
export interface AiParseResponse extends AiParsedRide {
  success: boolean;
  parsed?: AiParsedRide;
}

/**
 * Параметры фильтрации поездок на экране поиска
 */
export interface RideSearchFilters {
  from: string;
  to: string;
  date: string;
  time: string;
}

