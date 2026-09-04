import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Ride, User } from './types';
import { MOCK_RIDES, MOCK_USER } from './mockData';

interface AppContextValue {
  user: User | null;
  login: (name: string) => void;
  logout: () => void;
  rides: Ride[];
  addRide: (ride: Omit<Ride, 'id' | 'createdAt' | 'driverId' | 'driverName'>) => void;
  passengerRideIds: string[];
  joinRide: (rideId: string) => void;
  leaveRide: (rideId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [rides, setRides] = useState<Ride[]>(MOCK_RIDES);
  const [passengerRideIds, setPassengerRideIds] = useState<string[]>(['r3', 'r7']);

  const login = (name: string) => {
    setUser({ ...MOCK_USER, name: name || MOCK_USER.name });
  };

  const logout = () => {
    setUser(null);
  };

  const addRide: AppContextValue['addRide'] = (ride) => {
    if (!user) return;
    const newRide: Ride = {
      ...ride,
      id: `r${Date.now()}`,
      createdAt: Date.now(),
      driverId: user.id,
      driverName: user.name,
    };
    setRides((prev) => [newRide, ...prev]);
  };

  const joinRide = (rideId: string) => {
    setPassengerRideIds((prev) =>
      prev.includes(rideId) ? prev : [...prev, rideId],
    );
  };

  const leaveRide = (rideId: string) => {
    setPassengerRideIds((prev) => prev.filter((id) => id !== rideId));
  };

  return (
    <AppContext.Provider
      value={{
        user,
        login,
        logout,
        rides,
        addRide,
        passengerRideIds,
        joinRide,
        leaveRide,
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
