import { memo, useMemo, useState, useCallback } from 'react';
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
import SendIcon from '@mui/icons-material/Send';
import StarIcon from '@mui/icons-material/Star';
import PhoneIcon from '@mui/icons-material/Phone';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import RepeatIcon from '@mui/icons-material/Repeat';
import GroupIcon from '@mui/icons-material/Group';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { DAY_FULL, DAY_SHORT, type DayKey, type Ride } from '../types';
import { formatAvatarUrl } from '../utils';
import { useApp } from '../AppContext';
import RouteMap from './RouteMap';
import ReviewsDialog from './ReviewsDialog';
import ReviewDialog from './ReviewDialog';
import RideEditDialog from './RideEditDialog';

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
  onLeave?: () => void | Promise<void>;
}

function RideCardComponent({ ride, isPassenger, isDriver, onJoin, onLeave }: RideCardProps) {
  const { kickPassenger, joinRide, leaveRide, deleteRide, startRide, finishRide, user } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState<boolean>(false);
  const [reviewsDialogOpen, setReviewsDialogOpen] = useState<boolean>(false);
  const [isReviewed, setIsReviewed] = useState<boolean>(false);

  // Проверка: является ли текущий пользователь пассажиром поездки (включая passenger_ids)
  const hasJoinedAsPassenger = Boolean(
    isPassenger ||
    (user && (
      ride.passengerIds?.includes(user.id) ||
      (ride as { passenger_ids?: string[] }).passenger_ids?.includes(user.id) ||
      ride.passengers?.some((p) => p.id === user.id)
    ))
  );

  // Гос. номер виден только водителю или присоединившимся пассажирам
  const canSeePlateNumber = Boolean(isDriver || hasJoinedAsPassenger);

  // Извлечение сведений об автомобиле
  const vehicle = ride.vehicle;
  const brand = vehicle?.brand || ride.vehicleBrand || ride.brand || null;
  const model = vehicle?.model || ride.vehicleModel || ride.model || null;
  const color = vehicle?.color || ride.vehicleColor || ride.color || null;
  const plateNumber = vehicle?.plate_number || ride.vehiclePlateNumber || ride.plate_number || null;

  // Форматированное название автомобиля (марка и модель без дублирования)
  const carName = useMemo(() => {
    if (!brand) return model || null;
    if (!model) return brand;
    return brand.toLowerCase().includes(model.toLowerCase()) ? brand : `${brand} ${model}`;
  }, [brand, model]);

  // Старт и завершение поездки водителем
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
  // Отмена поездки водителем
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [isDeletingRide, setIsDeletingRide] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleStartRide = async (): Promise<void> => {
    setIsActionLoading(true);
    setActionError(null);
    try {
      await startRide(ride.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось начать поездку';
      setActionError(message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleFinishRide = async (): Promise<void> => {
    setIsActionLoading(true);
    setActionError(null);
    try {
      await finishRide(ride.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось завершить поездку';
      setActionError(message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteRide = async (): Promise<void> => {
    setIsDeletingRide(true);
    setDeleteError(null);
    try {
      await deleteRide(ride.id);
      setDeleteDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось отменить поездку';
      setDeleteError(message);
    } finally {
      setIsDeletingRide(false);
    }
  };

  const handleLeaveRide = useCallback(async (): Promise<void> => {
    try {
      if (onLeave) {
        await onLeave();
      } else {
        await leaveRide(ride.id);
      }
    } catch {
      // Ошибка отмены участия обрабатывается в AppContext
    }
  }, [onLeave, leaveRide, ride.id]);

  const isPlanned = ride.status === 'planned' || ride.status === 'scheduled' || !ride.status;
  const isRideActive = ride.status === 'active';
  const isCompleted = ride.status === 'completed';
  const isJoinDisabled = isRideActive || isCompleted;

  const driverRatingVal = Number(ride.driverRating ?? ride.driver_rating ?? ride.averageRating ?? 0);
  const driverReviewsCountVal = Number(ride.driverReviewsCount ?? ride.driver_reviews_count ?? 0);
  const hasDriverReviews = driverReviewsCountVal > 0 && driverRatingVal > 0;

  const handleOpenReviews = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setReviewsDialogOpen(true);
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
        borderRadius: 4,
        borderColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 4px 16px rgba(0, 0, 0, 0.25)'
            : '0 2px 8px -2px rgba(15, 23, 42, 0.05), 0 1px 3px -1px rgba(15, 23, 42, 0.03)',
        transition:
          'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: 'primary.light',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 12px 28px rgba(0, 0, 0, 0.4)'
              : '0 12px 24px -4px rgba(15, 23, 42, 0.09), 0 4px 10px -2px rgba(15, 23, 42, 0.04)',
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.25 }, '&:last-child': { pb: { xs: 2, sm: 2.25 } } }}>
        <Stack
          direction="row"
          spacing={{ xs: 1, sm: 1.5 }}
          alignItems="center"
          sx={{
            flexWrap: 'wrap',
            rowGap: 1,
          }}
        >
          <Box
            onClick={handleOpenReviews}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              cursor: 'pointer',
              borderRadius: 2.5,
              p: 0.6,
              m: -0.6,
              transition: 'background-color 0.15s ease',
              flexShrink: 0,
              maxWidth: { xs: 'calc(100% - 150px)', sm: 'none' },
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <Avatar
              src={avatarUrl}
              alt={ride.driverName}
              sx={{
                bgcolor: 'primary.main',
                width: 42,
                height: 42,
                fontSize: 14,
                boxShadow: '0 2px 8px rgba(0, 113, 227, 0.25)',
                border: '2px solid',
                borderColor: 'background.paper',
                transition: 'transform 0.15s ease',
                '&:hover': { transform: 'scale(1.06)' },
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap sx={{ fontWeight: 650, letterSpacing: '-0.01em' }}>
                {ride.driverName}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {hasDriverReviews ? (
                  <Stack direction="row" spacing={0.3} alignItems="center">
                    <StarIcon sx={{ fontSize: 13, color: '#f59e0b' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {driverRatingVal.toFixed(1)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({driverReviewsCountVal})
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Нет отзывов
                  </Typography>
                )}
              </Stack>
            </Box>
          </Box>

          <Box
            sx={{
              flex: { xs: '1 0 100%', sm: 1 },
              order: { xs: 3, sm: 2 },
              minWidth: 0,
              pl: { xs: 0, sm: 0.5 },
              mt: { xs: 0.25, sm: 0 },
            }}
          >
            <Stack direction="row" spacing={0.5} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                {ride.time} • {ride.distanceKm} км
              </Typography>
            </Stack>
          </Box>

          <Box
            sx={{
              textAlign: 'right',
              order: { xs: 2, sm: 3 },
              ml: { xs: 'auto', sm: 0 },
              flexShrink: 0,
            }}
          >
            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 750, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              {ride.price} ₽
            </Typography>
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                mt: 0.3,
                px: 0.8,
                py: 0.15,
                borderRadius: 1.5,
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(0, 113, 227, 0.15)' : 'rgba(0, 113, 227, 0.08)',
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.71rem', lineHeight: 1.2, fontWeight: 600, color: 'primary.main' }}>
                за место • {ride.availableSeats ?? 0} мест
              </Typography>
            </Box>
          </Box>

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            sx={{
              order: { xs: 2, sm: 4 },
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s ease',
              p: 0.6,
              borderRadius: 2,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.03)',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 1.75 }} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <LocationOnIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }} noWrap>
                {ride.from}
              </Typography>
            </Stack>
            <Box
              sx={{
                ml: 0.95,
                my: 0.35,
                borderLeft: '2px dashed',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 113, 227, 0.35)',
                height: 10,
              }}
            />
            <Stack direction="row" spacing={0.75} alignItems="center">
              <LocationOnIcon sx={{ fontSize: 16, color: 'error.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }} noWrap>
                {ride.to}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        {ride.description && (
          <Box
            sx={{
              mt: 1.2,
              p: 1.2,
              borderRadius: 2,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 113, 227, 0.03)',
              borderLeft: '3px solid',
              borderColor: 'primary.main',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.85rem' }}>
              {ride.description}
            </Typography>
          </Box>
        )}

        {ride.tags && ride.tags.length > 0 && (
          <Stack direction="row" spacing={0.6} sx={{ mt: 1.2 }} flexWrap="wrap" useFlexGap>
            {ride.tags.map((tag) => (
              <Chip
                key={tag}
                size="small"
                label={tag}
                variant="outlined"
                sx={{
                  fontSize: '0.74rem',
                  height: 24,
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.02)',
                }}
              />
            ))}
          </Stack>
        )}

        {(carName || color) && (
          <Box
            sx={{
              mt: 1.25,
              p: 1.2,
              borderRadius: 2.5,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.025)',
              border: '1px solid',
              borderColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <DirectionsCarIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 650, fontSize: '0.85rem' }} noWrap>
                  {carName || 'Автомобиль'}
                </Typography>
                {color && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
                    Цвет: {color}
                  </Typography>
                )}
              </Box>
            </Stack>

            {canSeePlateNumber && plateNumber && (
              <Chip
                size="small"
                label={plateNumber}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.74rem',
                  letterSpacing: '0.04em',
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#262626' : '#f8f9fa'),
                  color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : '#111827'),
                  border: '1px solid',
                  borderColor: (theme) => (theme.palette.mode === 'dark' ? '#525252' : '#cbd5e1'),
                  borderRadius: 1.5,
                  fontFamily: 'monospace',
                  px: 0.5,
                }}
              />
            )}
          </Box>
        )}

        <Stack direction="row" spacing={0.6} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          {!isRegular && (
            <Chip
              size="small"
              icon={<EventIcon sx={{ fontSize: 14 }} />}
              label={ride.dateFormatted || ride.dateString || 'Сегодня'}
              variant="outlined"
              sx={{ maxWidth: '100%', borderRadius: 2, height: 26 }}
            />
          )}
          {isRegular && (
            <Chip
              size="small"
              icon={<RepeatIcon sx={{ fontSize: 14 }} />}
              label={regularLabel}
              color="secondary"
              variant="outlined"
              sx={{ fontWeight: 600, borderRadius: 2, height: 26 }}
            />
          )}
          {isRideActive && (
            <Chip
              size="small"
              label="Поездка началась"
              color="primary"
              sx={{ fontWeight: 600, borderRadius: 2, height: 26 }}
            />
          )}
          {isCompleted && (
            <Chip
              size="small"
              icon={<StarIcon sx={{ fontSize: 14 }} />}
              label={isReviewed ? 'Отзыв отправлен' : 'Поездка завершена'}
              color="success"
              variant="outlined"
              sx={{ fontWeight: 600, borderRadius: 2, height: 26 }}
            />
          )}
        </Stack>
      </CardContent>

      <Collapse in={expanded}>
        <Box sx={{ p: { xs: 2, sm: 2.5 }, pt: 0 }}>
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
            {/* Контейнер интерактивной карты с предотвращением всплытия событий к родительской карточке */}
            <Box
              sx={{
                mb: 2.5,
                width: '100%',
                borderRadius: { xs: 1.5, sm: 2 },
                overflow: 'hidden',
                transform: 'translateZ(0)',
                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                border: '1px solid',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 2px 10px rgba(0, 0, 0, 0.25)'
                    : '0 2px 8px -2px rgba(15, 23, 42, 0.05)',
              }}
              onClick={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
              onMouseDown={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
              onMouseUp={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
              onPointerDown={(e: React.PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
              onPointerUp={(e: React.PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
            >
              <Box
                sx={{
                  px: 1.75,
                  py: 1,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.02)',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 650, display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.85rem' }}
                >
                  <LocationOnIcon sx={{ fontSize: 17, color: 'primary.main' }} />
                  Маршрут на карте
                </Typography>
              </Box>
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
                  sx={{ fontWeight: 650, mb: 1.2, display: 'flex', alignItems: 'center', gap: 0.6 }}
                >
                  <GroupIcon sx={{ fontSize: 18 }} />
                  Попутчики ({ride.passengers?.length || 0}):
                </Typography>
                {kickError && (
                  <Alert severity="error" sx={{ mb: 1, borderRadius: 2 }} onClose={() => setKickError(null)}>
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
                          p: 1.25,
                          borderRadius: 2.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          borderColor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                          '&:hover': {
                            borderColor: 'primary.light',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                          },
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
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  mb: 2,
                  cursor: 'pointer',
                  width: 'fit-content',
                  p: 0.5,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={handleOpenReviews}
              >
                <Avatar
                  src={avatarUrl}
                  alt={ride.driverName}
                  sx={{ bgcolor: 'primary.light', width: 32, height: 32, fontSize: 12 }}
                >
                  {initials}
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {ride.driverName}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {hasDriverReviews ? (
                      <Stack direction="row" spacing={0.3} alignItems="center">
                        <StarIcon sx={{ fontSize: 12, color: '#faaf00' }} />
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {driverRatingVal.toFixed(1)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({driverReviewsCountVal})
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Нет отзывов
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      • @{ride.telegram}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {actionError && (
                <Alert severity="error" sx={{ width: '100%', mb: 1 }} onClose={() => setActionError(null)}>
                  {actionError}
                </Alert>
              )}
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
                  sx={{ py: 0.9, borderRadius: 2.5, fontWeight: 650 }}
                >
                  {isReviewed ? 'Отзыв оставлен ✓' : 'Оставить отзыв'}
                </Button>
              )}
              {isDriver && (
                <Stack spacing={1} sx={{ width: '100%' }}>
                  {isPlanned && (
                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={isActionLoading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                      disabled={isActionLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRide();
                      }}
                      sx={{ py: 0.9, borderRadius: 2.5, fontWeight: 650 }}
                    >
                      Начать поездку
                    </Button>
                  )}
                  {isRideActive && (
                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={isActionLoading ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
                      disabled={isActionLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFinishRide();
                      }}
                      sx={{ py: 0.9, borderRadius: 2.5, fontWeight: 650 }}
                    >
                      Завершить поездку
                    </Button>
                  )}
                  {!isCompleted && (
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditDialogOpen(true);
                      }}
                      sx={{ py: 0.9, borderRadius: 2.5, fontWeight: 650 }}
                    >
                      Редактировать маршрут
                    </Button>
                  )}
                  {!isCompleted && (
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDialogOpen(true);
                      }}
                      sx={{ py: 0.9, borderRadius: 2.5, fontWeight: 650 }}
                    >
                      Отменить поездку
                    </Button>
                  )}
                </Stack>
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
                    sx={{ py: 0.9, borderRadius: 2.5, fontWeight: 650 }}
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
                      sx={{ py: 0.9, borderRadius: 2.5, fontWeight: 650 }}
                    >
                      Позвонить
                    </Button>
                  )}
                </Stack>
              )}
              {!isDriver && isPassenger && !isCompleted && (
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLeaveRide();
                  }}
                  sx={{ py: 0.9, borderRadius: 2.5, fontWeight: 650 }}
                >
                  Отменить участие
                </Button>
              )}
              {!isDriver && !isPassenger && !isJoinDisabled && (
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  onClick={handleJoinClick}
                  sx={{
                    py: 1,
                    borderRadius: 2.5,
                    fontWeight: 650,
                    boxShadow: '0 4px 14px 0 rgba(0, 113, 227, 0.28)',
                  }}
                >
                  Поехать вместе
                </Button>
              )}
            </Stack>
          </Box>
        </Box>
      </Collapse>

      {/* Модальное окно редактирования поездки */}
      <RideEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        ride={ride}
      />

      {/* Модальное окно создания отзыва */}
      <ReviewDialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        rideId={ride.id}
        driverId={ride.driverId}
        driverName={ride.driverName}
        onSuccess={() => setIsReviewed(true)}
      />

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

      {/* Модальное окно подтверждения отмены поездки водителем */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeletingRide && setDeleteDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Отменить поездку?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Вы уверены, что хотите отменить поездку <strong>{ride.from}</strong> → <strong>{ride.to}</strong>? Она будет удалена из списка.
          </Typography>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setDeleteError(null)}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeletingRide} color="inherit">
            Назад
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteRide}
            disabled={isDeletingRide}
            startIcon={isDeletingRide ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isDeletingRide ? 'Удаление...' : 'Да, отменить поездку'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Модальное окно просмотра отзывов о водителе */}
      <ReviewsDialog
        open={reviewsDialogOpen}
        onClose={() => setReviewsDialogOpen(false)}
        driverId={ride.driverId}
        driverName={ride.driverName}
        driverAvatarUrl={ride.driverAvatarUrl}
        driverRating={driverRatingVal}
        driverReviewsCount={driverReviewsCountVal}
      />
    </Card>
  );
}

/**
 * Оптимизированный компонент карточки поездки с React.memo для предотвращения O(N) ререндеров ленты
 */
const RideCard = memo(RideCardComponent);

export default RideCard;
