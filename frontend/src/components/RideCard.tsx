import { useMemo, useState } from 'react';
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
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import BoltIcon from '@mui/icons-material/Bolt';
import SendIcon from '@mui/icons-material/Send';
import StarIcon from '@mui/icons-material/Star';
import PhoneIcon from '@mui/icons-material/Phone';
import EditIcon from '@mui/icons-material/Edit';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import RepeatIcon from '@mui/icons-material/Repeat';
import GroupIcon from '@mui/icons-material/Group';
import { DAY_FULL, DAY_SHORT, type DayKey, type Ride } from '../types';
import { formatAvatarUrl } from '../utils';
import { api } from '../api';
import { useApp } from '../AppContext';
import RouteMap from './RouteMap';

/**
 * Преобразование дня недели (Mon, Tue...) в краткий русский формат (Пн, Вт...)
 * @param day - Ключ дня или строка
 * @returns Название дня на русском
 */
function formatDayToRussian(day?: string | null): string {
  if (!day) return '';
  const trimmed = day.trim();
  const matchKey = (Object.keys(DAY_SHORT) as DayKey[]).find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  return matchKey ? DAY_SHORT[matchKey] : trimmed;
}

/**
 * Преобразование списка дней на русский язык (Пн, Вт, Ср...)
 * @param daysStr - Строка дней через запятую
 * @returns Список дней на русском через запятую
 */
function formatDaysToRussian(daysStr?: string | null): string {
  if (!daysStr) return '';
  return daysStr
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
    .map(formatDayToRussian)
    .join(', ');
}

/**
 * Получение полного названия дня с кратким обозначением (например: "Среда (Ср)")
 * @param day - Ключ дня
 * @returns Отформатированное название
 */
function getDayFullLabel(day: string): string {
  const trimmed = day.trim();
  const matchKey = (Object.keys(DAY_FULL) as DayKey[]).find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  if (matchKey) {
    return `${DAY_FULL[matchKey]} (${DAY_SHORT[matchKey]})`;
  }
  return trimmed;
}

interface RideCardProps {
  ride: Ride;
  isPassenger?: boolean;
  isDriver?: boolean;
  onJoin?: (selectedDay?: string) => void | Promise<void>;
  onLeave?: () => void;
}

