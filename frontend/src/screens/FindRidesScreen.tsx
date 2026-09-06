import { useState, useMemo, useEffect, useRef } from 'react';
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
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddIcon from '@mui/icons-material/Add';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PaymentsIcon from '@mui/icons-material/Payments';
import NearMeIcon from '@mui/icons-material/NearMe';
import AirlineSeatReclineNormalIcon from '@mui/icons-material/AirlineSeatReclineNormal';
import RideCard from '../components/RideCard';
import { useApp } from '../AppContext';
import { DAY_KEYS, DAY_SHORT, type DayKey, type Ride } from '../types';
import { getRideDayKey } from '../utils';

export type SortOption = 'time' | 'price' | 'distance';

interface Coordinates {
  lat: number;
  lon: number;
}

const DEFAULT_FILTER_TAGS: readonly string[] = [
  'С музыкой',
  'Можно с багажом',
  'Тихая поездка',
  'Не курить',
  'Чистый салон',
  'Можно с животными',
];

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
  const [filterDay, setFilterDay] = useState<DayKey | null>(null);
  const [sortBy, setSortBy] = useState<SortOption | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [filterTwoSeats, setFilterTwoSeats] = useState<boolean>(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const aiSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (aiSearchTimerRef.current) clearTimeout(aiSearchTimerRef.current);
    };
  }, []);

  const handleAiSearch = (): void => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    if (aiSearchTimerRef.current) clearTimeout(aiSearchTimerRef.current);
    aiSearchTimerRef.current = setTimeout(() => {
      setQuery(aiQuery);
      setAiLoading(false);
      aiSearchTimerRef.current = null;
    }, 1500);
  };

  const handleSortTime = (): void => {
    setSortBy((prev) => (prev === 'time' ? null : 'time'));
  };

  const handleSortPrice = (): void => {
    setSortBy((prev) => (prev === 'price' ? null : 'price'));
  };

  const handleSortDistance = (): void => {
    if (sortBy === 'distance') {
      setSortBy(null);
      return;
    }

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
    setFilterDay(null);
    setSortBy(null);
    setFilterTwoSeats(false);
    setFilterTags([]);
  };

  const availableFilterTags = useMemo<string[]>(() => {
    const tagSet = new Set<string>(DEFAULT_FILTER_TAGS);
    rides.forEach((ride) => {
      if (Array.isArray(ride.tags)) {
        ride.tags.forEach((tag) => {
          const trimmed = tag.trim();
          if (trimmed) {
            tagSet.add(trimmed);
          }
        });
      }
    });
    return Array.from(tagSet);
  }, [rides]);

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

    if (query.trim()) {
      result = filterRidesByNlpQuery(result, query);
    }

    return sortRides(result, sortBy, userLocation);
  }, [rides, query, filterDay, filterTwoSeats, filterTags, sortBy, userLocation]);

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

      {/* Quick AI Search */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: 3.5,
          background: 'linear-gradient(135deg, #0071e3 0%, #0056b3 50%, #003e85 100%)',
          boxShadow: '0 8px 24px -4px rgba(0, 113, 227, 0.35)',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            color: 'white',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 0.6,
            mb: 1.25,
            fontSize: '0.85rem',
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 16 }} />
          Быстрый поиск ИИ
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            placeholder="Например: Нужно уехать в среду к 8:30 из центра"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAiSearch();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'white',
                borderRadius: 2.5,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: 'transparent' },
                '&.Mui-focused fieldset': { borderColor: 'white' },
              },
              '& .MuiOutlinedInput-input': {
                color: '#0f172a',
              },
              '& .MuiOutlinedInput-input::placeholder': {
                color: '#64748b',
                opacity: 1,
              },
            }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleAiSearch}
            disabled={aiLoading}
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              borderRadius: 2.5,
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.92)',
                transform: 'scale(1.04)',
              },
              minWidth: 44,
              px: 1.5,
            }}
          >
            {aiLoading ? <CircularProgress size={20} /> : <SearchIcon />}
          </Button>
        </Stack>
      </Paper>

      {/* Панель фильтров и сортировки */}
      <Box
        sx={{
          mb: 1.5,
          overflowX: 'auto',
          py: 0.5,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 'max-content' }}>
          {/* Сортировка по времени */}
          <Chip
            icon={<AccessTimeIcon sx={{ fontSize: 18 }} />}
            label="По времени"
            size="small"
            clickable
            color={sortBy === 'time' ? 'primary' : 'default'}
            variant={sortBy === 'time' ? 'filled' : 'outlined'}
            onClick={handleSortTime}
            sx={{
              fontWeight: sortBy === 'time' ? 700 : 500,
              borderRadius: 2.5,
              boxShadow: sortBy === 'time' ? '0 2px 8px rgba(0, 113, 227, 0.28)' : 'none',
              transition: 'all 0.15s ease',
            }}
          />

          {/* Сортировка по цене */}
          <Chip
            icon={<PaymentsIcon sx={{ fontSize: 18 }} />}
            label="По цене"
            size="small"
            clickable
            color={sortBy === 'price' ? 'primary' : 'default'}
            variant={sortBy === 'price' ? 'filled' : 'outlined'}
            onClick={handleSortPrice}
            sx={{
              fontWeight: sortBy === 'price' ? 700 : 500,
              borderRadius: 2.5,
              boxShadow: sortBy === 'price' ? '0 2px 8px rgba(0, 113, 227, 0.28)' : 'none',
              transition: 'all 0.15s ease',
            }}
          />

          {/* Сортировка по расстоянию */}
          <Chip
            icon={<NearMeIcon sx={{ fontSize: 18 }} />}
            label="По расстоянию"
            size="small"
            clickable
            color={sortBy === 'distance' ? 'primary' : 'default'}
            variant={sortBy === 'distance' ? 'filled' : 'outlined'}
            onClick={handleSortDistance}
            sx={{
              fontWeight: sortBy === 'distance' ? 700 : 500,
              borderRadius: 2.5,
              boxShadow: sortBy === 'distance' ? '0 2px 8px rgba(0, 113, 227, 0.28)' : 'none',
              transition: 'all 0.15s ease',
            }}
          />

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

          {/* Фильтр: от 2 мест */}
          <Chip
            icon={<AirlineSeatReclineNormalIcon sx={{ fontSize: 18 }} />}
            label="От 2 мест"
            size="small"
            clickable
            color={filterTwoSeats ? 'secondary' : 'default'}
            variant={filterTwoSeats ? 'filled' : 'outlined'}
            onClick={handleToggleTwoSeats}
            sx={{
              fontWeight: filterTwoSeats ? 700 : 500,
              borderRadius: 2.5,
              boxShadow: filterTwoSeats ? '0 2px 8px rgba(156, 39, 176, 0.28)' : 'none',
              transition: 'all 0.15s ease',
            }}
          />

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

          {/* Фильтры по тегам */}
          {availableFilterTags.map((tag) => {
            const isSelected = filterTags.includes(tag);
            return (
              <Chip
                key={tag}
                label={tag}
                size="small"
                clickable
                color={isSelected ? 'info' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                onClick={() => handleToggleTag(tag)}
                sx={{
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: 2.5,
                  boxShadow: isSelected ? '0 2px 8px rgba(2, 136, 209, 0.28)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              />
            );
          })}
        </Stack>
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
    </Box>
  );
}
