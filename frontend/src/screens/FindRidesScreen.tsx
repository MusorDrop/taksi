import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FilterListIcon from '@mui/icons-material/FilterList';
import RideCard from '../components/RideCard';
import { useApp } from '../AppContext';
import { geocode, haversineKm, nextDepartureIso, parseNaturalQuery, reverseGeocode } from '../geo';
import type { RideSearchParams } from '../types';

export default function FindRidesScreen() {
  const { rides, loading, searchRides, myTrips, joinRide, leaveRide } = useApp();
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [noGeoHint, setNoGeoHint] = useState('');
  const [filterDest, setFilterDest] = useState('');

  const joinedIds = useMemo(
    () => new Set((myTrips?.passengerRides ?? []).map((r) => r.id)),
    [myTrips],
  );

  const handleAiSearch = async () => {
    const q = aiQuery.trim();
    if (!q) return;
    setAiLoading(true);
    setSearchError('');
    setNoGeoHint('');
    try {
      const parsed = parseNaturalQuery(q);
      const params: RideSearchParams = { radius: 1000 };
      if (parsed.start) params.start = parsed.start;
      if (parsed.end) params.end = parsed.end;
      if (parsed.time) params.departureTime = nextDepartureIso(parsed.time);

      if (!parsed.start && !parsed.end && !parsed.time) {
        setNoGeoHint('Не удалось распознать локации и время — показаны ближайшие поездки.');
      } else if (!parsed.start && !parsed.end) {
        setNoGeoHint('Локации не распознаны — показаны поездки по времени.');
      }
      await searchRides(params);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Ошибка поиска. Попробуйте ещё раз.');
    } finally {
      setAiLoading(false);
    }
  };

  const displayedRides = useMemo(() => {
    if (!filterDest.trim()) return rides;
    const q = filterDest.toLowerCase();
    const point = geocode(q);
    if (point) {
      return rides.filter(
        (r) => haversineKm(r.end, point) <= 3 || haversineKm(r.start, point) <= 3,
      );
    }
    return rides.filter((r) => {
      const fromName = reverseGeocode(r.start).toLowerCase();
      const toName = reverseGeocode(r.end).toLowerCase();
      return fromName.includes(q) || toName.includes(q);
    });
  }, [rides, filterDest]);

  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Найти поездку
      </Typography>

      {/* Быстрый ИИ-поиск */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mb: 2,
          borderRadius: 3,
          borderColor: 'primary.light',
          bgcolor: 'primary.main',
        }}
      >
        <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, display: 'block', mb: 1 }}>
          <AutoAwesomeIcon sx={{ fontSize: 14, mr: 0.5, mb: -0.3 }} />
          Быстрый поиск ИИ
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            placeholder="Например: Нужно уехать в среду к 8:30 из центра в кампус"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAiSearch();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': { bgcolor: 'white', borderRadius: 2 },
            }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={() => void handleAiSearch()}
            disabled={aiLoading}
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              '&:hover': { bgcolor: 'grey.100' },
              minWidth: 44,
              px: 1.5,
            }}
          >
            {aiLoading ? <CircularProgress size={20} /> : <SearchIcon />}
          </Button>
        </Stack>
      </Paper>

      {noGeoHint && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {noGeoHint}
        </Alert>
      )}
      {searchError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {searchError}
        </Alert>
      )}

      {/* Фильтр по локации */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
        <FilterListIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <TextField
          size="small"
          placeholder="Фильтр по локации"
          value={filterDest}
          onChange={(e) => setFilterDest(e.target.value)}
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>
{/* Результаты */}
      {loading || aiLoading ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 3, height: 100 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Ищем подходящие поездки...
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : displayedRides.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Поездки не найдены. Попробуйте изменить запрос или создать свою поездку.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {displayedRides.map((ride) => {
            const joined = joinedIds.has(ride.id);
            return (
              <RideCard
                key={ride.id}
                ride={ride}
                isPassenger={joined}
                onJoin={() => void joinRide(ride.id)}
                onLeave={() => void leaveRide(ride.id)}
              />
            );
          })}
        </Stack>
      )}
    </Box>
  );
}