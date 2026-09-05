import { useState, useMemo, useEffect, useRef } from 'react';
import { filterRidesByNlpQuery } from '../utils/nlpParser';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddIcon from '@mui/icons-material/Add';
import RideCard from '../components/RideCard';
import { useApp } from '../AppContext';
import { DAY_KEYS, DAY_SHORT, type DayKey } from '../types';

interface FindRidesScreenProps {
  onNavigateToOffer?: () => void;
}

export default function FindRidesScreen({ onNavigateToOffer }: FindRidesScreenProps) {
  const { user, rides, passengerRideIds, joinRide, leaveRide, isRidesLoading, ridesError, fetchRides } = useApp();
  const [query, setQuery] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiQuery, setAiQuery] = useState<string>('');
  const [filterDay, setFilterDay] = useState<DayKey | null>(null);
  const [filterDest, setFilterDest] = useState<string>('');

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

  const filteredRides = useMemo(() => {
    let result = rides;

    if (filterDay) {
      result = result.filter((r) => r.days.includes(filterDay));
    }

    if (filterDest.trim()) {
      const q = filterDest.toLowerCase();
      result = result.filter(
        (r) => r.to.toLowerCase().includes(q) || r.from.toLowerCase().includes(q),
      );
    }

    if (query.trim()) {
      result = filterRidesByNlpQuery(result, query);
    }

    return result;
  }, [rides, query, filterDay, filterDest]);

  return (
    <Box sx={{ pb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Найти поездку
        </Typography>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => fetchRides()}
          disabled={isRidesLoading}
        >
          Обновить
        </Button>
      </Stack>

      {ridesError && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          {ridesError}
        </Alert>
      )}

      {/* Quick AI Search */}
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
                borderRadius: 2,
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
              '&:hover': { bgcolor: 'grey.100' },
              minWidth: 44,
              px: 1.5,
            }}
          >
            {aiLoading ? <CircularProgress size={20} /> : <SearchIcon />}
          </Button>
        </Stack>
      </Paper>

      {/* Filters */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
        <FilterListIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <TextField
          size="small"
          placeholder="Фильтр по назначению"
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

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
        {DAY_KEYS.map((day) => (
          <Chip
            key={day}
            label={DAY_SHORT[day]}
            size="small"
            color={filterDay === day ? 'primary' : 'default'}
            variant={filterDay === day ? 'filled' : 'outlined'}
            onClick={() => setFilterDay(filterDay === day ? null : day)}
            sx={{ fontWeight: 600, minWidth: 40 }}
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
            p: 4,
            borderRadius: 3,
            textAlign: 'center',
            bgcolor: 'background.paper',
            borderStyle: 'dashed',
            borderColor: 'primary.light',
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'primary.light',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <DirectionsCarIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Поездок пока нет, стань первым водителем!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mx: 'auto', mb: 2.5 }}>
            Опубликуйте свой маршрут между кампусами или корпусами УрФУ, разделите расходы на бензин и помогите другим студентам добраться с комфортом.
          </Typography>
          {onNavigateToOffer && (
            <Button
              variant="contained"
              size="medium"
              startIcon={<AddIcon />}
              onClick={onNavigateToOffer}
              sx={{ px: 3, py: 1 }}
            >
              Создать поездку
            </Button>
          )}
        </Paper>
      ) : filteredRides.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Поездки не найдены
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            По выбранным фильтрам ничего не найдено. Попробуйте сбросить параметры поиска.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setQuery('');
              setAiQuery('');
              setFilterDay(null);
              setFilterDest('');
            }}
          >
            Сбросить фильтры
          </Button>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {filteredRides.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              isPassenger={passengerRideIds.includes(ride.id) || Boolean(user?.id && ride.passengerIds?.includes(user.id))}
              isDriver={Boolean(user?.id && ride.driverId === user.id)}
              onJoin={() => joinRide(ride.id)}
              onLeave={() => leaveRide(ride.id)}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
