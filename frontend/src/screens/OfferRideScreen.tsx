import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import BoltIcon from '@mui/icons-material/Bolt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SendIcon from '@mui/icons-material/Send';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RouteMap from '../components/RouteMap';
import { useApp } from '../AppContext';
import { DAY_KEYS, DAY_SHORT, type DayKey } from '../types';
import { calculatePrice, estimateDistance, formatPrice, isPeakTime } from '../utils';

export default function OfferRideScreen() {
  const { addRide, user } = useApp();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [time, setTime] = useState('08:00');
  const [telegram, setTelegram] = useState(user?.telegram ?? '');
  const [days, setDays] = useState<DayKey[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [success, setSuccess] = useState(false);

  const distance = estimateDistance(from || 'а', to || 'б');
  const price = calculatePrice(distance, time);
  const peak = isPeakTime(time);

  const toggleDay = (day: DayKey) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to || !telegram) return;
    addRide({
      from,
      to,
      days,
      time,
      telegram: telegram.replace('@', ''),
      price,
      distanceKm: distance,
      isPeak: peak,
    });
    setSuccess(true);
    setFrom('');
    setTo('');
    setTime('08:00');
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Создать новый маршрут
      </Typography>

      {success && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'success.light',
            color: 'success.contrastText',
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Ваш маршрут опубликован! Пассажиры теперь могут найти и забронировать его.
          </Typography>
        </Paper>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Откуда (Точка А)"
            placeholder="Например: Центральная библиотека"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationOnIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            fullWidth
            label="Куда (Точка Б)"
            placeholder="Например: Северный кампус"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationOnIcon sx={{ fontSize: 20, color: 'error.main' }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <RouteMap from={from || 'Точка А'} to={to || 'Точка Б'} />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Активные дни
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {DAY_KEYS.map((day) => (
                <Chip
                  key={day}
                  label={DAY_SHORT[day]}
                  size="small"
                  color={days.includes(day) ? 'primary' : 'default'}
                  variant={days.includes(day) ? 'filled' : 'outlined'}
                  onClick={() => toggleDay(day)}
                  sx={{ fontWeight: 600, minWidth: 44 }}
                />
              ))}
            </Box>
          </Box>

          <TextField
            fullWidth
            label="Время выезда"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <AccessTimeIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            fullWidth
            label="Ваш Telegram (@username)"
            placeholder="@username"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SendIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Pricing calculator */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Расчётное расстояние
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {distance} км
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">
                  Справедливая стоимость
                </Typography>
                <Typography variant="h5" color="primary.main" sx={{ fontWeight: 700 }}>
                  {formatPrice(price)}
                </Typography>
              </Box>
            </Stack>
            {peak && (
              <Chip
                icon={<BoltIcon sx={{ fontSize: 16 }} />}
                label="AI Динамическая цена: +30% Пиковый спрос"
                color="warning"
                size="small"
                sx={{ mt: 1.5, fontWeight: 600 }}
              />
            )}
          </Paper>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={!from || !to || !telegram}
            sx={{ py: 1.2, fontSize: '1rem' }}
          >
            Опубликовать поездку
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
