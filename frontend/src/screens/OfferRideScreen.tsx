import { useState, useEffect, useRef, type FormEvent } from 'react';
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
import Autocomplete from '@mui/material/Autocomplete';
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
import type { Vehicle, VehiclesResponse, RoutePreviewResponse } from '../types';
import { formatDateString, formatPrice } from '../utils';
import { api } from '../api';

/**
 * Опция подсказки адреса для выпадающего списка Autocomplete
 */
export interface AddressOption {
  label: string;
  value: string;
  subtitle?: string;
}

interface SuggestApiResponseItem {
  title?: string | { text?: string };
  subtitle?: string | { text?: string };
  full_address?: string;
  address?: string;
  value?: string;
  displayName?: string;
}

interface SuggestApiResponse {
  suggestions?: SuggestApiResponseItem[];
  results?: SuggestApiResponseItem[];
}

/**
 * Ожидание готовности Yandex Maps API 2.1 в объекте window
 */
function getReadyYmaps(): Promise<Window['ymaps'] | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  const ym = window.ymaps;
  if (!ym) {
    return Promise.resolve(null);
  }
  if (typeof ym.suggest === 'function') {
    return Promise.resolve(ym);
  }
  if (typeof ym.ready === 'function') {
    return new Promise((resolve) => {
      ym.ready(() => {
        resolve(window.ymaps ?? null);
      });
    });
  }
  return Promise.resolve(ym);
}

/**
 * Преобразование элемента ответа Yandex Suggest API в стандартизированный AddressOption
 */
function parseSuggestItem(item: unknown): AddressOption | null {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return null;
    return { label: trimmed, value: trimmed };
  }

  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const value = typeof obj.value === 'string' ? obj.value.trim() : '';
    const displayName = typeof obj.displayName === 'string' ? obj.displayName.trim() : '';
    const fullAddress = typeof obj.full_address === 'string' ? obj.full_address.trim() : '';
    const address = typeof obj.address === 'string' ? obj.address.trim() : '';

    let title = '';
    if (typeof obj.title === 'string') {
      title = obj.title.trim();
    } else if (obj.title && typeof obj.title === 'object' && 'text' in obj.title) {
      const textVal = (obj.title as { text?: unknown }).text;
      if (typeof textVal === 'string') {
        title = textVal.trim();
      }
    }

    let subtitle = '';
    if (typeof obj.subtitle === 'string') {
      subtitle = obj.subtitle.trim();
    } else if (obj.subtitle && typeof obj.subtitle === 'object' && 'text' in obj.subtitle) {
      const textVal = (obj.subtitle as { text?: unknown }).text;
      if (typeof textVal === 'string') {
        subtitle = textVal.trim();
      }
    }

    const resolvedValue = value || fullAddress || address || displayName || title;
    const resolvedLabel = displayName || title || fullAddress || address || value;

    if (!resolvedValue) return null;

    return {
      label: resolvedLabel,
      value: resolvedValue,
      subtitle: subtitle || undefined,
    };
  }

  return null;
}

/**
 * Запрос подсказок адресов через window.ymaps.suggest (API 2.1) или резервный бэкенд /api/suggest
 */
async function fetchAddressSuggestions(query: string, signal?: AbortSignal): Promise<AddressOption[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  // 1. Проверяем клиентский API 2.1 Яндекс.Карт (window.ymaps)
  const ymaps2 = await getReadyYmaps();
  if (ymaps2 && typeof ymaps2.suggest === 'function') {
    try {
      const results = await ymaps2.suggest(trimmed, { results: 7 });
      if (Array.isArray(results) && results.length > 0) {
        const options: AddressOption[] = [];
        for (const item of results) {
          const parsed = parseSuggestItem(item);
          if (parsed && !options.some((opt) => opt.value === parsed.value)) {
            options.push(parsed);
          }
        }
        if (options.length > 0) {
          return options;
        }
      }
    } catch (err: unknown) {
      console.warn('Ошибка вызова window.ymaps.suggest:', err);
    }
  }

  // 2. Резервный запрос к бэкенду /api/suggest
  try {
    const res = await api.get<SuggestApiResponse | SuggestApiResponseItem[]>(
      `/api/suggest?text=${encodeURIComponent(trimmed)}`,
      { signal }
    );
    if (res) {
      const list = Array.isArray(res) ? res : (res.suggestions || res.results || []);
      const options: AddressOption[] = [];
      for (const item of list) {
        const parsed = parseSuggestItem(item);
        if (parsed && !options.some((opt) => opt.value === parsed.value)) {
          options.push(parsed);
        }
      }
      return options;
    }
  } catch {
    // При недоступности бэкенда или отмене запроса возвращаем пустой список
  }

  return [];
}

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

