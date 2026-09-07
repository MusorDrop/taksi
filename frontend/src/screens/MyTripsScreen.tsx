import { useState, useMemo, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import RefreshIcon from '@mui/icons-material/Refresh';
import RideCard from '../components/RideCard';
import { useApp } from '../AppContext';
import { api } from '../api';
import { mapBackendRideToRide } from '../utils';
import type { Ride, RidesResponse } from '../types';

/**
 * Извлечение числового значения времени отправления поездки для сортировки
 * @param ride - Объект поездки
 * @returns Метка времени в миллисекундах или минутах от начала дня
 */
function getRideDepartureTimestamp(ride: Ride): number {
  const timeString = ride.departureTime || ride.departure_time;
  if (timeString) {
    const parsedDate = new Date(timeString).getTime();
    if (!Number.isNaN(parsedDate)) {
      return parsedDate;
    }
  }

  if (ride.time) {
    const [hours, minutes] = ride.time.split(':').map((part) => parseInt(part, 10));
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return hours * 60 + minutes;
    }
  }

  return ride.createdAt || 0;
}

/**
 * Определение ранга группы статуса:
 * 0 для активных и запланированных (отображаются вверху),
 * 1 для завершённых и отменённых (отображаются внизу).
 * @param status - Статус поездки
 * @returns Ранг группы статуса (0 или 1)
 */
function getStatusGroupRank(status?: string): number {
  if (status === 'completed' || status === 'cancelled') {
    return 1;
  }
  return 0;
}

/**
 * Сортировка поездок для раздела «Мои поездки»:
 * 1. Активные, запланированные и регулярные поездки вверху (active в приоритете, далее по времени отправления).
 * 2. Завершённые и отменённые поездки внизу (completed перед cancelled, затем по времени от недавних к старым).
 * @param ridesList - Исходный массив поездок
 * @returns Отсортированный массив поездок
 */
function sortMyTrips(ridesList: Ride[]): Ride[] {
  return [...ridesList].sort((a, b) => {
    const rankA = getStatusGroupRank(a.status);
    const rankB = getStatusGroupRank(b.status);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // Если обе поездки активные или запланированные
    if (rankA === 0) {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;

      // Сортировка по времени отправления (ближайшие первыми)
      const timeA = getRideDepartureTimestamp(a);
      const timeB = getRideDepartureTimestamp(b);
      return timeA - timeB;
    }

    // Если обе поездки завершённые или отменённые: 'completed' выше 'cancelled'
    if (a.status === 'completed' && b.status === 'cancelled') return -1;
    if (a.status === 'cancelled' && b.status === 'completed') return 1;

    // Среди завершенных сортируем от недавних к старым
    const timeA = getRideDepartureTimestamp(a);
    const timeB = getRideDepartureTimestamp(b);
    return timeB - timeA;
  });
}

export interface MyTripsScreenProps {
  initialTab?: 'passenger' | 'driver';
}

