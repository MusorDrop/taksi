import { useState, useMemo } from 'react';
import { filterRidesByNlpQuery } from '../utils/nlpParser';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddIcon from '@mui/icons-material/Add';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PaymentsIcon from '@mui/icons-material/Payments';
import NearMeIcon from '@mui/icons-material/NearMe';
import AirlineSeatReclineNormalIcon from '@mui/icons-material/AirlineSeatReclineNormal';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import RideCard from '../components/RideCard';
import AiSearchBanner from '../components/AiSearchBanner';
import { useApp } from '../AppContext';
import { api } from '../api';
import {
  DAY_KEYS,
  DAY_SHORT,
  type DayKey,
  type Ride,
  type RideSearchFilters,
  type AiParseResponse,
} from '../types';
import { getRideDayKey } from '../utils';
import { AVAILABLE_TAGS } from '../hooks/useRideForm';

export type SortOption = 'time' | 'price' | 'distance';

interface Coordinates {
  lat: number;
  lon: number;
}

/**
 * Извлекает начальные координаты поездки
 */
function getRideStartCoordinates(ride: Ride): Coordinates | null {
  if (ride.startCoords && typeof ride.startCoords.lat === 'number' && typeof ride.startCoords.lon === 'number') {
    return { lat: ride.startCoords.lat, lon: ride.startCoords.lon };
  }
  if (typeof ride.startLat === 'number' && typeof ride.startLon === 'number') {
    return { lat: ride.startLat, lon: ride.startLon };
  }
  return null;
}

/**
 * Вычисляет расстояние в километрах между двумя координатами по формуле гаверсинуса
 */
