import { useState, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Link from '@mui/material/Link';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { useApp } from '../AppContext';
import { api } from '../api';
import type { AuthResponse } from '../types';
import Terms from '../components/Terms';
import Privacy from '../components/Privacy';

export default function AuthScreen() {
  const { loginWithData } = useApp();
  const [tabIndex, setTabIndex] = useState<number>(0);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState<boolean>(false);
  const [showPrivacy, setShowPrivacy] = useState<boolean>(false);

  const isRegisterMode = tabIndex === 1;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setErrorMessage('Пожалуйста, укажите логин и пароль');
      return;
    }

    if (isRegisterMode && trimmedPassword.length < 8) {
      setErrorMessage('Пароль для регистрации должен быть не менее 8 символов');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegisterMode
        ? {
            username: trimmedUsername,
            password: trimmedPassword,
            first_name: trimmedUsername,
            role: 'both',
          }
        : {
            username: trimmedUsername,
            password: trimmedPassword,
          };

      const response = await api.post<AuthResponse>(endpoint, payload);
      if (response && response.token && response.user) {
        loginWithData(response.token, response.user);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Произошла ошибка при выполнении запроса';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        px: 2,
        pb: 4,
        pt: 'env(safe-area-inset-top)',
        background: 'linear-gradient(160deg, #1565c0 0%, #1976d2 40%, #42a5f5 100%)',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}>
        <Stack spacing={1} alignItems="center" sx={{ mb: 4, mt: -2 }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <DirectionsCarIcon sx={{ fontSize: 36, color: 'white' }} />
          </Box>
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, letterSpacing: '-0.5px' }}>
            CampusRide
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Делитесь поездками в кампус УрФУ и экономьте вместе
          </Typography>
        </Stack>

        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 4,
            p: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}
          component="form"
          onSubmit={handleSubmit}
        >
          <Tabs
            value={tabIndex}
            onChange={(_, newValue: number) => {
              setTabIndex(newValue);
              setErrorMessage(null);
            }}
            variant="fullWidth"
            sx={{ mb: 2.5 }}
          >
            <Tab label="Вход" sx={{ fontWeight: 600 }} />
            <Tab label="Регистрация" sx={{ fontWeight: 600 }} />
          </Tabs>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {isRegisterMode
              ? 'Создайте аккаунт, чтобы искать попутчиков и публиковать поездки'
              : 'Войдите, используя свои учетные данные'}
          </Typography>

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Логин"
              placeholder="Например: ivan_ivanov"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              fullWidth
              label="Пароль"
              type="password"
              placeholder={isRegisterMode ? 'Не менее 8 символов' : 'Введите пароль'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 1, py: 1.2, fontSize: '1rem' }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : isRegisterMode ? (
                'Зарегистрироваться'
              ) : (
                'Войти'
              )}
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mt: 3 }}>
            <Link
              component="button"
              type="button"
              variant="caption"
              color="text.secondary"
              underline="hover"
              onClick={() => setShowTerms(true)}
            >
              Пользовательское соглашение
            </Link>
            <Typography variant="caption" color="text.secondary">
              •
            </Typography>
            <Link
              component="button"
              type="button"
              variant="caption"
              color="text.secondary"
              underline="hover"
              onClick={() => setShowPrivacy(true)}
            >
              Политика конфиденциальности
            </Link>
          </Stack>
        </Box>
      </Box>

      <Terms open={showTerms} onClose={() => setShowTerms(false)} />
      <Privacy open={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </Box>
  );
}