export default function MyTripsScreen({ initialTab }: MyTripsScreenProps = {}) {
  const { rides: contextRides, user, passengerRideIds, leaveRide } = useApp();
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Выбранная вкладка: приоритет у активного переключения пользователем, иначе берется initialTab
  const tab = activeTab ?? (initialTab === 'driver' ? 1 : 0);

  // Загрузка персональной истории поездок из API /api/rides/my-rides
  const fetchMyRides = useCallback(async (signal?: AbortSignal, silent = false): Promise<void> => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await api.get<RidesResponse>('/api/rides/my-rides', { signal });
      if (response && Array.isArray(response.rides)) {
        const mapped = response.rides.map(mapBackendRideToRide);
        setMyRides(mapped);
      } else if (!silent) {
        setMyRides([]);
      }
    } catch (err: unknown) {
      if (signal?.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Не удалось загрузить поездки';
      setError(message);
      if (!silent) {
        setMyRides([]);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  // Первоначальная загрузка поездок пользователя при монтировании
  useEffect(() => {
    const controller = new AbortController();
    fetchMyRides(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchMyRides]);

  // Фоновая синхронизация персональных поездок при изменении глобального списка поездок в AppContext
  useEffect(() => {
    fetchMyRides(undefined, true);
  }, [contextRides, fetchMyRides]);

  // Фоновый опрос (поллинг) каждые 10 секунд для обновления статусов (active/completed) и участников
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchMyRides(undefined, true);
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchMyRides]);

  // Мемоизация списка поездок, в которых текущий пользователь участвует как пассажир
  const passengerRides = useMemo(
    () =>
      sortMyTrips(
        myRides.filter(
          (r) =>
            passengerRideIds.includes(r.id) ||
            Boolean(user?.id && r.passengerIds?.includes(user.id)) ||
            Boolean(user?.id && r.driverId !== user.id)
        )
      ),
    [myRides, passengerRideIds, user]
  );

  // Мемоизация списка поездок, опубликованных текущим пользователем как водителем
  const driverRides = useMemo(
    () =>
      sortMyTrips(
        myRides.filter((r) => Boolean(user?.id && r.driverId === user.id))
      ),
    [myRides, user]
  );

  const handlePassengerLeave = useCallback(
    async (rideId: string): Promise<void> => {
      await leaveRide(rideId);
      await fetchMyRides(undefined, true);
    },
    [leaveRide, fetchMyRides]
  );

  return (
    <Box component="section" aria-label="Мои поездки" sx={{ pb: { xs: 12, sm: 8 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          Мои поездки
        </Typography>
        <Button
          size="small"
          variant="text"
          startIcon={<RefreshIcon />}
          onClick={() => fetchMyRides()}
          disabled={isLoading}
          sx={{ borderRadius: 2, fontWeight: 600, px: 1.5 }}
        >
          Обновить
        </Button>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2.5 }}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 0.5,
          mb: 2.5,
          borderRadius: 3,
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)',
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          aria-label="Категории моих поездок"
          sx={{
            minHeight: 40,
            '& .MuiTabs-indicator': {
              display: 'none',
            },
            '& .MuiTab-root': {
              fontWeight: 650,
              textTransform: 'none',
              minHeight: 40,
              py: 1,
              borderRadius: 2.5,
              fontSize: '0.875rem',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              color: 'text.secondary',
              '&.Mui-selected': {
                bgcolor: 'background.paper',
                color: 'primary.main',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 2px 8px rgba(0, 0, 0, 0.4)'
                    : '0 2px 8px rgba(15, 23, 42, 0.08)',
              },
            },
          }}
        >
          <Tab
            id="trips-tab-passenger"
            aria-controls="trips-tabpanel-passenger"
            label={`Я пассажир (${passengerRides.length})`}
          />
          <Tab
            id="trips-tab-driver"
            aria-controls="trips-tabpanel-driver"
            label={`Я водитель (${driverRides.length})`}
          />
        </Tabs>
      </Paper>

      {isLoading && myRides.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={36} />
        </Box>
      ) : tab === 0 ? (
        <Box
          role="tabpanel"
          id="trips-tabpanel-passenger"
          aria-labelledby="trips-tab-passenger"
        >
          {passengerRides.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 3.5, sm: 4.5 },
                borderRadius: 4,
                textAlign: 'center',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
                boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                Вы ещё не присоединились ни к одной поездке. Перейдите во вкладку «Найти поездку», чтобы забронировать!
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {passengerRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  isPassenger
                  onLeave={() => handlePassengerLeave(ride.id)}
                />
              ))}
            </Stack>
          )}
        </Box>
      ) : (
        <Box
          role="tabpanel"
          id="trips-tabpanel-driver"
          aria-labelledby="trips-tab-driver"
        >
          {driverRides.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 3.5, sm: 4.5 },
                borderRadius: 4,
                textAlign: 'center',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
                boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                Вы ещё не создали ни одного маршрута. Перейдите во вкладку «Создать поездку», чтобы добавить!
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {driverRides.map((ride) => (
                <RideCard key={ride.id} ride={ride} isDriver />
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}
