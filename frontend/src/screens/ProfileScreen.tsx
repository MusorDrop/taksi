import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import SendIcon from '@mui/icons-material/Send';
import { useApp } from '../AppContext';
import { useThemeMode } from '../ThemeModeContext';

export default function ProfileScreen() {
  const { user, logout, rides, passengerRideIds } = useApp();
  const { mode, toggleTheme } = useThemeMode();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const driverCount = rides.filter((r) => r.driverId === user.id).length;
  const passengerCount = passengerRideIds.length;

  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Профиль
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
        <Avatar
          sx={{
            width: 80,
            height: 80,
            bgcolor: 'primary.main',
            fontSize: 28,
            mx: 'auto',
            mb: 2,
          }}
        >
          {initials}
        </Avatar>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {user.name}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mt: 0.5 }}>
          <SendIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            @{user.telegram}
          </Typography>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Paper variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 3, textAlign: 'center' }}>
          <DirectionsCarIcon sx={{ fontSize: 28, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {driverCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Мои маршруты
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 3, textAlign: 'center' }}>
          <PersonIcon sx={{ fontSize: 28, color: 'secondary.main', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {passengerCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Поездки пассажиром
          </Typography>
        </Paper>
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <FormControlLabel
          control={<Switch checked={mode === 'dark'} onChange={toggleTheme} />}
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <DarkModeIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <span>Тёмная тема</span>
            </Stack>
          }
        />
      </Paper>

      <Divider sx={{ my: 3 }} />

      <Button
        fullWidth
        variant="outlined"
        color="error"
        size="large"
        startIcon={<LogoutIcon />}
        onClick={logout}
        sx={{ py: 1.2 }}
      >
        Выйти
      </Button>
    </Box>
  );
}
