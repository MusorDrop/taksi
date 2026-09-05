import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { Ride, User, BackendRide, BackendUser, RidesResponse } from './types';
import { MOCK_RIDES, MOCK_USER } from './mockData';
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
  addRide: (ride: Omit<Ride, 'id' | 'createdAt' | 'driverId' | 'driverName'>) => Promise<void> | void;
  passengerRideIds: string[];
  joinRide: (rideId: string) => Promise<void> | void;
  leaveRide: (rideId: string) => Promise<void> | void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [rides, setRides] = useState<Ride[]>(MOCK_RIDES);
  const [isRidesLoading, setIsRidesLoading] = useState<boolean>(false);
  const [ridesError, setRidesError] = useState<string | null>(null);
  const [passengerRideIds, setPassengerRideIds] = useState<string[]>(['r3', 'r7']);

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
    setUser({ ...MOCK_USER, name: name || MOCK_USER.name });
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
      if (response?.rides && response.rides.length > 0) {
        const mapped = response.rides.map(mapBackendRideToRide);
        setRides(mapped);
      }
    } catch (err: unknown) {
      if (signal?.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Не удалось загрузить поездки';
      setRidesError(message);
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
    async (rideData: Omit<Ride, 'id' | 'createdAt' | 'driverId' | 'driverName'>): Promise<void> => {
      if (!user) {
        return;
      }

      try {
        const payload = {
          from: rideData.from,
          to: rideData.to,
          time: rideData.time,
          departure_time: rideData.time,
          price: rideData.price,
          base_price: rideData.price,
          total_seats: 4,
        };
        const response = await api.post<{ message: string; ride: BackendRide }>('/api/rides', payload);
        if (response?.ride) {
          const newRide = mapBackendRideToRide(response.ride);
          setRides((prev) => [newRide, ...prev]);
          return;
        }
      } catch {
        // Сохраняем локально при сетевой ошибке
      }

      const fallbackRide: Ride = {
        ...rideData,
        id: `r_${Date.now()}`,
        createdAt: Date.now(),
        driverId: user.id,
        driverName: user.name,
      };
      setRides((prev) => [fallbackRide, ...prev]);
    },
    [user],
  );

  const joinRide = useCallback(async (rideId: string): Promise<void> => {
    setPassengerRideIds((prev) => (prev.includes(rideId) ? prev : [...prev, rideId]));
    try {
      await api.post(`/api/rides/${rideId}/join`);
    } catch {
      // Локальное сохранение состояния
    }
  }, []);

  const leaveRide = useCallback(async (rideId: string): Promise<void> => {
    setPassengerRideIds((prev) => prev.filter((id) => id !== rideId));
    try {
      await api.post(`/api/rides/${rideId}/leave`);
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
