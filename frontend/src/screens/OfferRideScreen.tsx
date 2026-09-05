import { useMemo, useState, type FormEvent } from 'react';
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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PaymentsIcon from '@mui/icons-material/Payments';
import RouteMap from '../components/RouteMap';
import { useApp } from '../AppContext';
import { DAY_KEYS, DAY_SHORT, type DayKey } from '../types';
import { estimateDistance, formatPrice, getAiRecommendedPrice, isPeakTime } from '../utils';

// Indigo/violet accent palette for the AI recommendation surface — kept local
// to this screen so the rest of the app's MUI theme (blue) is untouched.
const AI_ACCENT = {
  bg: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
  border: 'rgba(99, 102, 241, 0.22)',
  iconBg: 'rgba(99, 102, 241, 0.12)',
  iconColor: '#6366f1',
  text: '#4338ca',
  subtleText: '#6d28d9',
  button: '#6366f1',
  buttonHover: '#4f46e5',
};

export default function OfferRideScreen() {
  const { addRide, user } = useApp();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [time, setTime] = useState('08:00');
  const [telegram, setTelegram] = useState(user?.telegram ?? '');
  const [days, setDays] = useState<DayKey[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [price, setPrice] = useState<string>('');
  const [success, setSuccess] = useState(false);

  // The route distance is only "known" once both endpoints are filled in —
  // before that, the AI box simulates not having resolved a route yet and
  // falls back to a flat base price.
  const distanceKm = useMemo(
    () => (from.trim() && to.trim() ? estimateDistance(from, to) : null),
    [from, to],
  );
  const peak = isPeakTime(time);

  // Recalculates automatically whenever the route or the departure time
  // changes — this is what makes the recommendation feel "live".
  const recommendedPrice = useMemo(
    () => getAiRecommendedPrice(distanceKm, time),
    [distanceKm, time],
  );

  const parsedPrice = price.trim() === '' ? null : Number(price);
  const isPriceValid = parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice > 0;
  const canSubmit = Boolean(from && to && telegram && isPriceValid);

  const toggleDay = (day: DayKey) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleApplyRecommendation = () => {
    setPrice(String(recommendedPrice));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || parsedPrice === null) return;
    addRide({
      from,
      to,
      days,
      time,
      telegram: telegram.replace('@', ''),
      price: parsedPrice,
      distanceKm: distanceKm ?? estimateDistance(from, to),
      isPeak: peak,
    });
    setSuccess(true);
    setFrom('');
    setTo('');
    setTime('08:00');
    setPrice('');
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Создать поездку
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

          {/* Manual price input — the driver always has the final say */}
          <TextField
            fullWidth
            label="Ваша цена за место (₽)"
            placeholder="Например, 150"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PaymentsIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
              htmlInput: { min: 0, step: 5, inputMode: 'numeric' },
            }}
          />

          {/* AI Smart Recommendation box — sits directly under the price field */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              background: AI_ACCENT.bg,
              borderColor: AI_ACCENT.border,
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: AI_ACCENT.iconBg,
                  color: AI_ACCENT.iconColor,
                  flexShrink: 0,
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 18 }} />
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: AI_ACCENT.text }}>
                Умная цена от ИИ
              </Typography>
              {peak && (
                <Chip
                  icon={<BoltIcon sx={{ fontSize: 14 }} />}
                  label="Пиковый спрос +30%"
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 600, ml: 'auto' }}
                />
              )}
            </Stack>

            <Typography variant="body2" sx={{ color: AI_ACCENT.subtleText, fontWeight: 500, mb: 1.5 }}>
              ✨ ИИ рекомендует поставить {formatPrice(recommendedPrice)} (Учтены расстояние и пробки)
            </Typography>

            <Button
              fullWidth
              variant="contained"
              onClick={handleApplyRecommendation}
              sx={{
                bgcolor: AI_ACCENT.button,
                '&:hover': { bgcolor: AI_ACCENT.buttonHover },
              }}
            >
              Применить
            </Button>
          </Paper>

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

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={!canSubmit}
            sx={{ py: 1.2, fontSize: '1rem' }}
          >
            Опубликовать поездку
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
