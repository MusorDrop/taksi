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
      elevation={0}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        borderRadius: 0,
        borderTop: '1px solid',
        borderColor: 'divider',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation
        value={value}
        onChange={(_, v: TabKey) => onChange(v)}
        showLabels
        sx={{
          bgcolor: 'background.paper',
          height: 64,
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.68rem',
            fontWeight: 600,
          },
          '& .Mui-selected': {
            color: 'primary.main',
          },
        }}
      >
        <BottomNavigationAction
          label="Найти поездку"
          value="find"
          icon={<ExploreIcon />}
        />
        <BottomNavigationAction
          label="Создать поездку"
          value="offer"
          icon={<AddCircleIcon />}
        />
        <BottomNavigationAction
          label="Мои поездки"
          value="trips"
          icon={<DirectionsCarIcon />}
        />
        <BottomNavigationAction
          label="Профиль"
          value="profile"
          icon={<PersonIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
}
