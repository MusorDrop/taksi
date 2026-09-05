import { useEffect, useState } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupIcon from '@mui/icons-material/Group';
import StarIcon from '@mui/icons-material/Star';
import SendIcon from '@mui/icons-material/Send';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import CircularProgress from '@mui/material/CircularProgress';
import { apiRidePassengers } from '../api';
import { formatDateTime } from '../utils';
import type { Ride, RidePassenger } from '../types';

interface PassengersCardProps {
  ride: Ride;
  /** Панель присоединена к карточке поездки сверху — верхние углы прямые, без двойной рамки */
  attachedTop?: boolean;
}

/** Отображаемое имя пассажира: Имя Фамилия, иначе @username */
function passengerName(p: RidePassenger): string {
  const full = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  return full || p.username;
}

/**
 * Список пассажиров поездки — показывается водителю во вкладке «Мои поездки»
 * под карточкой его маршрута. Обновляется при изменении числа свободных мест.
 */
export default function PassengersCard({ ride, attachedTop = false }: PassengersCardProps) {
  const [passengers, setPassengers] = useState<RidePassenger[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // Список свёрнут по умолчанию — раскрывается нажатием на шапку
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRidePassengers(ride.id)
      .then((data) => {
        if (!cancelled) {
          setPassengers(data.passengers);
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить список пассажиров');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ride.id, ride.availableSeats]);

  const takenSeats = passengers ? passengers.length : (ride.totalSeats ?? 0) - (ride.availableSeats ?? 0);

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        p: 2,
        bgcolor: 'rgba(21, 101, 192, 0.03)',
        ...(attachedTop && {
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          // стык рисует нижняя граница карточки поездки — свою верхнюю убираем,
          // чтобы не было двойной линии
          borderTop: 'none',
        }),
      }}
    >
      <Stack
        component="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          width: '100%',
          p: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'inherit',
          fontFamily: 'inherit',
          borderRadius: 1,
          '&:hover': { bgcolor: 'rgba(21, 101, 192, 0.06)' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
        }}
      >
        <GroupIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          Пассажиры
        </Typography>
        <Chip
          size="small"
          label={`${takenSeats} из ${ride.totalSeats ?? '—'}`}
          color={takenSeats > 0 ? 'primary' : 'default'}
          variant={takenSeats > 0 ? 'filled' : 'outlined'}
        />
        <ExpandMoreIcon
          sx={{
            fontSize: 20,
            color: 'text.secondary',
            transition: 'transform 0.25s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </Stack>

      <Collapse in={open}>
        <Box sx={{ pt: 1.5 }}>
      {loading && passengers === null && (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Загружаем пассажиров…
          </Typography>
        </Stack>
      )}

      {!loading && error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}

      {!error && passengers !== null && passengers.length === 0 && (
        <Stack direction="row" spacing={1} alignItems="center">
          <PersonOutlineIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            Пока никто не присоединился — пассажиры найдут вашу поездку во вкладке «Найти поездку».
          </Typography>
        </Stack>
      )}

      {!error && passengers !== null && passengers.length > 0 && (
        <Stack spacing={1.5}>
          {passengers.map((p) => (
            <Stack key={p.id} direction="row" spacing={1.5} alignItems="center">
              <Avatar
                sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 15, fontWeight: 700 }}
              >
                {passengerName(p).charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                  {passengerName(p)}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <StarIcon sx={{ fontSize: 14, color: '#f9a825' }} />
                  <Typography variant="caption" color="text.secondary">
                    {p.rating !== null ? p.rating.toFixed(1) : 'нет оценок'}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" noWrap>
                    · с {formatDateTime(p.joinedAt)}
                  </Typography>
                </Stack>
              </Box>
              {p.telegramUsername && (
                <Tooltip title={`Написать в Telegram (@${p.telegramUsername})`}>
                  <IconButton
                    size="small"
                    component="a"
                    href={`https://t.me/${p.telegramUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Написать пассажиру ${passengerName(p)} в Telegram`}
                    sx={{ color: 'primary.main' }}
                  >
                    <SendIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          ))}
        </Stack>
      )}
        </Box>
      </Collapse>
    </Paper>
  );
}
