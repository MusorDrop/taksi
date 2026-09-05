import { useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import RideCard from '../components/RideCard';
import PassengersCard from '../components/PassengersCard';
import { useApp } from '../AppContext';

export default function MyTripsScreen() {
  const { myTrips, leaveRide } = useApp();
  const [tab, setTab] = useState(0);

  const passengerRides = myTrips?.passengerRides ?? [];
  const driverRides = myTrips?.driverRides ?? [];

  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Мои поездки
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          mb: 2,
          '& .MuiTab-root': { fontWeight: 600, textTransform: 'none' },
        }}
      >
        <Tab label={`Я пассажир (${passengerRides.length})`} />
        <Tab label={`Я водитель (${driverRides.length})`} />
      </Tabs>

      {tab === 0 && (
        <>
          {passengerRides.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Вы ещё не присоединились ни к одной поездке. Перейдите во вкладку «Найти поездку», чтобы забронировать!
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              {passengerRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  isPassenger
                  onLeave={() => void leaveRide(ride.id)}
                />
              ))}
            </Stack>
          )}
        </>
      )}

      {tab === 1 && (
        <>
          {driverRides.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Вы ещё не создали ни одного маршрута. Перейдите во вкладку «Создать поездку», чтобы добавить!
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              {driverRides.map((ride) => (
                <Stack key={ride.id} spacing={0}>
                  <RideCard ride={ride} isDriver attachedBottom />
                  <PassengersCard ride={ride} attachedTop />
                </Stack>
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}