import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FilterListIcon from '@mui/icons-material/FilterList';
import RideCard from '../components/RideCard';
import { useApp } from '../AppContext';
import { DAY_KEYS, DAY_SHORT, type DayKey } from '../types';

export default function FindRidesScreen() {
  const { rides, passengerRideIds, joinRide, leaveRide } = useApp();
  const [query, setQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [filterDay, setFilterDay] = useState<DayKey | null>(null);
  const [filterDest, setFilterDest] = useState('');

  const handleAiSearch = () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setTimeout(() => {
      setQuery(aiQuery);
      setAiLoading(false);
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
      const q = query.toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);

      const dayMap: Record<string, DayKey> = {
        понедельник: 'Mon', пн: 'Mon',
        вторник: 'Tue', вт: 'Tue',
        среда: 'Wed', среду: 'Wed', ср: 'Wed',
        четверг: 'Thu', чт: 'Thu',
        пятница: 'Fri', пт: 'Fri',
        суббота: 'Sat', сб: 'Sat',
        воскресенье: 'Sun', вс: 'Sun',
        wednesday: 'Wed', wed: 'Wed',
        monday: 'Mon', tuesday: 'Tue',
        thursday: 'Thu', friday: 'Fri',
        saturday: 'Sat', sunday: 'Sun',
      };

      let dayFilter: DayKey | null = null;
      let timeFilter: string | null = null;

      for (const word of words) {
        const lower = word.toLowerCase();
        if (dayMap[lower]) dayFilter = dayMap[lower];
        const timeMatch = word.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
        if (timeMatch) {
          let h = parseInt(timeMatch[1]);
          const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const ampm = timeMatch[3]?.toLowerCase();
          if (ampm === 'pm' && h < 12) h += 12;
          if (ampm === 'am' && h === 12) h = 0;
          timeFilter = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }

      result = result.filter((r) => {
        let score = 0;
        for (const word of words) {
          if (r.from.toLowerCase().includes(word)) score++;
          if (r.to.toLowerCase().includes(word)) score++;
          if (r.driverName.toLowerCase().includes(word)) score++;
        }
        if (dayFilter && r.days.includes(dayFilter)) score += 2;
        if (timeFilter && r.time === timeFilter) score += 2;

        const hasTextMatch = words.some(
          (w) =>
            r.from.toLowerCase().includes(w) ||
            r.to.toLowerCase().includes(w) ||
            r.driverName.toLowerCase().includes(w),
        );

        return score > 0 || hasTextMatch || (!dayFilter && !timeFilter && words.length === 0);
      });
    }

    return result;
  }, [rides, query, filterDay, filterDest]);

  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Найти поездку
      </Typography>

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
      {aiLoading ? (
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
      ) : filteredRides.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Поездки не найдены. Попробуйте изменить фильтры.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {filteredRides.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              isPassenger={passengerRideIds.includes(ride.id)}
              onJoin={() => joinRide(ride.id)}
              onLeave={() => leaveRide(ride.id)}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
