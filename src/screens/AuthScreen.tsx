import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { useApp } from '../AppContext';

export default function AuthScreen() {
  const { login } = useApp();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      login(name);
      setLoading(false);
    }, 1200);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        px: 3,
        pb: 4,
        pt: 'env(safe-area-inset-top)',
        background: 'linear-gradient(160deg, #1565c0 0%, #1976d2 40%, #42a5f5 100%)',
      }}
    >
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
        <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
          С возвращением
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Войдите, чтобы найти и предложить поездки
        </Typography>

        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Логин"
            placeholder="Например: Алексей Морозов"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            placeholder="Введите пароль"
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
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 1, py: 1.2, fontSize: '1rem' }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Войти'}
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
          Демо-режим — введите любое имя и пароль для входа
        </Typography>
      </Box>
    </Box>
  );
}
