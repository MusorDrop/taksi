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
import RefreshIcon from '@mui/icons-material/Refresh';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddIcon from '@mui/icons-material/Add';
import RideCard from '../components/RideCard';
import { useApp } from '../AppContext';
import { DAY_KEYS, DAY_SHORT, type DayKey } from '../types';
import { getRideDayKey } from '../utils';

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
      result = result.filter((r) => getRideDayKey(r) === filterDay);
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

      {/* Filters */}
      <Stack direction="row" spacing={1} sx={{ mb: 1.75 }} alignItems="center">
        <TextField
          fullWidth
          size="small"
          placeholder="Фильтр по назначению"
          value={filterDest}
          onChange={(e) => setFilterDest(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2.5,
              bgcolor: 'background.paper',
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

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
            onClick={() => {
              setQuery('');
              setAiQuery('');
              setFilterDay(null);
              setFilterDest('');
            }}
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
              onJoin={(selectedDay) => joinRide(ride.id, selectedDay)}
              onLeave={() => leaveRide(ride.id)}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
