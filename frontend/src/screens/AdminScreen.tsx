import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import KeyIcon from '@mui/icons-material/Key';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import { api } from '../api';
import type { BackendUser, Vehicle } from '../types';

interface AdminRide {
  id: string;
  driver_id: string;
  vehicle_id?: string | null;
  driver_username?: string;
  driver_first_name?: string;
  departure_time: string;
  start_lon?: number;
  start_lat?: number;
  end_lon?: number;
  end_lat?: number;
  total_seats: number;
  available_seats: number;
  status: string;
  base_price: number;
  created_at: string;
}

interface AdminVehicle extends Vehicle {
  driver_username?: string;
  driver_first_name?: string;
}

interface AdminScreenProps {
  onBack?: () => void;
}

const STORAGE_KEY = 'admin_key';

export default function AdminScreen({ onBack }: AdminScreenProps) {
  const [adminKey, setAdminKey] = useState<string>(() => sessionStorage.getItem(STORAGE_KEY) || '');
  const [inputKey, setInputKey] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'users' | 'rides' | 'vehicles'>('users');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [users, setUsers] = useState<BackendUser[]>([]);
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);

  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const showNotification = useCallback((msg: string, isError = false) => {
    if (isError) {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      setErrorMessage(msg);
      errorTimeoutRef.current = setTimeout(() => {
        setErrorMessage(null);
        errorTimeoutRef.current = null;
      }, 5000);
    } else {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      setSuccessMessage(msg);
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
        successTimeoutRef.current = null;
      }, 3000);
    }
  }, []);

  const getAdminHeaders = useCallback(() => {
    return { 'X-Admin-Key': adminKey };
  }, [adminKey]);

  // Загрузка данных активной вкладки
  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!adminKey) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (activeTab === 'users') {
        const res = await api.get<{ count: number; users: BackendUser[] }>('/api/admin/users', {
          headers: getAdminHeaders(),
          signal,
        });
        setUsers(res.users || []);
      } else if (activeTab === 'rides') {
        const res = await api.get<{ count: number; rides: AdminRide[] }>('/api/admin/rides', {
          headers: getAdminHeaders(),
          signal,
        });
        setRides(res.rides || []);
      } else if (activeTab === 'vehicles') {
        const res = await api.get<{ count: number; vehicles: AdminVehicle[] }>('/api/admin/vehicles', {
          headers: getAdminHeaders(),
          signal,
        });
        setVehicles(res.vehicles || []);
      }
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки данных';
      if (msg.includes('ключ') || msg.includes('401') || msg.includes('403')) {
        setAuthError('Недействительный ключ администратора. Пожалуйста, введите ключ повторно.');
        sessionStorage.removeItem(STORAGE_KEY);
        setAdminKey('');
      } else {
        showNotification(msg, true);
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [adminKey, activeTab, getAdminHeaders, showNotification]);

  useEffect(() => {
    if (!adminKey) return;
    const controller = new AbortController();
    loadData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [adminKey, activeTab, loadData]);

  // Обработка входа по ключу
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim();
    if (!trimmed) {
      setAuthError('Пожалуйста, введите секретный ключ администратора');
      return;
    }
    if (trimmed.length !== 30) {
      setAuthError(`Ключ администратора должен содержать ровно 30 символов (введено: ${trimmed.length})`);
      return;
    }
    setAuthError(null);
    sessionStorage.setItem(STORAGE_KEY, trimmed);
    sessionStorage.setItem('adminKey', trimmed);
    setAdminKey(trimmed);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('adminKey');
    setAdminKey('');
    setInputKey('');
    setUsers([]);
    setRides([]);
    setVehicles([]);
  };

  // Действия с пользователями
  const handleToggleBlockUser = async (user: BackendUser) => {
    const newStatus = !user.is_blocked;

    // 1. Мгновенное оптимистичное обновление состояния пользователя в UI админки
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, is_blocked: newStatus } : u))
    );

    try {
      const res = await api.patch<{ message: string; user: { id: string; username: string; is_blocked: boolean } }>(
        `/api/admin/users/${user.id}/block`,
        { is_blocked: newStatus },
        { headers: getAdminHeaders() }
      );

      if (res?.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_blocked: res.user.is_blocked } : u))
        );
      }
      showNotification(
        newStatus
          ? `Пользователь @${user.username} заблокирован`
          : `Пользователь @${user.username} разблокирован`
      );
    } catch (err: unknown) {
      // 2. Откат UI при сетевой ошибке
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_blocked: user.is_blocked } : u))
      );
      showNotification(err instanceof Error ? err.message : 'Ошибка обновления блокировки', true);
    }
  };

  const handleEditUser = async (user: BackendUser) => {
    const firstName = window.prompt('Имя пользователя:', user.first_name || '');
    if (firstName === null) return;
    const lastName = window.prompt('Фамилия пользователя:', user.last_name || '');
    if (lastName === null) return;
    const phone = window.prompt('Номер телефона:', user.phone || '');
    if (phone === null) return;
    const role = window.prompt('Роль (driver, passenger, both):', user.role || 'both');
    if (role === null) return;

    try {
      const res = await api.patch<{ message: string; user: BackendUser }>(
        `/api/admin/users/${user.id}`,
        { first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim(), role: role.trim() },
        { headers: getAdminHeaders() }
      );
      if (res?.user) {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...res.user } : u)));
        showNotification('Данные пользователя обновлены');
      }
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Ошибка обновления пользователя', true);
    }
  };

  // Действия с поездками
  const handleEditRide = async (ride: AdminRide) => {
    const status = window.prompt('Статус поездки (scheduled, in_progress, completed, cancelled):', ride.status);
    if (status === null) return;
    const price = window.prompt('Базовая стоимость поездки (руб):', String(ride.base_price));
    if (price === null) return;
    const availableSeats = window.prompt('Доступно свободных мест:', String(ride.available_seats));
    if (availableSeats === null) return;

    try {
      const res = await api.patch<{ message: string; ride: AdminRide }>(
        `/api/admin/rides/${ride.id}`,
        {
          status: status.trim(),
          base_price: parseFloat(price) || ride.base_price,
          available_seats: parseInt(availableSeats, 10) || ride.available_seats,
        },
        { headers: getAdminHeaders() }
      );
      if (res?.ride) {
        setRides((prev) => prev.map((r) => (r.id === ride.id ? { ...r, ...res.ride } : r)));
        showNotification('Поездка успешно обновлена');
      }
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Ошибка обновления поездки', true);
    }
  };

  const handleDeleteRide = async (ride: AdminRide) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту поездку?')) return;
    try {
      await api.delete(`/api/admin/rides/${ride.id}`, { headers: getAdminHeaders() });
      setRides((prev) => prev.filter((r) => r.id !== ride.id));
      showNotification('Поездка удалена');
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Ошибка удаления поездки', true);
    }
  };

  // Действия с машинами
  const handleEditVehicle = async (vehicle: AdminVehicle) => {
    const brand = window.prompt('Марка и модель автомобиля:', vehicle.brand);
    if (brand === null) return;
    const color = window.prompt('Цвет автомобиля:', vehicle.color || '');
    if (color === null) return;
    const licensePlate = window.prompt('Госномер автомобиля:', vehicle.license_plate);
    if (licensePlate === null) return;

    try {
      const res = await api.patch<{ message: string; vehicle: AdminVehicle }>(
        `/api/admin/vehicles/${vehicle.id}`,
        {
          brand: brand.trim(),
          color: color.trim() || null,
          license_plate: licensePlate.trim().toUpperCase(),
        },
        { headers: getAdminHeaders() }
      );
      if (res?.vehicle) {
        setVehicles((prev) => prev.map((v) => (v.id === vehicle.id ? { ...v, ...res.vehicle } : v)));
        showNotification('Данные автомобиля обновлены');
      }
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Ошибка обновления автомобиля', true);
    }
  };

  const handleDeleteVehicle = async (vehicle: AdminVehicle) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот автомобиль?')) return;
    try {
      await api.delete(`/api/admin/vehicles/${vehicle.id}`, { headers: getAdminHeaders() });
      setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
      showNotification('Автомобиль удален');
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Ошибка удаления автомобиля', true);
    }
  };

  // Экран ввода ключа администратора
  if (!adminKey) {
    return (
      <Box sx={{ maxWidth: 440, mx: 'auto', mt: 6, p: 2 }}>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <KeyIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1.5 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Админ-панель
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Для доступа к управлению сервисом введите секретный ключ администратора (30 символов)
          </Typography>

          {authError && (
            <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
              {authError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleLogin}>
            <TextField
              fullWidth
              size="small"
              label="Секретный ключ (30 символов)"
              placeholder="Введите ключ доступа..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              helperText={`${inputKey.trim().length} / 30 символов`}
              error={inputKey.length > 0 && inputKey.trim().length !== 30}
              sx={{ mb: 2 }}
              autoFocus
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              sx={{ py: 1.2, mb: 1.5 }}
            >
              Войти в админку
            </Button>

            {onBack && (
              <Button
                fullWidth
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={onBack}
              >
                Вернуться в приложение
              </Button>
            )}
          </Box>
        </Paper>
      </Box>
    );
  }

  // Основная панель администратора
  return (
    <Box sx={{ pb: 6, pt: 1 }}>
      {/* Шапка админки */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {onBack && (
            <IconButton onClick={onBack} size="small" title="Назад в приложение">
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Админ-панель
          </Typography>
          <Chip label="Admin mode" color="secondary" size="small" />
        </Stack>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Обновить данные">
            <IconButton onClick={() => loadData()} disabled={isLoading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{ textTransform: 'none' }}
          >
            Выйти
          </Button>
        </Stack>
      </Stack>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {/* Вкладки разделов */}
      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab value="users" label={`Пользователи (${users.length})`} />
          <Tab value="rides" label={`Поездки (${rides.length})`} />
          <Tab value="vehicles" label={`Автомобили (${vehicles.length})`} />
        </Tabs>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* ТАБЛИЦА: ПОЛЬЗОВАТЕЛИ */}
          {activeTab === 'users' && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Логин</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Имя</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Телефон</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Роль</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Статус</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Пользователи не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>
                          @{u.username}
                          {u.avatar_url && (
                            <Typography variant="caption" display="block" color="primary">
                              есть аватар
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || '-'}</TableCell>
                        <TableCell>{u.phone || '-'}</TableCell>
                        <TableCell>
                          <Chip label={u.role || 'both'} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {u.is_blocked ? (
                            <Chip label="Заблокирован" color="error" size="small" />
                          ) : (
                            <Chip label="Активен" color="success" size="small" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title={u.is_blocked ? 'Разблокировать' : 'Заблокировать'}>
                              <IconButton
                                size="small"
                                color={u.is_blocked ? 'success' : 'error'}
                                onClick={() => handleToggleBlockUser(u)}
                              >
                                {u.is_blocked ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Редактировать">
                              <IconButton size="small" color="primary" onClick={() => handleEditUser(u)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ТАБЛИЦА: ПОЕЗДКИ */}
          {activeTab === 'rides' && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Водитель</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Время</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Цена</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Места</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Статус</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rides.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Поездки не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    rides.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {r.driver_first_name || r.driver_username || 'Водитель'}
                        </TableCell>
                        <TableCell>
                          {new Date(r.departure_time).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>{r.base_price} ₽</TableCell>
                        <TableCell>{`${r.available_seats} / ${r.total_seats}`}</TableCell>
                        <TableCell>
                          <Chip
                            label={r.status}
                            size="small"
                            color={
                              r.status === 'scheduled'
                                ? 'primary'
                                : r.status === 'completed'
                                ? 'success'
                                : r.status === 'cancelled'
                                ? 'default'
                                : 'warning'
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Редактировать поездку">
                              <IconButton size="small" color="primary" onClick={() => handleEditRide(r)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Удалить поездку">
                              <IconButton size="small" color="error" onClick={() => handleDeleteRide(r)}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ТАБЛИЦА: АВТОМОБИЛИ */}
          {activeTab === 'vehicles' && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Марка и модель</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Госномер</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Цвет</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Водитель</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vehicles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Автомобили не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    vehicles.map((v) => (
                      <TableRow key={v.id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>{v.brand}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {v.license_plate}
                        </TableCell>
                        <TableCell>{v.color || '-'}</TableCell>
                        <TableCell>{v.driver_username ? `@${v.driver_username}` : '-'}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Редактировать автомобиль">
                              <IconButton size="small" color="primary" onClick={() => handleEditVehicle(v)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Удалить автомобиль">
                              <IconButton size="small" color="error" onClick={() => handleDeleteVehicle(v)}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  );
}