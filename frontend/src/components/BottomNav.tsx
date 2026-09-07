import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import ExploreIcon from '@mui/icons-material/Explore';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import type { TabKey } from '../types';

interface BottomNavProps {
  value: TabKey;
  onChange: (value: TabKey) => void;
}

export default function BottomNav({ value, onChange }: BottomNavProps) {
  return (
    <Paper
      component="nav"
      aria-label="Основная навигация"
      elevation={0}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        borderRadius: 0,
        borderTop: '1px solid',
        borderColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 -4px 20px 0 rgba(0, 0, 0, 0.4)'
            : '0 -4px 20px 0 rgba(15, 23, 42, 0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        bgcolor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation
        value={value}
        onChange={(_, v: TabKey) => onChange(v)}
        showLabels
        sx={{
          bgcolor: 'transparent',
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            py: 0.75,
            px: 0.5,
            mx: 0.5,
            borderRadius: 2.5,
            transition: 'background-color 0.15s ease, color 0.15s ease',
            '&:hover': {
              bgcolor: 'action.hover',
            },
            '& .MuiSvgIcon-root': {
              fontSize: 23,
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            },
            '&.Mui-selected': {
              color: 'primary.main',
              '& .MuiSvgIcon-root': {
                transform: 'scale(1.12)',
              },
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            mt: 0.25,
            '&.Mui-selected': {
              fontSize: '0.7rem',
            },
          },
        }}
      >
        <BottomNavigationAction
          label="Найти поездку"
          value="find"
          icon={<ExploreIcon />}
          aria-label="Найти поездку"
        />
        <BottomNavigationAction
          label="Создать поездку"
          value="offer"
          icon={<AddCircleIcon />}
          aria-label="Создать поездку"
        />
        <BottomNavigationAction
          label="Мои поездки"
          value="trips"
          icon={<DirectionsCarIcon />}
          aria-label="Мои поездки"
        />
        <BottomNavigationAction
          label="Профиль"
          value="profile"
          icon={<PersonIcon />}
          aria-label="Профиль"
        />
      </BottomNavigation>
    </Paper>
  );
}
