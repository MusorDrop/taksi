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
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
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
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      if (avatarSuccessTimerRef.current) clearTimeout(avatarSuccessTimerRef.current);
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

  // Добавление нового автомобиля водителя
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
      });

      if (res?.vehicle) {
        setVehicles((prev) => [res.vehicle, ...prev]);
        setBrand('');
        setLicensePlate('');
        setColor('');
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
    <Box sx={{ pb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Профиль
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
        <Box sx={{ position: 'relative', width: 88, height: 88, mx: 'auto', mb: 1.5 }}>
          <Avatar
            src={formatAvatarUrl(user.avatar_url)}
            alt={user.name}
            sx={{
              width: 88,
              height: 88,
              bgcolor: 'primary.main',
              fontSize: 28,
              boxShadow: 1,
            }}
          >
            {initials}
          </Avatar>
          {isUploadingAvatar && (
            <CircularProgress
              size={88}
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
            sx={{ textTransform: 'none', borderRadius: 2 }}
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
          <Alert severity="success" sx={{ mb: 1.5, py: 0.5, fontSize: '0.8125rem' }}>
            Аватар успешно обновлен!
          </Alert>
        )}

        {avatarError && (
          <Alert
            severity="error"
            onClose={() => setAvatarError(null)}
            sx={{ mb: 1.5, py: 0.5, fontSize: '0.8125rem' }}
          >
            {avatarError}
          </Alert>
        )}

        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {user.name}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mt: 0.5 }}>
          <SendIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            @{user.telegram}
          </Typography>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Paper variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 3, textAlign: 'center' }}>
          <DirectionsCarIcon sx={{ fontSize: 28, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {driverCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Мои маршруты
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 3, textAlign: 'center' }}>
          <PersonIcon sx={{ fontSize: 28, color: 'secondary.main', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {passengerCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Поездки пассажиром
          </Typography>
        </Paper>
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* Секция: Переключение темы */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 3 }}>
        <FormControlLabel
          control={<Switch checked={mode === 'dark'} onChange={toggleTheme} />}
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <DarkModeIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <span>Тёмная тема</span>
            </Stack>
          }
        />
      </Paper>

      {/* Секция: Гараж автомобилей */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
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
          <Stack spacing={1}>
            {vehicles.map((v) => (
              <Paper
                key={v.id}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  bgcolor: 'background.paper',
                }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {v.brand}
                  </Typography>
                  {v.color && (
                    <Typography variant="caption" color="text.secondary">
                      Цвет: {v.color}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={v.license_plate}
                  size="small"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    bgcolor: 'grey.100',
                  }}
                />
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      <Stack spacing={1.5} sx={{ mt: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          size="medium"
          onClick={() => {
            window.location.hash = 'admin';
          }}
          sx={{ py: 1, textTransform: 'none' }}
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
          sx={{ py: 1.2 }}
        >
          Выйти
        </Button>
      </Stack>
    </Box>
  );
}

