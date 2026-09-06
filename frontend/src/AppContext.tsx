import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { Ride, User, BackendRide, BackendUser, RidesResponse, PassengerInfo } from './types';
import { api, getAuthToken, setAuthToken, removeAuthToken } from './api';
import { mapBackendRideToRide } from './utils';

export interface AppContextValue {
  user: User | null;
  isAuthLoading: boolean;
  login: (name: string) => void;
  loginWithData: (token: string, backendUser: BackendUser) => void;
  updateUser: (fields: Partial<User>) => void;
  logout: () => void;
  rides: Ride[];
  isRidesLoading: boolean;
  ridesError: string | null;
  fetchRides: (signal?: AbortSignal, silent?: boolean) => Promise<void>;
  addRide: (ride: Omit<Ride, 'id' | 'createdAt' | 'driverId' | 'driverName' | 'currentPrice'>) => Promise<void> | void;
  updateRide: (rideId: string, payload: Record<string, unknown>) => Promise<void>;
  kickPassenger: (rideId: string, passengerId: string) => Promise<void>;
  passengerRideIds: string[];
  joinRide: (rideId: string, selectedDay?: string) => Promise<void> | void;
  leaveRide: (rideId: string) => Promise<void> | void;
  deleteRide: (rideId: string) => Promise<void>;
  startRide: (rideId: string) => Promise<void>;
  finishRide: (rideId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [rides, setRides] = useState<Ride[]>([]);
  const [isRidesLoading, setIsRidesLoading] = useState<boolean>(false);
  const [ridesError, setRidesError] = useState<string | null>(null);
  // Вычисление идентификаторов забронированных поездок текущего пользователя на лету
  const passengerRideIds = useMemo<string[]>(() => {
    if (!user) return [];
    return rides
      .filter((r) => Boolean(r.passengerIds?.includes(user.id)))
      .map((r) => r.id);
  }, [rides, user]);

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
            avatar_url: response.user.avatar_url,
            is_blocked: response.user.is_blocked,
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
      avatar_url: backendUser.avatar_url,
      is_blocked: backendUser.is_blocked,
    });
  }, []);

  const updateUser = useCallback((fields: Partial<User>): void => {
    setUser((prev) => (prev ? { ...prev, ...fields } : null));
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

  // Загрузка списка поездок из API (параметр silent отключает полноэкранный индикатор загрузки при фоновом поллинге)
  const fetchRides = useCallback(async (signal?: AbortSignal, silent: boolean = false): Promise<void> => {
    if (!silent) {
      setIsRidesLoading(true);
    }
    setRidesError(null);
    try {
      const response = await api.get<RidesResponse>('/api/rides', { signal });
      if (response && Array.isArray(response.rides)) {
        const mapped = response.rides.map(mapBackendRideToRide);
        setRides(mapped);
      } else if (!silent) {
        setRides([]);
      }
    } catch (err: unknown) {
      if (signal?.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Не удалось загрузить поездки';
      setRidesError(message);
      if (!silent) {
        setRides([]);
      }
    } finally {
      if (!silent) {
        setIsRidesLoading(false);
      }
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

  // Фоновый опрос (поллинг) каждые 10 секунд для синхронизации свободных мест и статусов поездок
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchRides(undefined, true);
    }, 10000);

    return () => {
      clearInterval(intervalId);
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
        departure_time: rideData.departure_time || rideData.departureTime || rideData.time,
        price: rideData.price,
        base_price: rideData.price,
        total_seats: rideData.totalSeats || 4,
        ride_type: rideData.ride_type || rideData.rideType || 'one_off',
        regular_days: rideData.regular_days || rideData.regularDays || null,
      };

      if (rideData.vehicleId) {
        payload.vehicle_id = rideData.vehicleId;
      }

      if (rideData.description) {
        payload.description = rideData.description;
      }

      if (rideData.tags && rideData.tags.length > 0) {
        payload.tags = rideData.tags;
      }

      const response = await api.post<{ message: string; ride: BackendRide }>('/api/rides', payload);
      if (response?.ride) {
        const newRide = mapBackendRideToRide(response.ride);
        setRides((prev) => [newRide, ...prev]);
      }
    },
    [user],
  );

  const updateRide = useCallback(
    async (rideId: string, payload: Record<string, unknown>): Promise<void> => {
      const response = await api.patch<{ message: string; ride: BackendRide }>(`/api/rides/${rideId}`, payload);
      if (response?.ride) {
        const updated = mapBackendRideToRide(response.ride);
        setRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
      }
    },
    [],
  );

  const kickPassenger = useCallback(
    async (rideId: string, passengerId: string): Promise<void> => {
      const response = await api.delete<{
        message: string;
        available_seats?: number;
        passengers?: PassengerInfo[];
      }>(`/api/rides/${rideId}/passengers/${passengerId}`);

      setRides((prev) =>
        prev.map((r) => {
          if (r.id !== rideId) return r;
          const updatedPassengers = response?.passengers ?? (r.passengers || []).filter((p) => p.id !== passengerId);
          const updatedPassengerIds = updatedPassengers.map((p) => p.id);
          const updatedSeats = response?.available_seats !== undefined
            ? response.available_seats
            : (r.availableSeats !== undefined ? r.availableSeats + 1 : undefined);
          return {
            ...r,
            availableSeats: updatedSeats,
            passengers: updatedPassengers,
            passengerIds: updatedPassengerIds,
          };
        }),
      );
    },
    [],
  );

  const joinRide = useCallback(async (rideId: string, selectedDay?: string): Promise<void> => {
    // 1. Мгновенный оптимистичный пересчет мест с сохранением фиксированной цены
    setRides((prev) =>
      prev.map((r) => {
        if (r.id !== rideId) return r;
        const currentPassengers = r.passengerIds ? [...r.passengerIds] : [];
        const myId = user?.id || 'me';
        if (!currentPassengers.includes(myId)) {
          currentPassengers.push(myId);
        }
        const currentPassengerObjs = r.passengers ? [...r.passengers] : [];
        if (!currentPassengerObjs.some((p) => p.id === myId)) {
          currentPassengerObjs.push({
            id: myId,
            name: user?.name,
            username: user?.telegram,
            telegram: user?.telegram,
            phone: user?.phone,
            avatar_url: user?.avatar_url,
            selected_day: selectedDay || null,
          });
        }
        const updatedSeats = Math.max(0, (r.availableSeats ?? 1) - 1);
        return {
          ...r,
          availableSeats: updatedSeats,
          currentPrice: r.price,
          passengerIds: currentPassengers,
          passengers: currentPassengerObjs,
        };
      }),
    );

    // 3. Отправка запроса к API
    try {
      const response = await api.post<{
        message: string;
        available_seats?: number;
        current_price?: number;
        passenger_ids?: string[];
        passengers?: PassengerInfo[];
      }>(`/api/rides/${rideId}/join`, selectedDay ? { selected_day: selectedDay } : undefined);

      if (response) {
        setRides((prev) =>
          prev.map((r) => {
            if (r.id !== rideId) return r;
            const updatedSeats = response.available_seats !== undefined
              ? response.available_seats
              : r.availableSeats;
            const updatedPassengerIds = response.passenger_ids ?? r.passengerIds;
            const updatedPassengers = response.passengers ?? r.passengers;
            return {
              ...r,
              availableSeats: updatedSeats,
              currentPrice: r.price,
              passengerIds: updatedPassengerIds,
              passengers: updatedPassengers,
            };
          }),
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка присоединения к поездке';
      setRidesError(message);
      fetchRides();
      throw err;
    }
  }, [user, fetchRides]);

  const leaveRide = useCallback(async (rideId: string): Promise<void> => {
    // 1. Мгновенный оптимистичный пересчет свободных мест с фиксированной ценой
    setRides((prev) =>
      prev.map((r) => {
        if (r.id !== rideId) return r;
        const myId = user?.id || 'me';
        const currentPassengers = (r.passengerIds || []).filter((id) => id !== myId);
        const updatedSeats = r.totalSeats !== undefined
          ? Math.min(r.totalSeats, (r.availableSeats ?? 0) + 1)
          : (r.availableSeats ?? 0) + 1;
        return {
          ...r,
          availableSeats: updatedSeats,
          currentPrice: r.price,
          passengerIds: currentPassengers,
        };
      }),
    );

    // 3. Отправка запроса к API
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
              : r.availableSeats;
            const updatedPassengerIds = response.passenger_ids ?? r.passengerIds;
            return {
              ...r,
              availableSeats: updatedSeats,
              currentPrice: r.price,
              passengerIds: updatedPassengerIds,
            };
          }),
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка отмены участия в поездке';
      setRidesError(message);
      fetchRides();
    }
  }, [user, fetchRides]);

  const deleteRide = useCallback(
    async (rideId: string): Promise<void> => {
      setRides((prev) => prev.filter((r) => r.id !== rideId));
      try {
        await api.delete('/api/rides/' + rideId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Ошибка отмены поездки';
        setRidesError(message);
        fetchRides();
        throw err;
      }
    },
    [fetchRides],
  );

  const startRide = useCallback(
    async (rideId: string): Promise<void> => {
      try {
        const response = await api.post<{ message: string; ride: BackendRide }>(`/api/rides/${rideId}/start`);
        if (response?.ride) {
          const updated = mapBackendRideToRide(response.ride);
          setRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
        } else {
          await fetchRides();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Ошибка начала поездки';
        setRidesError(message);
        throw err;
      }
    },
    [fetchRides],
  );

  const finishRide = useCallback(
    async (rideId: string): Promise<void> => {
      try {
        const response = await api.post<{ message: string; ride: BackendRide }>(`/api/rides/${rideId}/finish`);
        if (response?.ride) {
          const updated = mapBackendRideToRide(response.ride);
          setRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
        } else {
          await fetchRides();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Ошибка завершения поездки';
        setRidesError(message);
        throw err;
      }
    },
    [fetchRides],
  );

  const contextValue = useMemo<AppContextValue>(
    () => ({
      user,
      isAuthLoading,
      login,
      loginWithData,
      updateUser,
      logout,
      rides,
      isRidesLoading,
      ridesError,
      fetchRides,
      addRide,
      updateRide,
      kickPassenger,
      passengerRideIds,
      joinRide,
      leaveRide,
      deleteRide,
      startRide,
      finishRide,
    }),
    [
      user,
      isAuthLoading,
      login,
      loginWithData,
      updateUser,
      logout,
      rides,
      isRidesLoading,
      ridesError,
      fetchRides,
      addRide,
      updateRide,
      kickPassenger,
      passengerRideIds,
      joinRide,
      leaveRide,
      deleteRide,
      startRide,
      finishRide,
    ],
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
