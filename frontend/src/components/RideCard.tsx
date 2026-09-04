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
import SendIcon from '@mui/icons-material/Send';
import type { Ride } from '../types';
import { formatDays, formatPrice } from '../utils';

interface RideCardProps {
  ride: Ride;
  isPassenger?: boolean;
  isDriver?: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
}

export default function RideCard({ ride, isPassenger, isDriver, onJoin, onLeave }: RideCardProps) {
  const [expanded, setExpanded] = useState(false);

  const initials = ride.driverName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card
      variant="outlined"
      onClick={() => setExpanded(!expanded)}
      sx={{
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        '&:hover': { borderColor: 'primary.main' },
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
            <Stack direction="row" spacing={0.5} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {ride.time}
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {formatPrice(ride.price)}
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

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <LocationOnIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                {ride.from}
              </Typography>
            </Stack>
            <Box sx={{ ml: 0.7, my: 0.3, borderLeft: '2px dashed', borderColor: 'divider', height: 8 }} />
            <Stack direction="row" spacing={0.5} alignItems="center">
              <LocationOnIcon sx={{ fontSize: 14, color: 'error.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                {ride.to}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            icon={<EventIcon sx={{ fontSize: 14 }} />}
            label={formatDays(ride.days)}
            variant="outlined"
            sx={{ maxWidth: '100%' }}
          />
          {ride.isPeak && (
            <Chip
              size="small"
              icon={<BoltIcon sx={{ fontSize: 14 }} />}
              label="+30% Пиковый спрос"
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
                Это ваш маршрут. Пассажиры, которые присоединятся, свяжутся с вами через Telegram.
              </Typography>
            ) : (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.light', width: 32, height: 32, fontSize: 12 }}>
                  {initials}
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {ride.driverName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    @{ride.telegram}
                  </Typography>
                </Box>
              </Stack>
            )}

            <Stack direction="row" spacing={1}>
              {!isDriver && (
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  startIcon={<SendIcon />}
                  href={`https://t.me/${ride.telegram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Написать в Telegram
                </Button>
              )}
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
              {!isDriver && !isPassenger && onJoin && (
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJoin();
                  }}
                >
                  Присоединиться
                </Button>
              )}
            </Stack>
          </Box>
        </Box>
      </Collapse>
    </Card>
  );
}