function calculateDistanceKm(point1: Coordinates, point2: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLon = ((point2.lon - point1.lon) * Math.PI) / 180;
  const lat1Rad = (point1.lat * Math.PI) / 180;
  const lat2Rad = (point2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

/**
 * Извлекает временную метку или числовое значение для сортировки поездки по времени
 */
function getRideTimeSortValue(ride: Ride): number {
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

  return 0;
}

/**
 * Сортирует список поездок по выбранному критерию
 */
function sortRides(
  ridesList: Ride[],
  sortBy: SortOption | null,
  userLocation: Coordinates | null
): Ride[] {
  if (!sortBy) {
    return ridesList;
  }

  const sorted = [...ridesList];

  if (sortBy === 'time') {
    return sorted.sort((a, b) => getRideTimeSortValue(a) - getRideTimeSortValue(b));
  }

  if (sortBy === 'price') {
    return sorted.sort((a, b) => {
      const priceA = a.currentPrice ?? a.price ?? 0;
      const priceB = b.currentPrice ?? b.price ?? 0;
      return priceA - priceB;
    });
  }

  if (sortBy === 'distance') {
    if (!userLocation) {
      return ridesList;
    }
    return sorted.sort((a, b) => {
      const coordsA = getRideStartCoordinates(a);
      const coordsB = getRideStartCoordinates(b);
      const distA = coordsA ? calculateDistanceKm(userLocation, coordsA) : Number.POSITIVE_INFINITY;
      const distB = coordsB ? calculateDistanceKm(userLocation, coordsB) : Number.POSITIVE_INFINITY;
      return distA - distB;
    });
  }

  return sorted;
}

interface FindRidesScreenProps {
  onNavigateToOffer?: () => void;
}

export default function FindRidesScreen({ onNavigateToOffer }: FindRidesScreenProps) {
  const { user, rides, passengerRideIds, isRidesLoading, ridesError, fetchRides } = useApp();
  const [query, setQuery] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiQuery, setAiQuery] = useState<string>('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiParsedResult, setAiParsedResult] = useState<AiParseResponse | null>(null);
  const [filters, setFilters] = useState<RideSearchFilters>({
    from: '',
    to: '',
    date: '',
    time: '',
  });
  const [filterDay, setFilterDay] = useState<DayKey | null>(null);
  const [sortBy, setSortBy] = useState<SortOption | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [filterTwoSeats, setFilterTwoSeats] = useState<boolean>(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);

  /**
   * Отправка текста запроса в сервис GigaChat AI и автоматическое применение фильтров
   */
  const handleAiSearch = async (): Promise<void> => {
    const trimmed = aiQuery.trim();
    if (!trimmed) {
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const response = await api.parseAiRequest(trimmed);
      setAiParsedResult(response);

      const parsedFrom = response.from || response.start_point?.address || '';
      const parsedTo = response.to || response.end_point?.address || '';
      const parsedDate = response.date || '';
      const parsedTime = response.time || '';

      setFilters({
        from: parsedFrom,
        to: parsedTo,
        date: parsedDate,
        time: parsedTime,
      });

      // Если в ответе распознана дата, вычисляем день недели и выставляем чип
      if (parsedDate) {
        const dateObj = new Date(parsedDate);
        if (!isNaN(dateObj.getTime())) {
          const dayKeys: DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          setFilterDay(dayKeys[dateObj.getDay()]);
        }
      }

      // Если распознано количество мест от 2
      if (typeof response.seats === 'number' && response.seats >= 2) {
        setFilterTwoSeats(true);
      }

      // Если распознаны теги особенностей поездки
      if (Array.isArray(response.tags) && response.tags.length > 0) {
        setFilterTags((prev) => Array.from(new Set([...prev, ...response.tags!])));
      }

      // Автоматический вызов поиска поездок
      await fetchRides();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось распознать запрос с помощью ИИ';
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * Активирует сортировку по расстоянию и запрашивает геолокацию пользователя
   */
  const handleSelectSortDistance = (): void => {
    setSortBy('distance');

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error: GeolocationPositionError) => {
          console.warn('Ошибка получения геолокации:', error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleToggleTwoSeats = (): void => {
    setFilterTwoSeats((prev) => !prev);
  };

  const handleToggleTag = (tag: string): void => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleResetFilters = (): void => {
    setQuery('');
    setAiQuery('');
    setFilters({ from: '', to: '', date: '', time: '' });
    setFilterDay(null);
    setSortBy(null);
    setFilterTwoSeats(false);
    setFilterTags([]);
    setAiParsedResult(null);
    setAiError(null);
  };

  /**
   * Сбрасывает только параметры фильтрации и сортировки в шторке
   */
  const handleResetDrawerFilters = (): void => {
    setFilters({ from: '', to: '', date: '', time: '' });
    setSortBy(null);
    setFilterTwoSeats(false);
    setFilterTags([]);
  };

  /**
   * Подсчет общего количества активных фильтров для бейджа на кнопке
   */
  const activeFiltersCount = useMemo<number>(() => {
    let count = 0;
    if (filters.from.trim()) count += 1;
    if (filters.to.trim()) count += 1;
    if (filters.date.trim()) count += 1;
    if (filters.time.trim()) count += 1;
    if (sortBy !== null) count += 1;
    if (filterTwoSeats) count += 1;
    count += filterTags.length;
    return count;
  }, [filters, sortBy, filterTwoSeats, filterTags]);

  /**
   * Доступные теги для фильтрации поездок (согласованы со списком тегов при создании)
   */
  const availableFilterTags = useMemo<string[]>(() => Array.from(AVAILABLE_TAGS), []);

  const filteredRides = useMemo(() => {
    let result = rides;

    if (filterDay) {
      result = result.filter((r) => getRideDayKey(r) === filterDay);
    }

    if (filterTwoSeats) {
      result = result.filter((r) => (r.availableSeats ?? 0) >= 2);
    }

    if (filterTags.length > 0) {
      result = result.filter((r) => {
        const rideTags = r.tags ?? [];
        return filterTags.every((selectedTag) => rideTags.includes(selectedTag));
      });
    }

    if (filters.from.trim()) {
      const fromLower = filters.from.trim().toLowerCase();
      result = result.filter((r) => r.from.toLowerCase().includes(fromLower));
    }

    if (filters.to.trim()) {
      const toLower = filters.to.trim().toLowerCase();
      result = result.filter((r) => r.to.toLowerCase().includes(toLower));
    }

    if (filters.date.trim()) {
      const targetDate = filters.date.trim();
      result = result.filter((r) => {
        const rideDate = (r.departureTime || r.departure_time || r.dateString || '').slice(0, 10);
        return rideDate === targetDate;
      });
    }

    if (filters.time.trim()) {
      const targetTime = filters.time.trim();
      result = result.filter((r) => {
        if (r.time && r.time.startsWith(targetTime)) return true;
        const dep = r.departureTime || r.departure_time;
        if (dep) {
          const timePart = dep.slice(11, 16);
          return timePart === targetTime;
        }
        return false;
      });
    }

    if (query.trim()) {
      result = filterRidesByNlpQuery(result, query);
    }

    return sortRides(result, sortBy, userLocation);
  }, [rides, query, filters, filterDay, filterTwoSeats, filterTags, sortBy, userLocation]);

  return (
    <Box sx={{ pb: { xs: 12, sm: 8 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          Найти поездку
        </Typography>
        <Button
          size="small"
          variant="text"
          startIcon={<RefreshIcon />}
          onClick={() => fetchRides()}
          disabled={isRidesLoading}
          sx={{ borderRadius: 2, fontWeight: 600, px: 1.5 }}
        >
          Обновить
        </Button>
      </Stack>

      {ridesError && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2.5 }}>
          {ridesError}
        </Alert>
      )}

      {/* Ошибка распознавания AI */}
      {aiError && (
        <Alert
          severity="error"
          onClose={() => setAiError(null)}
          sx={{ mb: 2, borderRadius: 2.5 }}
        >
          {aiError}
        </Alert>
      )}

      {/* Быстрый поиск ИИ */}
      <AiSearchBanner
        query={aiQuery}
        onChangeQuery={setAiQuery}
        onSearch={handleAiSearch}
        isLoading={aiLoading}
      />

      {/* Предложение создать поездку водителю, если распознана роль водителя */}
      {aiParsedResult?.role === 'driver' && onNavigateToOffer && (
        <Alert
          severity="info"
          action={
            <Button
              color="primary"
              variant="contained"
              size="small"
              onClick={onNavigateToOffer}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Создать поездку
            </Button>
          }
          sx={{ mb: 2, borderRadius: 2.5 }}
        >
          ИИ определил, что вы хотите поехать как водитель. Вы можете сразу опубликовать эту поездку!
        </Alert>
      )}

      {/* Активные фильтры маршрута и времени */}
      {(Boolean(filters.from) || Boolean(filters.to) || Boolean(filters.date) || Boolean(filters.time)) && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 3,
            bgcolor: 'background.paper',
            borderColor: 'primary.light',
            boxShadow: '0 2px 8px -2px rgba(0, 113, 227, 0.12)',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
              Фильтры маршрута {aiParsedResult ? '• Распознано GigaChat' : ''}
            </Typography>
            <Button
              size="small"
              onClick={() => setFilters({ from: '', to: '', date: '', time: '' })}
              sx={{ fontSize: '0.75rem', p: 0, minWidth: 'auto', textTransform: 'none' }}
            >
              Сбросить
            </Button>
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {filters.from && (
              <Chip
                size="small"
                label={`Откуда: ${filters.from}`}
                onDelete={() => setFilters((prev) => ({ ...prev, from: '' }))}
                color="primary"
                variant="outlined"
              />
            )}
            {filters.to && (
              <Chip
                size="small"
                label={`Куда: ${filters.to}`}
                onDelete={() => setFilters((prev) => ({ ...prev, to: '' }))}
                color="primary"
                variant="outlined"
              />
            )}
            {filters.date && (
              <Chip
                size="small"
                label={`Дата: ${filters.date}`}
                onDelete={() => setFilters((prev) => ({ ...prev, date: '' }))}
                color="primary"
                variant="outlined"
              />
            )}
            {filters.time && (
              <Chip
                size="small"
                label={`Время: ${filters.time}`}
                onDelete={() => setFilters((prev) => ({ ...prev, time: '' }))}
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
        </Paper>
      )}

      {/* Кнопка вызова фильтров и сортировки */}
      <Box sx={{ mb: 1.5 }}>
        <Button
          variant={activeFiltersCount > 0 ? 'contained' : 'outlined'}
          startIcon={<FilterListIcon />}
          onClick={() => setIsFilterDrawerOpen(true)}
          sx={{
            borderRadius: 2.5,
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '0.875rem',
            px: 2,
            py: 0.75,
            borderColor: activeFiltersCount > 0 ? 'primary.main' : 'divider',
            boxShadow: activeFiltersCount > 0 ? '0 3px 12px rgba(0, 113, 227, 0.3)' : 'none',
          }}
        >
          Фильтры и сортировка
          {activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
        {DAY_KEYS.map((day) => (
          <Chip
            key={day}
            label={DAY_SHORT[day]}
            size="small"
            color={filterDay === day ? 'primary' : 'default'}
            variant={filterDay === day ? 'filled' : 'outlined'}
            onClick={() => setFilterDay(filterDay === day ? null : day)}
            sx={{
              fontWeight: 650,
              minWidth: 42,
              borderRadius: 2,
              py: 0.5,
              boxShadow: filterDay === day ? '0 2px 8px rgba(0, 113, 227, 0.28)' : 'none',
              transition: 'all 0.15s ease',
            }}
          />
        ))}
      </Box>

      {/* Results */}
      {isRidesLoading ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 3, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Paper>
          ))}
        </Stack>
      ) : aiLoading ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 3, height: 100 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  ИИ анализирует доступные поездки...
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : rides.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 3.5, sm: 4.5 },
            borderRadius: 4,
            textAlign: 'center',
            bgcolor: 'background.paper',
            borderStyle: 'dashed',
            borderColor: 'primary.light',
            boxShadow: '0 2px 12px -2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <Box
            sx={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.25,
              boxShadow: '0 6px 20px -2px rgba(0, 113, 227, 0.35)',
            }}
          >
            <DirectionsCarIcon sx={{ fontSize: 34 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, letterSpacing: '-0.015em' }}>
            Поездок пока нет, стань первым водителем!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
            Опубликуйте свой маршрут между кампусами или корпусами УрФУ, разделите расходы на бензин и помогите другим студентам добраться с комфортом.
          </Typography>
          {onNavigateToOffer && (
            <Button
              variant="contained"
              size="medium"
              startIcon={<AddIcon />}
              onClick={onNavigateToOffer}
              sx={{ px: 3.5, py: 1.1, borderRadius: 2.5, fontWeight: 700, boxShadow: '0 4px 16px rgba(0, 113, 227, 0.3)' }}
            >
              Создать поездку
            </Button>
          )}
        </Paper>
      ) : filteredRides.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            borderRadius: 3.5,
            textAlign: 'center',
            boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 650, mb: 0.5 }}>
            Поездки не найдены
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            По выбранным фильтрам ничего не найдено. Попробуйте сбросить параметры поиска.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleResetFilters}
            sx={{ borderRadius: 2.5, fontWeight: 600, px: 2 }}
          >
            Сбросить фильтры
          </Button>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {filteredRides.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              isPassenger={passengerRideIds.includes(ride.id) || Boolean(user?.id && ride.passengerIds?.includes(user.id))}
              isDriver={Boolean(user?.id && ride.driverId === user.id)}
            />
          ))}
        </Stack>
      )}

      {/* Нижняя шторка для настройки фильтров и сортировки */}
      <Drawer
        anchor="bottom"
        open={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            p: { xs: 2.5, sm: 3 },
            maxHeight: '85vh',
            maxWidth: { xs: '100%', sm: 540 },
            mx: 'auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Индикатор смахивания шторки */}
        <Box
          sx={{
            width: 40,
            height: 4,
            bgcolor: 'text.disabled',
            borderRadius: 2,
            mx: 'auto',
            mb: 2,
            opacity: 0.5,
          }}
        />

        {/* Заголовок шторки */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.15rem' }}>
            Фильтры и сортировка
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {activeFiltersCount > 0 && (
              <Button
                size="small"
                color="inherit"
                onClick={handleResetDrawerFilters}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.825rem' }}
              >
                Сбросить
              </Button>
            )}
            <IconButton
              size="small"
              onClick={() => setIsFilterDrawerOpen(false)}
              aria-label="Закрыть"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {/* Прокручиваемое содержимое с параметрами */}
        <Box sx={{ overflowY: 'auto', pr: 0.5, flex: 1, mb: 2.5 }}>
          {/* Маршрут и время */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              mb: 1.5,
            }}
          >
            Маршрут и время
          </Typography>
          <Stack spacing={1.5} sx={{ mb: 2.5 }}>
            <TextField
              label="Пункт отправления (откуда)"
              size="small"
              fullWidth
              placeholder="Например: УрФУ Мира 19"
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
            />
            <TextField
              label="Пункт назначения (куда)"
              size="small"
              fullWidth
              placeholder="Например: Кампус Новокольцовский"
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
            />
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Дата поездки"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={filters.date}
                onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
              />
              <TextField
                label="Время"
                type="time"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={filters.time}
                onChange={(e) => setFilters((prev) => ({ ...prev, time: e.target.value }))}
              />
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* Сортировка */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              mb: 1,
            }}
          >
            Сортировка
          </Typography>
          <RadioGroup
            value={sortBy ?? 'none'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'time') {
                setSortBy('time');
              } else if (val === 'price') {
                setSortBy('price');
              } else if (val === 'distance') {
                handleSelectSortDistance();
              } else {
                setSortBy(null);
              }
            }}
          >
            <FormControlLabel
              value="none"
              control={<Radio size="small" />}
              label={<Typography variant="body2">По умолчанию</Typography>}
              sx={{ my: 0.25 }}
            />
            <FormControlLabel
              value="time"
              control={<Radio size="small" />}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">По времени отправления</Typography>
                </Stack>
              }
              sx={{ my: 0.25 }}
            />
            <FormControlLabel
              value="price"
              control={<Radio size="small" />}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <PaymentsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">По цене (сначала дешевле)</Typography>
                </Stack>
              }
              sx={{ my: 0.25 }}
            />
            <FormControlLabel
              value="distance"
              control={<Radio size="small" />}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <NearMeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">По расстоянию (ближайшие)</Typography>
                </Stack>
              }
              sx={{ my: 0.25 }}
            />
          </RadioGroup>

          <Divider sx={{ my: 2 }} />

          {/* Количество мест */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              mb: 1.5,
            }}
          >
            Количество мест
          </Typography>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.25} alignItems="center">
              <AirlineSeatReclineNormalIcon sx={{ fontSize: 22, color: 'text.secondary' }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  От 2 мест
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Показать поездки с двумя и более свободными местами
                </Typography>
              </Box>
            </Stack>
            <Switch
              checked={filterTwoSeats}
              onChange={handleToggleTwoSeats}
              color="primary"
            />
          </Stack>

          {availableFilterTags.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />

              {/* Теги */}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  mb: 1.5,
                }}
              >
                Особенности поездки
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {availableFilterTags.map((tag) => {
                  const isSelected = filterTags.includes(tag);
                  return (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      clickable
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      onClick={() => handleToggleTag(tag)}
                      sx={{
                        fontWeight: isSelected ? 650 : 500,
                        borderRadius: 2.5,
                        boxShadow: isSelected ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  );
                })}
              </Box>
            </>
          )}
        </Box>

        {/* Кнопки действий */}
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setIsFilterDrawerOpen(false)}
            sx={{ borderRadius: 2.5, fontWeight: 600, textTransform: 'none', minWidth: 100 }}
          >
            Закрыть
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={() => setIsFilterDrawerOpen(false)}
            sx={{
              borderRadius: 2.5,
              fontWeight: 700,
              textTransform: 'none',
              py: 1.2,
              boxShadow: '0 4px 16px rgba(0, 113, 227, 0.3)',
            }}
          >
            Применить
          </Button>
        </Stack>
      </Drawer>
    </Box>
  );
}
