import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import RideCard from '../components/RideCard';
import { useApp } from '../AppContext';

export interface MyTripsScreenProps {
  initialTab?: 'passenger' | 'driver';
}

export default function MyTripsScreen({ initialTab }: MyTripsScreenProps = {}) {
  const { rides, user, passengerRideIds } = useApp();
  const [activeTab, setActiveTab] = useState<number | null>(null);

  // Выбранная вкладка: приоритет у активного переключения пользователем, иначе берется initialTab
  const tab = activeTab ?? (initialTab === 'driver' ? 1 : 0);

  // Мемоизация списка поездок, в которых текущий пользователь участвует как пассажир
  const passengerRides = useMemo(
    () =>
      rides.filter(
        (r) => passengerRideIds.includes(r.id) || Boolean(user?.id && r.passengerIds?.includes(user.id))
      ),
    [rides, passengerRideIds, user]
  );

  // Мемоизация списка поездок, опубликованных текущим пользователем как водителем
  const driverRides = useMemo(
    () => rides.filter((r) => r.driverId === user?.id),
    [rides, user]
  );

  return (
    <Box component="section" aria-label="Мои поездки" sx={{ pb: { xs: 12, sm: 8 } }}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 2.5, letterSpacing: '-0.02em' }}>
        Мои поездки
      </Typography>

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

      {tab === 0 && (
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
                />
              ))}
            </Stack>
          )}
        </Box>
      )}

      {tab === 1 && (
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
