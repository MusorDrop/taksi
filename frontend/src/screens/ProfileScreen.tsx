import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import EditIcon from '@mui/icons-material/Edit';
import PhoneIcon from '@mui/icons-material/Phone';
import { useApp } from '../AppContext';
import { useThemeMode } from '../ThemeModeContext';
import { api } from '../api';
import { formatAvatarUrl } from '../utils';
import type { Vehicle, VehiclesResponse, BackendUser } from '../types';

export default function ProfileScreen() {
  const { user, logout, rides, passengerRideIds, updateUser } = useApp();
  const { mode, toggleTheme } = useThemeMode();

  // Состояния для загрузки аватарки
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<boolean>(false);

  // Состояния для управления гаражом автомобилей
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState<boolean>(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [brand, setBrand] = useState<string>('');
  const [licensePlate, setLicensePlate] = useState<string>('');
  const [color, setColor] = useState<string>('');
  const [seats, setSeats] = useState<number>(4);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Состояния для редактирования контактов (телефон и Telegram)
  const [showEditContacts, setShowEditContacts] = useState<boolean>(false);
  const [editPhone, setEditPhone] = useState<string>('');
  const [editTelegram, setEditTelegram] = useState<string>('');
  const [isSavingContacts, setIsSavingContacts] = useState<boolean>(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [contactsSuccess, setContactsSuccess] = useState<boolean>(false);

  // Состояния для редактирования автомобиля
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editBrand, setEditBrand] = useState<string>('');
  const [editLicensePlate, setEditLicensePlate] = useState<string>('');
  const [editColor, setEditColor] = useState<string>('');
  const [editSeats, setEditSeats] = useState<number>(4);
  const [isUpdatingVehicle, setIsUpdatingVehicle] = useState<boolean>(false);
  const [editVehicleError, setEditVehicleError] = useState<string | null>(null);

  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactsSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      if (avatarSuccessTimerRef.current) clearTimeout(avatarSuccessTimerRef.current);
      if (contactsSuccessTimerRef.current) clearTimeout(contactsSuccessTimerRef.current);
    };
  }, []);

  // Загрузка списка автомобилей текущего пользователя через API
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadVehicles(): Promise<void> {
      setIsLoadingVehicles(true);
      setVehicleError(null);
      try {
        const res = await api.get<VehiclesResponse>('/api/vehicles', {
          signal: controller.signal,
        });
        if (isMounted && res?.vehicles) {
          setVehicles(res.vehicles);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Не удалось загрузить список автомобилей';
          setVehicleError(message);
        }
      } finally {
        if (isMounted && !controller.signal.aborted) {
          setIsLoadingVehicles(false);
        }
      }
    }

    loadVehicles();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Сохранение отредактированных контактов (телефон и Telegram)
  const handleSaveContacts = async (e?: FormEvent): Promise<void> => {
    if (e) e.preventDefault();
    if (!editPhone.trim() || !editTelegram.trim() || isSavingContacts) return;

    setIsSavingContacts(true);
    setContactsError(null);
    setContactsSuccess(false);

    try {
      const res = await api.patch<{ message: string; user: BackendUser }>('/api/auth/me', {
        phone: editPhone.trim(),
        telegram: editTelegram.trim(),
      });

      if (res?.user) {
        updateUser({
          phone: res.user.phone ?? undefined,
          telegram: res.user.username,
          name: res.user.first_name || res.user.username,
        });
        setShowEditContacts(false);
        if (contactsSuccessTimerRef.current) clearTimeout(contactsSuccessTimerRef.current);
        setContactsSuccess(true);
        contactsSuccessTimerRef.current = setTimeout(() => {
          setContactsSuccess(false);
          contactsSuccessTimerRef.current = null;
        }, 3000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось обновить контакты';
      setContactsError(message);
    } finally {
      setIsSavingContacts(false);
    }
  };

  // Добавление нового автомобиля водителя с указанием количества мест
  const handleAddVehicle = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!brand.trim() || !licensePlate.trim() || isSaving) return;

    setIsSaving(true);
    setVehicleError(null);
    setSaveSuccess(false);

    try {
      const res = await api.post<{ message: string; vehicle: Vehicle }>('/api/vehicles', {
        brand: brand.trim(),
        license_plate: licensePlate.trim(),
        color: color.trim() || undefined,
        seats: Number(seats) || 4,
      });

      if (res?.vehicle) {
        setVehicles((prev) => [res.vehicle, ...prev]);
        setBrand('');
        setLicensePlate('');
        setColor('');
        setSeats(4);
        setShowAddForm(false);
        if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
        setSaveSuccess(true);
        saveSuccessTimerRef.current = setTimeout(() => {
          setSaveSuccess(false);
          saveSuccessTimerRef.current = null;
        }, 3000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить автомобиль';
      setVehicleError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Сохранение изменений автомобиля
  const handleUpdateVehicle = async (e?: FormEvent): Promise<void> => {
    if (e) e.preventDefault();
    if (!editingVehicle || !editBrand.trim() || !editLicensePlate.trim() || isUpdatingVehicle) return;

    setIsUpdatingVehicle(true);
    setEditVehicleError(null);

    try {
      const res = await api.patch<{ message: string; vehicle: Vehicle }>(`/api/vehicles/${editingVehicle.id}`, {
        brand: editBrand.trim(),
        license_plate: editLicensePlate.trim(),
        color: editColor.trim() || undefined,
        seats: Number(editSeats) || 4,
      });

      if (res?.vehicle) {
        setVehicles((prev) => prev.map((v) => (v.id === editingVehicle.id ? res.vehicle : v)));
        setEditingVehicle(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось обновить автомобиль';
      setEditVehicleError(message);
    } finally {
      setIsUpdatingVehicle(false);
    }
  };

  // Загрузка аватарки пользователя
  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Пожалуйста, выберите файл изображения (JPEG, PNG, WEBP, GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Размер файла не должен превышать 5 МБ');
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(false);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await api.post<{ message: string; avatar_url: string; user?: BackendUser }>(
        '/api/auth/me/avatar',
        formData
      );

      if (res?.avatar_url) {
        updateUser({ avatar_url: res.avatar_url });
        if (avatarSuccessTimerRef.current) clearTimeout(avatarSuccessTimerRef.current);
        setAvatarSuccess(true);
        avatarSuccessTimerRef.current = setTimeout(() => {
          setAvatarSuccess(false);
          avatarSuccessTimerRef.current = null;
        }, 3000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить аватар';
      setAvatarError(message);
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const driverCount = rides.filter((r) => r.driverId === user.id).length;
  const passengerCount = passengerRideIds.length;

  return (
    <Box sx={{ pb: { xs: 12, sm: 8 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2.5, letterSpacing: '-0.02em' }}>
        Профиль
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, sm: 3.5 },
          borderRadius: 4,
          textAlign: 'center',
          borderColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 4px 20px rgba(0, 0, 0, 0.25)'
              : '0 2px 12px -2px rgba(15, 23, 42, 0.04)',
        }}
      >
        <Box sx={{ position: 'relative', width: 92, height: 92, mx: 'auto', mb: 2 }}>
          <Avatar
            src={formatAvatarUrl(user.avatar_url)}
            alt={user.name}
            sx={{
              width: 92,
              height: 92,
              bgcolor: 'primary.main',
              fontSize: 30,
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(0, 113, 227, 0.3)',
              border: '3px solid',
              borderColor: 'background.paper',
            }}
          >
            {initials}
          </Avatar>
          {isUploadingAvatar && (
            <CircularProgress
              size={92}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                color: 'primary.light',
                zIndex: 1,
              }}
            />
          )}
        </Box>

        <Box sx={{ mb: 2 }}>
          <Button
            component="label"
            size="small"
            variant="outlined"
            startIcon={<PhotoCameraIcon />}
            disabled={isUploadingAvatar}
            sx={{ textTransform: 'none', borderRadius: 2.5, fontWeight: 600, px: 2 }}
          >
            {isUploadingAvatar ? 'Загрузка...' : user.avatar_url ? 'Сменить фото' : 'Загрузить аватар'}
            <input
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
            />
          </Button>
        </Box>

        {avatarSuccess && (
          <Alert severity="success" sx={{ mb: 1.5, py: 0.5, fontSize: '0.8125rem', borderRadius: 2 }}>
            Аватар успешно обновлен!
          </Alert>
        )}

        {avatarError && (
          <Alert
            severity="error"
            onClose={() => setAvatarError(null)}
            sx={{ mb: 1.5, py: 0.5, fontSize: '0.8125rem', borderRadius: 2 }}
          >
            {avatarError}
          </Alert>
        )}

        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          {user.name}
        </Typography>
        <Stack direction="row" spacing={0.6} alignItems="center" justifyContent="center" sx={{ mt: 0.5 }}>
          <SendIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            @{user.telegram}
          </Typography>
        </Stack>

        {user.phone && (
          <Stack direction="row" spacing={0.6} alignItems="center" justifyContent="center" sx={{ mt: 0.5 }}>
            <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {user.phone}
            </Typography>
          </Stack>
        )}

        {contactsSuccess && (
          <Alert severity="success" sx={{ mt: 1.5, py: 0.5, fontSize: '0.8125rem', borderRadius: 2 }}>
            Контакты успешно обновлены!
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon sx={{ fontSize: 16 }} />}
            onClick={() => {
              setEditPhone(user.phone || '');
              setEditTelegram(user.telegram || '');
              setContactsError(null);
              setShowEditContacts(true);
            }}
            sx={{ textTransform: 'none', borderRadius: 2.5, fontWeight: 600, px: 2 }}
          >
            Изменить телефон и TG
          </Button>
        </Box>
      </Paper>

      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            p: 2.25,
            borderRadius: 3.5,
            textAlign: 'center',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 4px 16px rgba(0, 0, 0, 0.2)'
                : '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 8px 24px rgba(0, 0, 0, 0.35)'
                  : '0 8px 20px -4px rgba(15, 23, 42, 0.08)',
            },
          }}
        >
          <DirectionsCarIcon sx={{ fontSize: 30, color: 'primary.main', mb: 0.75 }} />
          <Typography variant="h5" sx={{ fontWeight: 750, letterSpacing: '-0.02em' }}>
            {driverCount}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Мои маршруты
          </Typography>
        </Paper>
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            p: 2.25,
            borderRadius: 3.5,
            textAlign: 'center',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 4px 16px rgba(0, 0, 0, 0.2)'
                : '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 8px 24px rgba(0, 0, 0, 0.35)'
                  : '0 8px 20px -4px rgba(15, 23, 42, 0.08)',
            },
          }}
        >
          <PersonIcon sx={{ fontSize: 30, color: 'secondary.main', mb: 0.75 }} />
          <Typography variant="h5" sx={{ fontWeight: 750, letterSpacing: '-0.02em' }}>
            {passengerCount}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Поездки пассажиром
          </Typography>
        </Paper>
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* Секция: Переключение темы */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 3.5,
          mb: 3,
          borderColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
        }}
      >
        <FormControlLabel
          control={<Switch checked={mode === 'dark'} onChange={toggleTheme} />}
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <DarkModeIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <span style={{ fontWeight: 500 }}>Тёмная тема</span>
            </Stack>
          }
        />
      </Paper>

      {/* Секция: Гараж автомобилей */}
      <Paper
        variant="outlined"
        sx={{
          p: 2.75,
          borderRadius: 3.5,
          mb: 3,
          borderColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 4px 16px rgba(0, 0, 0, 0.2)'
              : '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DirectionsCarIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Гараж автомобилей
            </Typography>
            <Chip label={vehicles.length} size="small" color="primary" variant="outlined" />
          </Stack>
          <Button
            size="small"
            variant={showAddForm ? 'text' : 'contained'}
            startIcon={showAddForm ? <CloseIcon /> : <AddIcon />}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Отмена' : 'Добавить авто'}
          </Button>
        </Stack>

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Автомобиль успешно добавлен в гараж!
          </Alert>
        )}

        {vehicleError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setVehicleError(null)}>
            {vehicleError}
          </Alert>
        )}

        {/* Форма добавления нового автомобиля */}
        {showAddForm && (
          <Box component="form" onSubmit={handleAddVehicle} sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Stack spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Марка и модель *"
                placeholder="Например: Toyota Camry, Lada Vesta"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                required
              />
              <TextField
                fullWidth
                size="small"
                label="Госномер *"
                placeholder="Например: А123ВС96"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                required
              />
              <TextField
                fullWidth
                size="small"
                label="Цвет"
                placeholder="Например: Черный, Белый"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <TextField
                fullWidth
                size="small"
                label="Количество мест *"
                type="number"
                value={seats}
                onChange={(e) => setSeats(Math.min(8, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                inputProps={{ min: 1, max: 8 }}
                required
              />
              <Button
                type="submit"
                variant="contained"
                disabled={!brand.trim() || !licensePlate.trim() || isSaving}
                startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {isSaving ? 'Сохранение...' : 'Сохранить автомобиль'}
              </Button>
            </Stack>
          </Box>
        )}

        {/* Список существующих автомобилей */}
        {isLoadingVehicles ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : vehicles.length === 0 && !showAddForm ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
            У вас пока нет добавленных машин. Добавьте авто, чтобы указывать его при публикации поездок.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {vehicles.map((v) => (
              <Paper
                key={v.id}
                variant="outlined"
                sx={{
                  p: 1.75,
                  borderRadius: 3,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  bgcolor: 'background.paper',
                  borderColor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  '&:hover': {
                    borderColor: 'primary.light',
                    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>
                    {v.brand}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                    <Typography variant="caption" color="text.secondary">
                      {v.seats ?? 4} {(v.seats ?? 4) === 1 ? 'место' : ((v.seats ?? 4) < 5 ? 'места' : 'мест')}
                    </Typography>
                    {v.color && (
                      <Typography variant="caption" color="text.secondary">
                        • {v.color}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={v.license_plate}
                    size="small"
                    sx={(theme) => ({
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      borderRadius: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
                      color: theme.palette.mode === 'dark' ? '#fff' : '#000',
                      border: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ccc',
                    })}
                  />
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => {
                      setEditingVehicle(v);
                      setEditBrand(v.brand);
                      setEditLicensePlate(v.license_plate);
                      setEditColor(v.color || '');
                      setEditSeats(v.seats ?? 4);
                      setEditVehicleError(null);
                    }}
                    title="Редактировать автомобиль"
                  >
                    <EditIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      <Stack spacing={1.5} sx={{ mt: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          size="medium"
          onClick={() => {
            window.location.hash = 'admin';
          }}
          sx={{ py: 1.1, borderRadius: 2.5, textTransform: 'none', fontWeight: 600 }}
        >
          Панель администратора (/admin)
        </Button>

        <Button
          fullWidth
          variant="outlined"
          color="error"
          size="large"
          startIcon={<LogoutIcon />}
          onClick={logout}
          sx={{ py: 1.25, borderRadius: 2.5, fontWeight: 700 }}
        >
          Выйти
        </Button>
      </Stack>

      {/* Модальное окно редактирования контактов (телефон и TG) */}
      <Dialog
        open={showEditContacts}
        onClose={() => setShowEditContacts(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Изменить контакты</DialogTitle>
        <DialogContent>
          {contactsError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {contactsError}
            </Alert>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Номер телефона *"
              placeholder="+7 (999) 123-45-67"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              fullWidth
              size="small"
              label="Telegram username (@...)"
              placeholder="@username"
              value={editTelegram}
              onChange={(e) => setEditTelegram(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SendIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowEditContacts(false)} disabled={isSavingContacts}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveContacts}
            disabled={!editPhone.trim() || !editTelegram.trim() || isSavingContacts}
          >
            {isSavingContacts ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Модальное окно редактирования автомобиля */}
      <Dialog
        open={Boolean(editingVehicle)}
        onClose={() => setEditingVehicle(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Редактировать автомобиль</DialogTitle>
        <DialogContent>
          {editVehicleError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editVehicleError}
            </Alert>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Марка и модель *"
              value={editBrand}
              onChange={(e) => setEditBrand(e.target.value)}
              required
            />
            <TextField
              fullWidth
              size="small"
              label="Госномер *"
              value={editLicensePlate}
              onChange={(e) => setEditLicensePlate(e.target.value)}
              required
            />
            <TextField
              fullWidth
              size="small"
              label="Цвет"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
            />
            <TextField
              fullWidth
              size="small"
              label="Количество мест *"
              type="number"
              value={editSeats}
              onChange={(e) => setEditSeats(Math.min(8, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              inputProps={{ min: 1, max: 8 }}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditingVehicle(null)} disabled={isUpdatingVehicle}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateVehicle}
            disabled={!editBrand.trim() || !editLicensePlate.trim() || isUpdatingVehicle}
          >
            {isUpdatingVehicle ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

