import { useState } from 'react';
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
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SendIcon from '@mui/icons-material/Send';
import { useApp } from '../AppContext';

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const { login, register } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [telegram, setTelegram] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const changeMode = (_: React.SyntheticEvent, value: Mode) => {
    setMode(value);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setError('Заполните логин и пароль');
      return;
    }
    if (mode === 'register' && password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(trimmedUser, password);
      } else {
        await register({
          username: trimmedUser,
          password,
          first_name: firstName.trim() || trimmedUser,
          telegram_username: telegram.trim()
            ? telegram.trim().replace(/^@+/, '')
            : undefined,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить запрос');
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
        <Stack spacing={1} alignItems="center" sx={{ mb: 5, mt: -4 }}>
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
            Делитесь поездками в кампус и экономьте вместе
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
            value={mode}
            onChange={changeMode}
            variant="fullWidth"
            sx={{ mb: 3, '& .MuiTab-root': { fontWeight: 600, textTransform: 'none' } }}
          >
            <Tab label="Вход" value="login" />
            <Tab label="Регистрация" value="register" />
          </Tabs>

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Логин"
              autoComplete="username"
              placeholder="Придумайте уникальный логин"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
{mode === 'register' && (
              <TextField
                fullWidth
                label="Имя (необязательно)"
                placeholder="Как вас зовут"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            )}
            {mode === 'register' && (
              <TextField
                fullWidth
                label="Telegram username (необязательно)"
                placeholder="durov"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                helperText="Чтобы пассажиры могли написать вам в Telegram"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SendIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
            <TextField
              fullWidth
              label="Пароль"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="Минимум 8 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {mode === 'register' && (
              <TextField
                fullWidth
                label="Повторите пароль"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
            )}

            {error && <Alert severity="error">{error}</Alert>}

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
              ) : mode === 'login' ? (
                'Войти'
              ) : (
                'Зарегистрироваться'
              )}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}