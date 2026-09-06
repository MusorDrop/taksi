import { useMemo, useState, useEffect, useRef, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import BoltIcon from '@mui/icons-material/Bolt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SendIcon from '@mui/icons-material/Send';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PaymentsIcon from '@mui/icons-material/Payments';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import RepeatIcon from '@mui/icons-material/Repeat';
import RouteMap from '../components/RouteMap';
import { useApp } from '../AppContext';
import type { Vehicle, VehiclesResponse } from '../types';
import { estimateDistance, formatDateString, formatPrice, getAiRecommendedPrice, isPeakTime } from '../utils';
import { api } from '../api';

/**
 * Получение текущей даты в формате YYYY-MM-DD для поля ввода даты
 */

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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

interface OfferRideScreenProps {
  onNavigateToProfile?: () => void;
}

export default function OfferRideScreen({ onNavigateToProfile }: OfferRideScreenProps) {
  const { addRide, user } = useApp();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rideType, setRideType] = useState<'one_off' | 'regular'>('one_off');
  const [regularDays, setRegularDays] = useState<string[]>(['Пн', 'Вт', 'Ср', 'Чт', 'Пт']);
  const [date, setDate] = useState<string>(getTodayDateString);
  const [time, setTime] = useState('08:00');
  const [telegram, setTelegram] = useState(user?.telegram ?? '');
  const [price, setPrice] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [isVehiclesLoading, setIsVehiclesLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Загрузка доступных автомобилей пользователя для привязки к поездке
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadVehicles(): Promise<void> {
      try {
        const res = await api.get<VehiclesResponse>('/api/vehicles', {
          signal: controller.signal,
        });
        if (isMounted && res?.vehicles) {
          setVehicles(res.vehicles);
          if (res.vehicles.length > 0) {
            setSelectedVehicleId(res.vehicles[0].id);
          }
        }
      } catch {
        // При недоступности бэкенда или отмене запроса форма работает без выбора автомобиля
      } finally {
        if (isMounted) {
          setIsVehiclesLoading(false);
        }
      }
    }

    loadVehicles();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const hasNoVehicles = !isVehiclesLoading && vehicles.length === 0;

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
  const isDateOrDaysValid = rideType === 'one_off' ? Boolean(date) : regularDays.length > 0;
  const canSubmit = Boolean(
    !hasNoVehicles &&
    from.trim() &&
    to.trim() &&
    telegram.trim() &&
    isPriceValid &&
    isDateOrDaysValid &&
    time
  );

  const handleApplyRecommendation = () => {
    setPrice(String(recommendedPrice));
  };

  const handleDayToggle = (day: string) => {
    setRegularDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit || parsedPrice === null || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const departureDate = new Date(`${date}T${time}`);
      const departureIso = !isNaN(departureDate.getTime())
        ? departureDate.toISOString()
        : new Date().toISOString();

      const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
      const totalSeats = selectedVehicle?.seats || 4;

      await addRide({
        from,
        to,
        dateFormatted: rideType === 'regular' ? regularDays.join(', ') : formatDateString(departureIso),
        dateString: rideType === 'regular' ? regularDays.join(', ') : formatDateString(departureIso),
        departure_time: departureIso,
        departureTime: departureIso,
        time,
        telegram: telegram.replace('@', ''),
        price: parsedPrice,
        distanceKm: distanceKm ?? estimateDistance(from, to),
        isPeak: peak,
        vehicleId: selectedVehicleId || undefined,
        totalSeats,
        rideType,
        ride_type: rideType,
        regularDays: rideType === 'regular' ? regularDays.join(', ') : null,
        regular_days: rideType === 'regular' ? regularDays.join(', ') : null,
      });
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      setSuccess(true);
      setFrom('');
      setTo('');
      setDate(getTodayDateString());
      setTime('08:00');
      setPrice('');
      successTimerRef.current = setTimeout(() => {
        setSuccess(false);
        successTimerRef.current = null;
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось опубликовать поездку на сервере';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Создать поездку
      </Typography>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      {hasNoVehicles && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            onNavigateToProfile ? (
              <Button color="inherit" size="small" onClick={onNavigateToProfile} sx={{ fontWeight: 600 }}>
                В профиль
              </Button>
            ) : null
          }
        >
          Сначала добавьте автомобиль в профиле, чтобы предложить поездку.
        </Alert>
      )}

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
            disabled={hasNoVehicles}
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
            disabled={hasNoVehicles}
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
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Тип поездки
            </Typography>
            <ToggleButtonGroup
              value={rideType}
              exclusive
              disabled={hasNoVehicles}
              onChange={(_, val) => {
                if (val) setRideType(val);
              }}
              fullWidth
              size="small"
            >
              <ToggleButton value="one_off" sx={{ textTransform: 'none', fontWeight: 500 }}>
                <CalendarTodayIcon sx={{ fontSize: 16, mr: 1 }} />
                Одноразовая
              </ToggleButton>
              <ToggleButton value="regular" sx={{ textTransform: 'none', fontWeight: 500 }}>
                <RepeatIcon sx={{ fontSize: 16, mr: 1 }} />
                Регулярная
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {rideType === 'one_off' ? (
            <TextField
              fullWidth
              label="Дата поездки"
              type="date"
              disabled={hasNoVehicles}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: getTodayDateString() },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarTodayIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          ) : (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 500 }}>
                Дни недели:
              </Typography>
              <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                {WEEK_DAYS.map((day) => {
                  const isSelected = regularDays.includes(day);
                  return (
                    <Chip
                      key={day}
                      label={day}
                      clickable={!hasNoVehicles}
                      disabled={hasNoVehicles}
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      onClick={() => handleDayToggle(day)}
                      sx={{ fontWeight: 600, minWidth: 40 }}
                    />
                  );
                })}
              </Stack>
              {regularDays.length === 0 && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  Выберите хотя бы один день недели
                </Typography>
              )}
            </Box>
          )}

          <TextField
            fullWidth
            label="Время выезда"
            type="time"
            disabled={hasNoVehicles}
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
            disabled={hasNoVehicles}
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
              disabled={hasNoVehicles}
              onClick={handleApplyRecommendation}
              sx={{
                bgcolor: AI_ACCENT.button,
                '&:hover': { bgcolor: AI_ACCENT.buttonHover },
              }}
            >
              Применить
            </Button>
          </Paper>

          {vehicles.length > 0 && (
            <FormControl fullWidth disabled={hasNoVehicles}>
              <InputLabel id="offer-vehicle-label">Автомобиль</InputLabel>
              <Select
                labelId="offer-vehicle-label"
                value={selectedVehicleId}
                label="Автомобиль"
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <DirectionsCarIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  </InputAdornment>
                }
              >
                {vehicles.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.brand} ({v.license_plate}){v.color ? ` • ${v.color}` : ''} • {v.seats ?? 4} мест
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            fullWidth
            label="Ваш Telegram (@username)"
            placeholder="@username"
            disabled={hasNoVehicles}
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
            disabled={!canSubmit || isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ py: 1.2, fontSize: '1rem' }}
          >
            {isSubmitting ? 'Публикация на сервере...' : 'Опубликовать поездку'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
