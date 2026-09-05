export interface GeoPoint {
  lat: number;
  lon: number;
}

export type UserRole = 'driver' | 'passenger' | 'both';

export interface User {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  telegramUsername: string | null;
  role: UserRole;
  rating: number | null;
  isVerified: boolean;
  createdAt: string;
}

export type RideStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Ride {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone: string | null;
  driverTelegramUsername: string | null;
  driverRating: number | null;
  departureTime: string;
  start: GeoPoint;
  end: GeoPoint;
  distanceKm: number;
  isPeak: boolean;
  basePrice: number;
  totalSeats: number;
  availableSeats: number;
  status: RideStatus;
  createdAt: string;
}

export interface MyTrips {
  driverRides: Ride[];
  passengerRides: Ride[];
}

export interface RideSearchParams {
  start?: GeoPoint | null;
  end?: GeoPoint | null;
  radius?: number;
  departureTime?: string;
}

export interface CreateRidePayload {
  start: GeoPoint;
  end: GeoPoint;
  departureTime: string;
  totalSeats?: number;
  price?: number;
}

/** Пассажир поездки (виден водителю в «Мои поездки») */
export interface RidePassenger {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  rating: number | null;
  telegramUsername: string | null;
  joinedAt: string;
}

export type TabKey = 'find' | 'offer' | 'trips' | 'profile';
