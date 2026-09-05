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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Rating from '@mui/material/Rating';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import BoltIcon from '@mui/icons-material/Bolt';
import SendIcon from '@mui/icons-material/Send';
import StarIcon from '@mui/icons-material/Star';
import type { Ride } from '../types';
import { formatAvatarUrl } from '../utils';
import { api } from '../api';

interface RideCardProps {
  ride: Ride;
  isPassenger?: boolean;
  isDriver?: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
}

export default function RideCard({ ride, isPassenger, isDriver, onJoin, onLeave }: RideCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isReviewed, setIsReviewed] = useState<boolean>(false);

  const isCompleted = ride.status === 'completed';

  // Отправка отзыва о поездке через POST /api/reviews
  const handleSubmitReview = async (): Promise<void> => {
    if (isSubmittingReview) return;
    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      await api.post('/api/reviews', {
        ride_id: ride.id,
        reviewee_id: ride.driverId,
        rating,
        comment: comment.trim() || undefined,
      });
      setIsReviewed(true);
      setReviewDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось отправить отзыв';
      setReviewError(message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const initials = ride.driverName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const passengerCount = (Array.isArray(ride.passengerIds) && ride.passengerIds.length > 0)
    ? ride.passengerIds.length
    : (ride.totalSeats !== undefined && ride.availableSeats !== undefined
        ? Math.max(0, ride.totalSeats - ride.availableSeats)
        : (isPassenger ? 1 : 0));
  const hasMultiplePassengers = passengerCount > 1 || ride.currentPrice < ride.price;

  const avatarUrl = formatAvatarUrl(ride.driverAvatarUrl);

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
          <Avatar
            src={avatarUrl}
            alt={ride.driverName}
            sx={{ bgcolor: 'primary.main', width: 40, height: 40, fontSize: 14 }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {ride.driverName}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {ride.time} • {ride.distanceKm} км
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {ride.currentPrice} ₽{hasMultiplePassengers ? ' с человека' : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem', lineHeight: 1.2, mt: 0.3 }}>
              Общая сумма: {ride.price} ₽. Раздели цену с попутчиками!
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
            label={ride.dateFormatted || ride.dateString || 'Сегодня'}
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
          {isCompleted && (
            <Chip
              size="small"
              icon={<StarIcon sx={{ fontSize: 14 }} />}
              label={isReviewed ? 'Отзыв отправлен' : 'Поездка завершена'}
              color="success"
              variant="outlined"
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
                <Avatar
                  src={avatarUrl}
                  alt={ride.driverName}
                  sx={{ bgcolor: 'primary.light', width: 32, height: 32, fontSize: 12 }}
                >
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
              {isCompleted && !isDriver && (
                <Button
                  fullWidth
                  variant={isReviewed ? 'outlined' : 'contained'}
                  color={isReviewed ? 'inherit' : 'primary'}
                  size="small"
                  disabled={isReviewed}
                  startIcon={<StarIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setReviewDialogOpen(true);
                  }}
                >
                  {isReviewed ? 'Отзыв оставлен ✓' : 'Оставить отзыв'}
                </Button>
              )}
              {!isDriver && (
                <Button
                  fullWidth
                  variant={isCompleted ? 'outlined' : 'contained'}
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
              {!isDriver && isPassenger && onLeave && !isCompleted && (
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
              {!isDriver && !isPassenger && onJoin && !isCompleted && (
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

      {/* Модальное окно создания отзыва */}
      <Dialog
        open={reviewDialogOpen}
        onClose={() => !isSubmittingReview && setReviewDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Оценить поездку</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Водитель: <strong>{ride.driverName}</strong>
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">Ваша оценка:</Typography>
              <Rating
                value={rating}
                onChange={(_, val) => setRating(val || 5)}
                max={5}
              />
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Отзыв (необязательно)"
              placeholder="Как прошла поездка? Пунктуальность, аккуратность вождения..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            {reviewError && (
              <Alert severity="error" onClose={() => setReviewError(null)}>
                {reviewError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setReviewDialogOpen(false)}
            disabled={isSubmittingReview}
            color="inherit"
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitReview}
            disabled={isSubmittingReview}
            startIcon={isSubmittingReview ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isSubmittingReview ? 'Отправка...' : 'Отправить отзыв'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
