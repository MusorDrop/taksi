import { useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import GlobalStyles from '@mui/material/GlobalStyles';
import type { PaletteMode } from '@mui/material';
import createAppTheme from './theme';
import { ThemeModeContext } from './ThemeModeContext';
import { AppProvider, useApp } from './AppContext';
import BottomNav from './components/BottomNav';
import AuthScreen from './screens/AuthScreen';
import FindRidesScreen from './screens/FindRidesScreen';
import OfferRideScreen from './screens/OfferRideScreen';
import MyTripsScreen from './screens/MyTripsScreen';
import ProfileScreen from './screens/ProfileScreen';
import type { TabKey } from './types';

const globalStyles = (
  <GlobalStyles
    styles={{
      '*': {
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      },
      'input, textarea': {
        userSelect: 'text',
        WebkitUserSelect: 'text',
      },
      html: {
        WebkitTextSizeAdjust: '100%',
      },
      body: {
        overscrollBehavior: 'none',
        WebkitOverflowScrolling: 'touch',
      },
      '#root': {
        paddingTop: 'env(safe-area-inset-top)',
      },
    }}
  />
);

function AppContent() {
  const { user } = useApp();
  const [tab, setTab] = useState<TabKey>('find');

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        pb: 'calc(64px + env(safe-area-inset-bottom))',
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          px: 2,
          pt: 2,
        }}
      >
        {tab === 'find' && <FindRidesScreen />}
        {tab === 'offer' && <OfferRideScreen />}
        {tab === 'trips' && <MyTripsScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </Container>
      <BottomNav value={tab} onChange={setTab} />
    </Box>
  );
}

function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(() => {
    try {
      return localStorage.getItem('theme-mode') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const toggleTheme = () => {
    setMode((prev) => {
      const next: PaletteMode = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('theme-mode', next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  return (
    <ThemeModeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

function App() {
  return (
    <ThemeModeProvider>
      <CssBaseline />
      {globalStyles}
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ThemeModeProvider>
  );
}

export default App;