/**
 * Получение времени выезда по умолчанию (текущее время + 1 час) в формате HH:mm
 */
function getDefaultTimeString(): string {
  const target = new Date(Date.now() + 60 * 60 * 1000);
  const hours = String(target.getHours()).padStart(2, '0');
  const minutes = String(target.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Получение даты выезда по умолчанию в формате YYYY-MM-DD (соответствует сдвигу времени +1 час)
 */
function getDefaultDateString(): string {
  const target = new Date(Date.now() + 60 * 60 * 1000);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
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
  const [fromInputValue, setFromInputValue] = useState<string>('');
  const [toInputValue, setToInputValue] = useState<string>('');
  const [fromOptions, setFromOptions] = useState<AddressOption[]>([]);
  const [toOptions, setToOptions] = useState<AddressOption[]>([]);
  const [isFromLoading, setIsFromLoading] = useState<boolean>(false);
  const [isToLoading, setIsToLoading] = useState<boolean>(false);
  const [rideType, setRideType] = useState<'one_off' | 'regular'>('one_off');
  const [regularDays, setRegularDays] = useState<string[]>(['Пн', 'Вт', 'Ср', 'Чт', 'Пт']);
  const [date, setDate] = useState<string>(getDefaultDateString);
  const [time, setTime] = useState<string>(getDefaultTimeString);
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

  const [routePolyline, setRoutePolyline] = useState<[number, number][] | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [endCoords, setEndCoords] = useState<[number, number] | null>(null);
  const [recommendedPrice, setRecommendedPrice] = useState<number>(150);
  const [isPeakDemand, setIsPeakDemand] = useState<boolean>(false);
  const [isRouteLoading, setIsRouteLoading] = useState<boolean>(false);

  // Загрузка подсказок адресов для поля 'Откуда'
  useEffect(() => {
    const trimmed = fromInputValue.trim();
    if (trimmed.length < 2) {
      setFromOptions([]);
      setIsFromLoading(false);
      return;
    }

    // Если значение в поле совпадает с уже выбранным адресом, повторный поиск не выполняется
    if (trimmed === from.trim() && from.trim().length > 0) {
      setIsFromLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setIsFromLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await fetchAddressSuggestions(trimmed, controller.signal);
        if (isMounted) {
          setFromOptions(results);
        }
      } catch {
        if (isMounted) {
          setFromOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsFromLoading(false);
        }
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [fromInputValue, from]);

  // Загрузка подсказок адресов для поля 'Куда'
  useEffect(() => {
    const trimmed = toInputValue.trim();
    if (trimmed.length < 2) {
      setToOptions([]);
      setIsToLoading(false);
      return;
    }

    // Если значение в поле совпадает с уже выбранным адресом, повторный поиск не выполняется
    if (trimmed === to.trim() && to.trim().length > 0) {
      setIsToLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setIsToLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await fetchAddressSuggestions(trimmed, controller.signal);
        if (isMounted) {
          setToOptions(results);
        }
      } catch {
        if (isMounted) {
          setToOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsToLoading(false);
        }
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [toInputValue, to]);

  // Запрос реального дорожного маршрута, полилинии и расчетной цены от бэкенда
  useEffect(() => {
    const trimmedFrom = from.trim();
    const trimmedTo = to.trim();

    if (trimmedFrom.length < 2 || trimmedTo.length < 2) {
      setRoutePolyline(null);
      setRouteDistance(null);
      setRouteDuration(null);
      setStartCoords(null);
      setEndCoords(null);
      return;
    }

    const controller = new AbortController();
    setIsRouteLoading(true);

    const timer = setTimeout(async () => {
      try {
        const query = `/api/rides/route-preview?from=${encodeURIComponent(trimmedFrom)}&to=${encodeURIComponent(trimmedTo)}&time=${encodeURIComponent(time)}`;
        const res = await api.get<RoutePreviewResponse>(query, {
          signal: controller.signal,
        });

        if (res) {
          const rawPoly = res.polyline ?? res.route_polyline;
          let coords: [number, number][] | null = null;
          if (Array.isArray(rawPoly)) {
            coords = rawPoly as [number, number][];
          } else if (rawPoly && typeof rawPoly === 'object' && Array.isArray(rawPoly.coordinates)) {
            coords = rawPoly.coordinates;
          }

          if (coords) {
            setRoutePolyline(coords);
          }

          const dist = res.distance_km ?? res.distanceKm ?? 5.0;
          setRouteDistance(dist);

          const dur = res.duration_min ?? res.durationMin ?? Math.round(dist * 2.2);
          setRouteDuration(dur);

          const sLon = res.start?.lon ?? res.from?.lon ?? res.start_coords?.lon;
          const sLat = res.start?.lat ?? res.from?.lat ?? res.start_coords?.lat;
          if (sLon !== undefined && sLat !== undefined) {
            setStartCoords([sLon, sLat]);
          }

          const eLon = res.end?.lon ?? res.to?.lon ?? res.end_coords?.lon;
          const eLat = res.end?.lat ?? res.to?.lat ?? res.end_coords?.lat;
          if (eLon !== undefined && eLat !== undefined) {
            setEndCoords([eLon, eLat]);
          }

          const priceVal = res.price ?? res.base_price ?? 150;
          setRecommendedPrice(Math.round(priceVal / 5) * 5);
          setIsPeakDemand(Boolean(res.is_peak ?? res.isPeak));
        }
      } catch {
        // Игнорируем отмененные запросы
      } finally {
        setIsRouteLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [from, to, time]);

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

  const handleFromChange = (
    _event: unknown,
    newValue: string | AddressOption | null,
  ): void => {
    if (!newValue) {
      setFrom('');
      setFromInputValue('');
      setFromOptions([]);
      return;
    }
    const val = typeof newValue === 'string' ? newValue.trim() : newValue.value.trim();
    const label = typeof newValue === 'string' ? newValue.trim() : (newValue.label || newValue.value).trim();
    setFrom(val);
    setFromInputValue(label);
  };

  const handleFromBlur = (): void => {
    const trimmed = fromInputValue.trim();
    if (trimmed !== from) {
      setFrom(trimmed);
    }
  };

  const handleToChange = (
    _event: unknown,
    newValue: string | AddressOption | null,
  ): void => {
    if (!newValue) {
      setTo('');
      setToInputValue('');
      setToOptions([]);
      return;
    }
    const val = typeof newValue === 'string' ? newValue.trim() : newValue.value.trim();
    const label = typeof newValue === 'string' ? newValue.trim() : (newValue.label || newValue.value).trim();
    setTo(val);
    setToInputValue(label);
  };

  const handleToBlur = (): void => {
    const trimmed = toInputValue.trim();
    if (trimmed !== to) {
      setTo(trimmed);
    }
  };

  const handleApplyRecommendation = (): void => {
    setPrice(String(recommendedPrice));
  };

  const handleDayToggle = (day: string): void => {
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
        distanceKm: routeDistance ?? 5.0,
        isPeak: isPeakDemand,
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
      setFromInputValue('');
      setToInputValue('');
      setFromOptions([]);
      setToOptions([]);
      setDate(getDefaultDateString());
      setTime(getDefaultTimeString());
      setPrice('');
      setRoutePolyline(null);
      setRouteDistance(null);
      setRouteDuration(null);
      setStartCoords(null);
      setEndCoords(null);
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
          {/* Поле выбора начальной точки отправления (Откуда) с автодополнением */}
          <Autocomplete<AddressOption | string, false, false, true>
            freeSolo
            disabled={hasNoVehicles}
            options={fromOptions}
            loading={isFromLoading}
            filterOptions={(x) => x}
            value={from || null}
            inputValue={fromInputValue}
            onInputChange={(_event, newInputValue, reason) => {
              setFromInputValue(newInputValue);
              if (reason === 'clear') {
                setFrom('');
                setFromOptions([]);
              }
            }}
            onChange={handleFromChange}
            onBlur={handleFromBlur}
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.label || option.value || ''
            }
            isOptionEqualToValue={(option, val) => {
              const optVal = typeof option === 'string' ? option : option.value;
              const targetVal = typeof val === 'string' ? val : val.value;
              return (
                optVal === targetVal ||
                (typeof option !== 'string' && option.label === targetVal)
              );
            }}
            noOptionsText={
              fromInputValue.trim().length < 2
                ? 'Введите не менее 2 символов'
                : 'Адрес не найден'
            }
            loadingText="Поиск адресов..."
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                label="Откуда (Точка А)"
                placeholder="Например: Центральная библиотека"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <LocationOnIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {isFromLoading ? (
                        <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => {
              const { key, ...optionProps } = props;
              const addressText = typeof option === 'string' ? option : option.label;
              const subtitleText = typeof option === 'string' ? undefined : option.subtitle;
              return (
                <Box component="li" key={key} {...optionProps}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', py: 0.5 }}>
                    <LocationOnIcon sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                        {addressText}
                      </Typography>
                      {subtitleText && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {subtitleText}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              );
            }}
          />

          {/* Поле выбора конечной точки назначения (Куда) с автодополнением */}
          <Autocomplete<AddressOption | string, false, false, true>
            freeSolo
            disabled={hasNoVehicles}
            options={toOptions}
            loading={isToLoading}
            filterOptions={(x) => x}
            value={to || null}
            inputValue={toInputValue}
            onInputChange={(_event, newInputValue, reason) => {
              setToInputValue(newInputValue);
              if (reason === 'clear') {
                setTo('');
                setToOptions([]);
              }
            }}
            onChange={handleToChange}
            onBlur={handleToBlur}
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.label || option.value || ''
            }
            isOptionEqualToValue={(option, val) => {
              const optVal = typeof option === 'string' ? option : option.value;
              const targetVal = typeof val === 'string' ? val : val.value;
              return (
                optVal === targetVal ||
                (typeof option !== 'string' && option.label === targetVal)
              );
            }}
            noOptionsText={
              toInputValue.trim().length < 2
                ? 'Введите не менее 2 символов'
                : 'Адрес не найден'
            }
            loadingText="Поиск адресов..."
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                label="Куда (Точка Б)"
                placeholder="Например: Северный кампус"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <LocationOnIcon sx={{ fontSize: 20, color: 'error.main' }} />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {isToLoading ? (
                        <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => {
              const { key, ...optionProps } = props;
              const addressText = typeof option === 'string' ? option : option.label;
              const subtitleText = typeof option === 'string' ? undefined : option.subtitle;
              return (
                <Box component="li" key={key} {...optionProps}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', py: 0.5 }}>
                    <LocationOnIcon sx={{ fontSize: 20, color: 'error.main', flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                        {addressText}
                      </Typography>
                      {subtitleText && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {subtitleText}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              );
            }}
          />

          <RouteMap
            from={from || 'Точка А'}
            to={to || 'Точка Б'}
            polyline={routePolyline}
            startCoords={startCoords}
            endCoords={endCoords}
            distanceKm={routeDistance}
            durationMin={routeDuration}
            height={280}
          />

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
                Расчет стоимости маршрута
              </Typography>
              {isRouteLoading && <CircularProgress size={16} sx={{ color: AI_ACCENT.iconColor, ml: 1 }} />}
              {isPeakDemand && (
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
              {isRouteLoading
                ? 'Связываемся с сервисом маршрутов для точного расчета...'
                : routeDistance
                ? `✨ Рекомендация: ${formatPrice(recommendedPrice)} (дистанция ${routeDistance} км, в пути ~${routeDuration || Math.round(routeDistance * 2.2)} мин)`
                : '✨ Укажите точки отправления и назначения для расчета цены и построения маршрута'}
            </Typography>

            <Button
              fullWidth
              variant="contained"
              disabled={hasNoVehicles || isRouteLoading}
              onClick={handleApplyRecommendation}
              sx={{
                bgcolor: AI_ACCENT.button,
                '&:hover': { bgcolor: AI_ACCENT.buttonHover },
              }}
            >
              Применить ({formatPrice(recommendedPrice)})
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
