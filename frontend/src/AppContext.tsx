/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { CreateRidePayload, MyTrips, Ride, RideSearchParams, User } from './types';
import {
  apiCreateRide,
  apiGetMe,
  apiJoinRide,
  apiLeaveRide,
  apiListRides,
  apiLogin,
  apiMyTrips,
  apiRegister,
  apiUpdateProfile,
  getToken,
  setToken,
  type RegisterPayload,
} from './api';

interface AppContextValue {
  user: User | null;
  rides: Ride[];
  myTrips: MyTrips | null;
  /** true, пока идёт восстановление сессии / первичная загрузка */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  searchRides: (params?: RideSearchParams) => Promise<void>;
  joinRide: (rideId: string) => Promise<void>;
  leaveRide: (rideId: string) => Promise<void>;
  addRide: (payload: CreateRidePayload) => Promise<void>;
  /** Обновить профиль текущего пользователя (telegram_username) */
  updateProfile: (telegramUsername: string | null) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [myTrips, setMyTrips] = useState<MyTrips | null>(null);
  const [loading, setLoading] = useState(true);

  const searchRides = useCallback(async (params?: RideSearchParams) => {
    const result = await apiListRides(params);
    setRides(result);
  }, []);

  const refreshMyTrips = useCallback(async () => {
    const trips = await apiMyTrips();
    setMyTrips(trips);
  }, []);

  // Восстановление сессии при загрузке приложения
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await apiGetMe();
        if (cancelled) return;
        setUser(me);
        const [ridesList, trips] = await Promise.all([apiListRides(), apiMyTrips()]);
        if (cancelled) return;
        setRides(ridesList);
        setMyTrips(trips);
      } catch {
        setToken(null);
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const me = await apiLogin(username, password);
      setUser(me);
      await Promise.all([searchRides(), refreshMyTrips()]);
    },
    [searchRides, refreshMyTrips],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const me = await apiRegister(payload);
      setUser(me);
      await Promise.all([searchRides(), refreshMyTrips()]);
    },
    [searchRides, refreshMyTrips],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setRides([]);
    setMyTrips(null);
  }, []);

  const joinRide = useCallback(
    async (rideId: string) => {
      await apiJoinRide(rideId);
      await Promise.all([searchRides(), refreshMyTrips()]);
    },
    [searchRides, refreshMyTrips],
  );

  const leaveRide = useCallback(
    async (rideId: string) => {
      await apiLeaveRide(rideId);
      await Promise.all([searchRides(), refreshMyTrips()]);
    },
    [searchRides, refreshMyTrips],
  );

  const addRide = useCallback(
    async (payload: CreateRidePayload) => {
      await apiCreateRide(payload);
      await Promise.all([searchRides(), refreshMyTrips()]);
    },
    [searchRides, refreshMyTrips],
  );

  const updateProfile = useCallback(async (telegramUsername: string | null) => {
    const me = await apiUpdateProfile(telegramUsername);
    setUser(me);
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        rides,
        myTrips,
        loading,
        login,
        register,
        logout,
        searchRides,
        joinRide,
        leaveRide,
        addRide,
        updateProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}