export default function RideCard({ ride, isPassenger, isDriver, onJoin, onLeave }: RideCardProps) {
  const { kickPassenger, updateRide, joinRide } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isReviewed, setIsReviewed] = useState<boolean>(false);

  // Выбор дня для регулярной поездки
  const [joinDialogOpen, setJoinDialogOpen] = useState<boolean>(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Исключение пассажира водителем
  const [kickingPassengerId, setKickingPassengerId] = useState<string | null>(null);
  const [kickError, setKickError] = useState<string | null>(null);

  // Редактирование маршрута водителем
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [editFrom, setEditFrom] = useState<string>(ride.from);
  const [editTo, setEditTo] = useState<string>(ride.to);
  const [editTime, setEditTime] = useState<string>(ride.time);
  const [editPrice, setEditPrice] = useState<string>(String(ride.price));
  const [editSeats, setEditSeats] = useState<string>(String(ride.totalSeats || 4));
  const [isUpdatingRide, setIsUpdatingRide] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const handleKickPassenger = async (passengerId: string): Promise<void> => {
    setKickingPassengerId(passengerId);
    setKickError(null);
    try {
      await kickPassenger(ride.id, passengerId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось исключить пассажира';
      setKickError(message);
    } finally {
      setKickingPassengerId(null);
    }
  };

  const handleSaveRide = async (): Promise<void> => {
    const numPrice = Number(editPrice);
    const numSeats = Number(editSeats);
    if (!editFrom.trim() || !editTo.trim() || !editTime.trim() || !numPrice || !numSeats) {
      setEditError('Заполните все обязательные поля');
      return;
    }
    setIsUpdatingRide(true);
    setEditError(null);
    try {
      await updateRide(ride.id, {
        from: editFrom.trim(),
        to: editTo.trim(),
        time: editTime.trim(),
        price: numPrice,
        seats: numSeats,
        total_seats: numSeats,
      });
      setEditDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось обновить маршрут';
      setEditError(message);
    } finally {
      setIsUpdatingRide(false);
    }
  };

  const initials = ride.driverName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarUrl = formatAvatarUrl(ride.driverAvatarUrl);
  const isRegular = ride.rideType === 'regular' || ride.ride_type === 'regular';
  const regularLabel = formatDaysToRussian(ride.regularDays || ride.regular_days) || 'Регулярная';

  const availableDays = useMemo(() => {
    const raw = ride.regular_days || ride.regularDays || '';
    const parsed = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  }, [ride.regular_days, ride.regularDays]);

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRegular) {
      const defaultDay = availableDays[0] || 'Mon';
      setSelectedDay(defaultDay);
      setJoinError(null);
      setJoinDialogOpen(true);
    } else {
      if (onJoin) {
        onJoin();
      } else {
        joinRide(ride.id);
      }
    }
  };

  const handleConfirmJoin = async (): Promise<void> => {
    if (!selectedDay) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      if (onJoin) {
        await onJoin(selectedDay);
      } else {
        await joinRide(ride.id, selectedDay);
      }
      setJoinDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось присоединиться к поездке';
      setJoinError(message);
    } finally {
      setIsJoining(false);
    }
  };

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
              {ride.price} ₽
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem', lineHeight: 1.2, mt: 0.3 }}>
              за место • {ride.availableSeats ?? 0} мест
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
          {!isRegular && (
            <Chip
              size="small"
              icon={<EventIcon sx={{ fontSize: 14 }} />}
              label={ride.dateFormatted || ride.dateString || 'Сегодня'}
              variant="outlined"
              sx={{ maxWidth: '100%' }}
            />
          )}
          {isRegular && (
            <Chip
              size="small"
              icon={<RepeatIcon sx={{ fontSize: 14 }} />}
              label={regularLabel}
              color="secondary"
              variant="outlined"
              sx={{ fontWeight: 500 }}
            />
          )}
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
            {/* Контейнер интерактивной карты с предотвращением всплытия событий к родительской карточке */}
            <Box
              sx={{ mb: 2, width: '100%' }}
              onClick={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
              onMouseDown={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
              onMouseUp={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
              onPointerDown={(e: React.PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
              onPointerUp={(e: React.PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <LocationOnIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                Маршрут на карте
              </Typography>
              <Box
                onClick={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
                onMouseDown={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
                onMouseUp={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
                onPointerDown={(e: React.PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
                onPointerUp={(e: React.PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
                sx={{ width: '100%', m: 0, p: 0 }}
              >
                <RouteMap
                  from={ride.from}
                  to={ride.to}
                  polyline={ride.polyline}
                  startCoords={
                    ride.startLon !== undefined && ride.startLat !== undefined
                      ? [ride.startLon, ride.startLat]
                      : (ride.startCoords ? [ride.startCoords.lon, ride.startCoords.lat] : null)
                  }
                  endCoords={
                    ride.endLon !== undefined && ride.endLat !== undefined
                      ? [ride.endLon, ride.endLat]
                      : (ride.endCoords ? [ride.endCoords.lon, ride.endCoords.lat] : null)
                  }
                  distanceKm={ride.distanceKm}
                  durationMin={ride.durationMin}
                  height={280}
                />
              </Box>
            </Box>
            {isDriver ? (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <GroupIcon sx={{ fontSize: 18 }} />
                  Попутчики ({ride.passengers?.length || 0}):
                </Typography>
                {kickError && (
                  <Alert severity="error" sx={{ mb: 1 }} onClose={() => setKickError(null)}>
                    {kickError}
                  </Alert>
                )}
                {ride.passengers && ride.passengers.length > 0 ? (
                  <Stack spacing={1}>
                    {ride.passengers.map((p) => (
                      <Paper
                        key={p.id}
                        variant="outlined"
                        sx={{
                          p: 1.2,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                          <Avatar
                            src={formatAvatarUrl(p.avatar_url)}
                            sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'primary.light' }}
                          >
                            {(p.name || p.username || 'П')[0].toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                              {p.name || p.username || 'Попутчик'}
                              {p.selected_day ? ` (на ${formatDayToRussian(p.selected_day)})` : ''}
                            </Typography>
                            {p.telegram && (
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                @{p.telegram.replace('@', '')}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {p.phone && (
                            <IconButton
                              component="a"
                              href={`tel:${p.phone}`}
                              size="small"
                              color="primary"
                              title={`Позвонить: ${p.phone}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PhoneIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          )}
                          {p.telegram && (
                            <IconButton
                              component="a"
                              href={`https://t.me/${p.telegram.replace('@', '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="small"
                              color="primary"
                              title="Telegram"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SendIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          )}
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={kickingPassengerId === p.id}
                            startIcon={
                              kickingPassengerId === p.id ? (
                                <CircularProgress size={14} color="inherit" />
                              ) : (
                                <PersonRemoveIcon sx={{ fontSize: 16 }} />
                              )
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              handleKickPassenger(p.id);
                            }}
                            sx={{ textTransform: 'none', py: 0.3, px: 1, minWidth: 'auto', fontSize: '0.75rem' }}
                          >
                            Исключить
                          </Button>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 1 }}>
                    Попутчиков пока нет
                  </Typography>
                )}
              </Box>
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

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
              {isDriver && (
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditFrom(ride.from);
                    setEditTo(ride.to);
                    setEditTime(ride.time);
                    setEditPrice(String(ride.price));
                    setEditSeats(String(ride.totalSeats || 4));
                    setEditDialogOpen(true);
                  }}
                >
                  Редактировать маршрут
                </Button>
              )}
              {!isDriver && (
                <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
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
                  {ride.driverPhone && (
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      startIcon={<PhoneIcon />}
                      component="a"
                      href={`tel:${ride.driverPhone}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Позвонить
                    </Button>
                  )}
                </Stack>
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
                  onClick={handleJoinClick}
                >
                  Присоединиться
                </Button>
              )}
            </Stack>
          </Box>
        </Box>
      </Collapse>

      {/* Модальное окно редактирования поездки */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !isUpdatingRide && setEditDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Редактировать маршрут</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {editError && (
              <Alert severity="error" onClose={() => setEditError(null)}>
                {editError}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Откуда"
              value={editFrom}
              onChange={(e) => setEditFrom(e.target.value)}
            />
            <TextField
              fullWidth
              label="Куда"
              value={editTo}
              onChange={(e) => setEditTo(e.target.value)}
            />
            <TextField
              fullWidth
              label="Время выезда"
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
            />
            <TextField
              fullWidth
              label="Цена за место (₽)"
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
            />
            <TextField
              fullWidth
              label="Всего мест"
              type="number"
              value={editSeats}
              onChange={(e) => setEditSeats(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} disabled={isUpdatingRide} color="inherit">
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRide}
            disabled={isUpdatingRide}
            startIcon={isUpdatingRide ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isUpdatingRide ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Модальное окно выбора дня для регулярной поездки */}
      <Dialog
        open={joinDialogOpen}
        onClose={() => !isJoining && setJoinDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Выбор дня поездки</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Маршрут: <strong>{ride.from}</strong> → <strong>{ride.to}</strong> ({ride.time})
          </Typography>
          {joinError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setJoinError(null)}>
              {joinError}
            </Alert>
          )}
          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend" sx={{ fontSize: '0.85rem', mb: 1, fontWeight: 500 }}>
              Выберите день для регулярной поездки:
            </FormLabel>
            <RadioGroup
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              {availableDays.map((day) => (
                <FormControlLabel
                  key={day}
                  value={day}
                  control={<Radio size="small" />}
                  label={getDayFullLabel(day)}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setJoinDialogOpen(false)}
            disabled={isJoining}
            color="inherit"
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            disabled={!selectedDay || isJoining}
            onClick={handleConfirmJoin}
            startIcon={isJoining ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isJoining ? 'Подключение...' : 'Подтвердить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
