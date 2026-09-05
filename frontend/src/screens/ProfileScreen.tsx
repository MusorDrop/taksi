import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import SendIcon from '@mui/icons-material/Send';
import StarIcon from '@mui/icons-material/Star';
import EditIcon from '@mui/icons-material/Edit';
import TelegramIcon from '@mui/icons-material/Telegram';
import { useApp } from '../AppContext';

export default function ProfileScreen() {
  const { user, logout, myTrips, updateProfile } = useApp();
  const [editingTelegram, setEditingTelegram] = useState(false);
  const [telegramDraft, setTelegramDraft] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramError, setTelegramError] = useState('');

  if (!user) return null;

  const startTelegramEdit = () => {
    setTelegramDraft(user.telegramUsername ?? '');
    setTelegramError('');
    setEditingTelegram(true);
  };

  const saveTelegram = async () => {
    setSavingTelegram(true);
    setTelegramError('');
    try {
      const trimmed = telegramDraft.trim();
      await updateProfile(trimmed === '' ? null : trimmed);
      setEditingTelegram(false);
    } catch (err) {
      setTelegramError(err instanceof Error ? err.message : 'Не удалось сохранить Telegram');
    } finally {
      setSavingTelegram(false);
    }
  };

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const driverCount = myTrips?.driverRides.length ?? 0;
  const passengerCount = myTrips?.passengerRides.length ?? 0;

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
          {displayName}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mt: 0.5 }}>
          <SendIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            @{user.username}
          </Typography>
        </Stack>
        {user.rating !== null && (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mt: 0.5 }}>
            <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />
            <Typography variant="body2" color="text.secondary">
              {user.rating.toFixed(1)}
            </Typography>
          </Stack>
        )}
        {user.phone && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {user.phone}
          </Typography>
        )}
        {user.isVerified && (
          <Typography
            variant="caption"
            color="success.main"
            sx={{ fontWeight: 600, display: 'block', mt: 0.5 }}
          >
            ✓ Верифицирован
          </Typography>
        )}
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

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mt: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: editingTelegram ? 1.5 : 0 }}>
          <TelegramIcon sx={{ fontSize: 22, color: '#229ED9' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Telegram для связи
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {user.telegramUsername
                ? `@${user.telegramUsername}`
                : 'Укажите, чтобы пассажиры и водители могли написать вам'}
            </Typography>
          </Box>
          {!editingTelegram && (
            <Button size="small" startIcon={<EditIcon />} onClick={startTelegramEdit}>
              {user.telegramUsername ? 'Изменить' : 'Указать'}
            </Button>
          )}
        </Stack>
        {editingTelegram && (
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              fullWidth
              size="small"
              label="Telegram username"
              placeholder="durov"
              value={telegramDraft}
              onChange={(e) => setTelegramDraft(e.target.value)}
              error={telegramError !== ''}
              helperText={telegramError || 'Без @ — например durov'}
              disabled={savingTelegram}
            />
            <Button
              variant="contained"
              size="small"
              sx={{ mt: 0.5 }}
              disabled={savingTelegram}
              onClick={() => void saveTelegram()}
            >
              Сохранить
            </Button>
            <Button size="small" sx={{ mt: 0.5 }} disabled={savingTelegram} onClick={() => setEditingTelegram(false)}>
              Отмена
            </Button>
          </Stack>
        )}
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