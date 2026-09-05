import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import BoltIcon from '@mui/icons-material/Bolt';
import StarIcon from '@mui/icons-material/Star';
import PhoneIcon from '@mui/icons-material/Phone';
import SendIcon from '@mui/icons-material/Send';
import type { Ride } from '../types';
import { formatDateTime, formatPrice, formatSeats } from '../utils';
import { reverseGeocode } from '../geo';

interface RideCardProps {
  ride: Ride;
  isPassenger?: boolean;
  isDriver?: boolean;
  /** Снизу примыкает панель (например, пассажиры) — нижние углы прямые, единый контур */
  attachedBottom?: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
}

export default function RideCard({
  ride,
  isPassenger,
  isDriver,
  attachedBottom = false,
  onJoin,
  onLeave,
}: RideCardProps) {
  const [expanded, setExpanded] = useState(false);

  const initials = ride.driverName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const fromName = reverseGeocode(ride.start);
  const toName = reverseGeocode(ride.end);
  const noSeats = ride.availableSeats <= 0;
  const showJoin = !isDriver && !isPassenger && onJoin && !noSeats;
  const telegramUrl = ride.driverTelegramUsername
    ? `https://t.me/${ride.driverTelegramUsername}`
    : null;

  return (
    <Card
      variant="outlined"
      onClick={() => setExpanded(!expanded)}
      sx={{
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        '&:hover': { borderColor: 'primary.main' },
        ...(attachedBottom && {
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }),
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, fontSize: 14 }}>
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {ride.driverName}
            </Typography>
            {ride.driverRating !== null && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <StarIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                <Typography variant="caption" color="text.secondary">
                  {ride.driverRating.toFixed(1)}
                </Typography>
              </Stack>
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {formatPrice(ride.basePrice)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ride.distanceKm} км
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <LocationOnIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
              {fromName}
            </Typography>
          </Stack>
          <Box sx={{ ml: 0.7, my: 0.3, borderLeft: '2px dashed', borderColor: 'divider', height: 8 }} />
          <Stack direction="row" spacing={0.5} alignItems="center">
            <LocationOnIcon sx={{ fontSize: 14, color: 'error.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
              {toName}
            </Typography>
          </Stack>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            icon={<EventIcon sx={{ fontSize: 14 }} />}
            label={formatDateTime(ride.departureTime)}
            variant="outlined"
            sx={{ maxWidth: '100%' }}
          />
          <Chip
            size="small"
            icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
            label={`Мест: ${formatSeats(ride)}`}
            variant="outlined"
          />
          {ride.isPeak && (
            <Chip
              size="small"
              icon={<BoltIcon sx={{ fontSize: 14 }} />}
              label="+30% Часы пик"
              color="warning"
              sx={{ fontWeight: 600 }}
            />
          )}
        </Stack>
      </CardContent>

      <Collapse in={expanded}>
        <Box sx={{ p: 2, pt: 0 }}>
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
            {isDriver ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Это ваш маршрут. Пассажиры — под карточкой: нажмите строку «Пассажиры», чтобы раскрыть список.
              </Typography>
            ) : (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {ride.driverName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ride.driverPhone ? `Телефон: ${ride.driverPhone}` : 'Телефон не указан'}
                  </Typography>
                </Box>
                {ride.driverPhone && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhoneIcon />}
                    href={`tel:${ride.driverPhone}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Позвонить
                  </Button>
                )}
              </Stack>
            )}

            <Stack direction="row" spacing={1}>
              {!isDriver && isPassenger && onLeave && (
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLeave();
                  }}
                >
                  Отменить участие
                </Button>
              )}
              {showJoin && (
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJoin();
                  }}
                >
                  Присоединиться
                </Button>
              )}
              {!isDriver && telegramUrl && (
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  startIcon={<SendIcon />}
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  sx={{ minWidth: 150 }}
                >
                  Написать в Telegram
                </Button>
              )}
              {!isDriver && !isPassenger && noSeats && (
                <Typography variant="body2" color="error" sx={{ width: '100%', textAlign: 'center' }}>
                  Свободных мест нет
                </Typography>
              )}
            </Stack>
          </Box>
        </Box>
      </Collapse>
    </Card>
  );
}