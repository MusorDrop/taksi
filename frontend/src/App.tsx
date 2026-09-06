import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';
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
import AdminScreen from './screens/AdminScreen';
import type { TabKey } from './types';

function checkIsAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  return (
    path.endsWith('/admin') ||
    path.endsWith('/admin/') ||
    path.includes('/admin') ||
    hash === '#admin' ||
    hash === '#/admin' ||
    hash.includes('admin') ||
    search.includes('admin')
  );
}

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
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      },
      '#root': {
        paddingTop: 'env(safe-area-inset-top)',
      },
    }}
  />
);

function AppContent() {
  const { user, isAuthLoading } = useApp();
  const [tab, setTab] = useState<TabKey>('find');
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => checkIsAdminRoute());

  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminRoute(checkIsAdminRoute());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Скрытый роут админ-панели (/admin или #admin)
  if (isAdminRoute) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Container maxWidth="md" sx={{ px: { xs: 2, sm: 2.5 }, pt: 2.5 }}>
          <AdminScreen
            onBack={() => {
              if (window.location.hash) {
                window.location.hash = '';
              }
              if (window.location.pathname.includes('/admin')) {
                const cleanPath = window.location.pathname.replace(/\/admin\/?$/, '').replace(/\/admin\/?/, '');
                window.history.pushState(null, '', cleanPath || '/taksi/');
              }
              setIsAdminRoute(false);
            }}
          />
        </Container>
      </Box>
    );
  }

  if (isAuthLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        pb: 'calc(74px + env(safe-area-inset-bottom))',
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          px: { xs: 2, sm: 2.5 },
          pt: 2.5,
        }}
      >
        {tab === 'find' && <FindRidesScreen onNavigateToOffer={() => setTab('offer')} />}
        {tab === 'offer' && <OfferRideScreen onNavigateToProfile={() => setTab('profile')} />}
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
      const savedMode = localStorage.getItem('theme-mode');
      // Если у пользователя уже сохранена тема в localStorage, используем её
      if (savedMode === 'dark' || savedMode === 'light') {
        return savedMode;
      }
      // При первом заходе по умолчанию всегда устанавливаем светлую тему ('light'),
      // игнорируя системные предпочтения prefers-color-scheme (даже если dark)
      return 'light';
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
