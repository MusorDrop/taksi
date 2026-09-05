import type {
  CreateRidePayload,
  MyTrips,
  Ride,
  RideSearchParams,
  User,
} from './types';

const API_BASE = '/api';
const TOKEN_KEY = 'taksi_token';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage недоступен — сессия живёт только в памяти
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Нет соединения с сервером. Убедитесь, что backend запущен.', 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // тело ответа может быть пустым
  }

  if (!res.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Ошибка запроса (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

// ---- Маппинг полей бэкенда (snake_case) в типы фронтенда (camelCase) ----

interface RawUser {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: User['role'];
  rating: string | null;
  is_verified: boolean;
  created_at: string;
}

interface RawRide {
  id: string;
  driver_id: string;
  driver_name: string | null;
  driver_phone: string | null;
  driver_rating: string | null;
  departure_time: string;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
  distance_km?: string | number;
  distanceKm?: string | number;
  is_peak?: boolean;
  isPeak?: boolean;
  base_price: string | number;
  total_seats: number;
  available_seats: number;
  status: Ride['status'];
  created_at: string;
}

function mapUser(raw: RawUser): User {
  return {
    id: raw.id,
    username: raw.username,
    firstName: raw.first_name,
    lastName: raw.last_name,
    phone: raw.phone,
    role: raw.role,
    rating: raw.rating !== null && raw.rating !== undefined ? Number(raw.rating) : null,
    isVerified: raw.is_verified,
    createdAt: raw.created_at,
  };
}

function mapRide(raw: RawRide): Ride {
  const distanceKm = Number(raw.distanceKm ?? raw.distance_km ?? 0);
  return {
    id: raw.id,
    driverId: raw.driver_id,
    driverName: raw.driver_name || 'Водитель',
    driverPhone: raw.driver_phone,
    driverRating:
      raw.driver_rating !== null && raw.driver_rating !== undefined
        ? Number(raw.driver_rating)
        : null,
    departureTime: raw.departure_time,
    start: { lat: Number(raw.start_lat), lon: Number(raw.start_lon) },
    end: { lat: Number(raw.end_lat), lon: Number(raw.end_lon) },
    distanceKm,
    isPeak: raw.isPeak ?? raw.is_peak ?? false,
    basePrice: Number(raw.base_price),
    totalSeats: raw.total_seats,
    availableSeats: raw.available_seats,
    status: raw.status,
    createdAt: raw.created_at,
  };
}
// ---- Публичное API ----

export interface RegisterPayload {
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: User['role'];
}

/** Вход: сохраняет JWT в localStorage и возвращает профиль пользователя */
export async function apiLogin(username: string, password: string): Promise<User> {
  const data = await request<{ token: string; user: RawUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return mapUser(data.user);
}

/** Регистрация: сохраняет JWT в localStorage и возвращает профиль пользователя */
export async function apiRegister(payload: RegisterPayload): Promise<User> {
  const data = await request<{ token: string; user: RawUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setToken(data.token);
  return mapUser(data.user);
}

export async function apiGetMe(): Promise<User> {
  const data = await request<{ user: RawUser }>('/auth/me');
  return mapUser(data.user);
}

function toQuery(params: RideSearchParams): string {
  const search = new URLSearchParams();
  if (params.start) {
    search.set('start_lat', String(params.start.lat));
    search.set('start_lon', String(params.start.lon));
  }
  if (params.end) {
    search.set('end_lat', String(params.end.lat));
    search.set('end_lon', String(params.end.lon));
  }
  if (params.departureTime) {
    search.set('departure_time', params.departureTime);
  }
  search.set('radius', String(params.radius ?? 1000));

  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function apiListRides(params: RideSearchParams = {}): Promise<Ride[]> {
  const data = await request<{ rides: RawRide[] }>(`/rides${toQuery(params)}`);
  return (data.rides ?? []).map(mapRide);
}

export async function apiCreateRide(payload: CreateRidePayload): Promise<Ride> {
  const body: Record<string, unknown> = {
    start_point: { lat: payload.start.lat, lon: payload.start.lon },
    end_point: { lat: payload.end.lat, lon: payload.end.lon },
    departure_time: payload.departureTime,
    total_seats: payload.totalSeats ?? 4,
  };
  if (payload.price !== undefined) body.price = payload.price;

  const data = await request<{ ride: RawRide }>('/rides', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return mapRide(data.ride);
}

export async function apiJoinRide(rideId: string): Promise<void> {
  await request(`/rides/${encodeURIComponent(rideId)}/join`, { method: 'POST' });
}

export async function apiLeaveRide(rideId: string): Promise<void> {
  await request(`/rides/${encodeURIComponent(rideId)}/leave`, { method: 'POST' });
}

export async function apiMyTrips(): Promise<MyTrips> {
  const data = await request<{
    driver_rides?: RawRide[];
    passenger_rides?: RawRide[];
  }>('/rides/mine');
  return {
    driverRides: (data.driver_rides ?? []).map(mapRide),
    passengerRides: (data.passenger_rides ?? []).map(mapRide),
  };
}