import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import BoltIcon from '@mui/icons-material/Bolt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AirlineSeatReclineNormalIcon from '@mui/icons-material/AirlineSeatReclineNormal';
import RouteMap from '../components/RouteMap';
import { useApp } from '../AppContext';
import {
  DEFAULT_END,
  DEFAULT_START,
  estimatePrice,
  geocode,
  haversineKm,
  localDateTimeToIso,
} from '../geo';
import { formatPrice, isPeakTime } from '../utils';

/**
 * Ближайший будущий слот с шагом в час (сейчас + 1 час, округление вниз до часа).
 * Если слот приходится на полночь — дата сдвигается на завтра.
 * Раньше время было жёстко '08:00': публикация днём создавала поездку в прошлом,
 * которую поиск (departure_time > NOW()) никогда не показывал.
 */
function nextFreeSlot(): { date: string; time: string } {
  const candidate = new Date(Date.now() + 60 * 60 * 1000);
  candidate.setMinutes(0, 0, 0);
  const time = `${String(candidate.getHours()).padStart(2, '0')}:00`;
  const d = new Date();
  if (candidate.getHours() * 60 <= d.getHours() * 60 + d.getMinutes()) {
    d.setDate(d.getDate() + 1);
  }
  return { date: todayIsoWith(d), time };
}

function todayIsoWith(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function OfferRideScreen() {
  const { addRide } = useApp();
  const [initialSlot] = useState(nextFreeSlot);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(initialSlot.date);
  const [time, setTime] = useState(initialSlot.time);
  const [totalSeats, setTotalSeats] = useState('4');
  const [price, setPrice] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const start = geocode(from) ?? DEFAULT_START;
  const end = geocode(to) ?? DEFAULT_END;
  const distance = Math.round(haversineKm(start, end) * 100) / 100;
  const estimated = estimatePrice(distance, time);
  const peak = isPeakTime(time);
  // Выбранные дата и время выезда: если они в прошлом, бэкенд отклонит публикацию,
  // а поездка в прошлом всё равно не попала бы в выдачу поиска
  const departureAt = new Date(`${date}T${time || '08:00'}`);
  const departureInPast =
    Number.isNaN(departureAt.getTime()) || departureAt.getTime() <= Date.now();
  const fromKnown = !from.trim() || Boolean(geocode(from));
  const toKnown = !to.trim() || Boolean(geocode(to));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!from.trim() || !to.trim()) return;
    if (departureInPast) {
      setError('Время выезда уже прошло — укажите будущие дату и время.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess(false);
    try {
      const seats = Number(totalSeats);
      await addRide({
        start,
        end,
        departureTime: localDateTimeToIso(date, time),
        totalSeats: Number.isInteger(seats) && seats > 0 && seats <= 20 ? seats : 4,
        ...(price.trim() ? { price: Number(price) } : {}),
      });
      setSuccess(true);
      setFrom('');
      setTo('');
      const next = nextFreeSlot();
      setDate(next.date);
      setTime(next.time);
      setPrice('');
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать поездку');
    } finally {
      setSubmitting(false);
    }
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
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={(e) => void handleSubmit(e)}>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Откуда (Точка А)"
            placeholder="Например: Уралмаш"
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
          {!fromKnown && (
            <Typography variant="caption" color="warning.main">
              Локация не распознана — будет использована точка по умолчанию (Уралмаш).
            </Typography>
          )}
          <TextField
            fullWidth
            label="Куда (Точка Б)"
            placeholder="Например: Кампус Новокольцовский"
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
          {!toKnown && (
            <Typography variant="caption" color="warning.main">
              Локация не распознана — будет использована точка по умолчанию (Новокольцовский).
            </Typography>
          )}
<RouteMap from={from || 'Точка А'} to={to || 'Точка Б'} />

          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              label="Дата"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
          </Stack>

          {departureInPast && (
            <Alert severity="warning">
              Время выезда уже прошло — укажите будущие дату и время, иначе поездка не
              попадёт в поиск.
            </Alert>
          )}

          <TextField
            fullWidth
            label="Свободных мест"
            type="number"
            inputProps={{ min: 1, max: 20, step: 1 }}
            value={totalSeats}
            onChange={(e) => setTotalSeats(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <AirlineSeatReclineNormalIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            fullWidth
            label="Своя цена (необязательно)"
            type="number"
            inputProps={{ min: 0, step: 1 }}
            placeholder={`Оставьте пустым — рассчитаем ${formatPrice(estimated)}`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
{/* Калькулятор цены (предпросмотр, формула как на бэкенде) */}
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
                  {price.trim() ? formatPrice(Number(price)) : formatPrice(estimated)}
                </Typography>
              </Box>
            </Stack>
            {peak && (
              <Chip
                icon={<BoltIcon sx={{ fontSize: 16 }} />}
                label="Динамическая цена: +30% Часы пик"
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
            disabled={!from.trim() || !to.trim() || departureInPast || submitting}
            sx={{ py: 1.2, fontSize: '1rem' }}
          >
            {submitting ? 'Публикация...' : 'Опубликовать поездку'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}