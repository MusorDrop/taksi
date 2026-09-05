import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { Ride, User, BackendRide, BackendUser, RidesResponse } from './types';
import { api, getAuthToken, setAuthToken, removeAuthToken } from './api';
import { mapBackendRideToRide } from './utils';

export interface AppContextValue {
  user: User | null;
  isAuthLoading: boolean;
  login: (name: string) => void;
  loginWithData: (token: string, backendUser: BackendUser) => void;
  logout: () => void;
  rides: Ride[];
  isRidesLoading: boolean;
  ridesError: string | null;
  fetchRides: (signal?: AbortSignal) => Promise<void>;
  addRide: (ride: Omit<Ride, 'id' | 'createdAt' | 'driverId' | 'driverName' | 'currentPrice'>) => Promise<void> | void;
  passengerRideIds: string[];
  joinRide: (rideId: string) => Promise<void> | void;
  leaveRide: (rideId: string) => Promise<void> | void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [rides, setRides] = useState<Ride[]>([]);
  const [isRidesLoading, setIsRidesLoading] = useState<boolean>(false);
  const [ridesError, setRidesError] = useState<string | null>(null);
  const [passengerRideIds, setPassengerRideIds] = useState<string[]>([]);

  // Проверка существующего токена при инициализации приложения
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function checkExistingToken(): Promise<void> {
      const token = getAuthToken();
      if (!token) {
        setIsAuthLoading(false);
        return;
      }

      try {
        const response = await api.get<{ user: BackendUser }>('/api/auth/me', {
          signal: controller.signal,
        });
        if (isMounted && response?.user) {
          setUser({
            id: response.user.id,
            name: response.user.first_name || response.user.username,
            telegram: response.user.username,
            phone: response.user.phone ?? undefined,
            role: response.user.role,
          });
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        removeAuthToken();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    checkExistingToken();

    const handleUnauthorizedEvent = (): void => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorizedEvent);

    return () => {
      isMounted = false;
      controller.abort();
      window.removeEventListener('auth:unauthorized', handleUnauthorizedEvent);
    };
  }, []);

  const loginWithData = useCallback((token: string, backendUser: BackendUser): void => {
    setAuthToken(token);
    setUser({
      id: backendUser.id,
      name: backendUser.first_name || backendUser.username,
      telegram: backendUser.username,
      phone: backendUser.phone ?? undefined,
      role: backendUser.role,
    });
  }, []);

  const login = useCallback((name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUser({
      id: `u_${Date.now()}`,
      name: trimmed,
      telegram: trimmed.toLowerCase().replace(/\s+/g, ''),
    });
  }, []);

  const logout = useCallback((): void => {
    removeAuthToken();
    setUser(null);
  }, []);

  // Загрузка списка поездок из API
  const fetchRides = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setIsRidesLoading(true);
    setRidesError(null);
    try {
      const response = await api.get<RidesResponse>('/api/rides', { signal });
      if (response && Array.isArray(response.rides)) {
        const mapped = response.rides.map(mapBackendRideToRide);
        setRides(mapped);
      } else {
        setRides([]);
      }
    } catch (err: unknown) {
      if (signal?.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Не удалось загрузить поездки';
      setRidesError(message);
      setRides([]);
    } finally {
      setIsRidesLoading(false);
    }
  }, []);

  // Первоначальная загрузка поездок при монтировании контекста
  useEffect(() => {
    const controller = new AbortController();
    fetchRides(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchRides]);

  const addRide = useCallback(
    async (rideData: Omit<Ride, 'id' | 'createdAt' | 'driverId' | 'driverName' | 'currentPrice'>): Promise<void> => {
      if (!user) {
        throw new Error('Для публикации поездки необходимо авторизоваться');
      }

      const payload: Record<string, unknown> = {
        from: rideData.from,
        to: rideData.to,
        time: rideData.time,
        departure_time: rideData.time,
        price: rideData.price,
        base_price: rideData.price,
        total_seats: rideData.totalSeats || 4,
      };

      if (rideData.vehicleId) {
        payload.vehicle_id = rideData.vehicleId;
      }

      const response = await api.post<{ message: string; ride: BackendRide }>('/api/rides', payload);
      if (response?.ride) {
        const newRide = mapBackendRideToRide(response.ride);
        setRides((prev) => [newRide, ...prev]);
      }
    },
    [user],
  );

  const joinRide = useCallback(async (rideId: string): Promise<void> => {
    setPassengerRideIds((prev) => (prev.includes(rideId) ? prev : [...prev, rideId]));
    try {
      const response = await api.post<{
        message: string;
        available_seats?: number;
        current_price?: number;
        passenger_ids?: string[];
      }>(`/api/rides/${rideId}/join`);

      if (response) {
        setRides((prev) =>
          prev.map((r) => {
            if (r.id !== rideId) return r;
            const updatedSeats = response.available_seats !== undefined
              ? response.available_seats
              : Math.max(0, (r.availableSeats ?? 1) - 1);
            const updatedPrice = response.current_price !== undefined
              ? response.current_price
              : r.currentPrice;
            const updatedPassengerIds = response.passenger_ids ?? r.passengerIds;
            return {
              ...r,
              availableSeats: updatedSeats,
              currentPrice: updatedPrice,
              passengerIds: updatedPassengerIds,
            };
          }),
        );
      }
    } catch {
      // Локальное сохранение состояния
    }
  }, []);

  const leaveRide = useCallback(async (rideId: string): Promise<void> => {
    setPassengerRideIds((prev) => prev.filter((id) => id !== rideId));
    try {
      const response = await api.post<{
        message: string;
        available_seats?: number;
        current_price?: number;
        passenger_ids?: string[];
      }>(`/api/rides/${rideId}/leave`);

      if (response) {
        setRides((prev) =>
          prev.map((r) => {
            if (r.id !== rideId) return r;
            const updatedSeats = response.available_seats !== undefined
              ? response.available_seats
              : (r.availableSeats ?? 0) + 1;
            const updatedPrice = response.current_price !== undefined
              ? response.current_price
              : r.currentPrice;
            const updatedPassengerIds = response.passenger_ids ?? r.passengerIds;
            return {
              ...r,
              availableSeats: updatedSeats,
              currentPrice: updatedPrice,
              passengerIds: updatedPassengerIds,
            };
          }),
        );
      }
    } catch {
      // Локальное сохранение состояния
    }
  }, []);

  const contextValue = useMemo<AppContextValue>(
    () => ({
      user,
      isAuthLoading,
      login,
      loginWithData,
      logout,
      rides,
      isRidesLoading,
      ridesError,
      fetchRides,
      addRide,
      passengerRideIds,
      joinRide,
      leaveRide,
    }),
    [
      user,
      isAuthLoading,
      login,
      loginWithData,
      logout,
      rides,
      isRidesLoading,
      ridesError,
      fetchRides,
      addRide,
      passengerRideIds,
      joinRide,
      leaveRide,
    ],
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
