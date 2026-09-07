import { useState, useEffect, useMemo, lazy, Suspense, type ReactNode } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  Outlet,
} from 'react-router-dom';
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
import type { TabKey } from './types';

// Ленивая загрузка панели администратора с разделением бандла на отдельный чанк
const AdminScreen = lazy(() => import('./screens/AdminScreen'));

const globalStyles = (
  <GlobalStyles
    styles={{
      '*': {
        WebkitTapHighlightColor: 'transparent',
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
      ':focus-visible': {
        outline: '2px solid #0071e3',
        outlineOffset: '2px',
      },
    }}
  />
);

/**
 * Компонент полноэкранного индикатора загрузки
 */
function ScreenLoadingFallback({ label }: { label: string }) {
  return (
    <Box
      component="main"
      role="status"
      aria-label={label}
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

/**
 * Маршрут панели администратора
 */
function AdminRoute() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Container component="main" maxWidth="md" sx={{ px: { xs: 2, sm: 2.5 }, pt: 2.5 }}>
        <AdminScreen onBack={() => navigate('/')} />
      </Container>
    </Box>
  );
}

/**
 * Маршрут экрана поиска поездок
 */
function FindRidesRoute() {
  const navigate = useNavigate();

  return <FindRidesScreen onNavigateToOffer={() => navigate('/offer')} />;
}

/**
 * Маршрут экрана предложения поездки
 */
function OfferRideRoute() {
  const navigate = useNavigate();

  return (
    <OfferRideScreen
      onNavigateToProfile={() => navigate('/profile')}
      onSuccess={() => {
        navigate('/trips', { state: { initialTab: 'driver' } });
      }}
    />
  );
}

/**
 * Маршрут экрана моих поездок
 */
function MyTripsRoute() {
  const location = useLocation();
  const state = location.state as { initialTab?: 'passenger' | 'driver' } | null;

  return <MyTripsScreen initialTab={state?.initialTab || 'passenger'} />;
}

/**
 * Основной макет приложения с нижней навигацией и контейнером экранов
 */
function MainLayout() {
  const { user, isAuthLoading } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  // Прокрутка страницы наверх при переходе между экранами
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  if (isAuthLoading) {
    return <ScreenLoadingFallback label="Загрузка приложения" />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Определение активной вкладки по текущему маршруту
  const getActiveTab = (): TabKey => {
    if (location.pathname.startsWith('/offer')) return 'offer';
    if (location.pathname.startsWith('/trips')) return 'trips';
    if (location.pathname.startsWith('/profile')) return 'profile';
    return 'find';
  };

  const handleTabChange = (newTab: TabKey): void => {
    switch (newTab) {
      case 'find':
        navigate('/');
        break;
      case 'offer':
        navigate('/offer');
        break;
      case 'trips':
        navigate('/trips');
        break;
      case 'profile':
        navigate('/profile');
        break;
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        pb: 'calc(74px + env(safe-area-inset-bottom))',
      }}
    >
      <Container
        component="main"
        maxWidth="sm"
        sx={{
          px: { xs: 2, sm: 2.5 },
          pt: 2.5,
        }}
      >
        <Outlet />
      </Container>
      <BottomNav value={getActiveTab()} onChange={handleTabChange} />
    </Box>
  );
}

/**
 * Редирект для обратной совместимости с URL вида /#admin
 */
function HashRedirect(): null {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.hash === '#admin' || location.hash === '#/admin' || location.hash.includes('admin')) {
      navigate('/admin', { replace: true });
    }
  }, [location.hash, navigate]);

  return null;
}

function AppContent() {
  return (
    <>
      <HashRedirect />
      <Routes>
        <Route
          path="/admin"
          element={
            <Suspense fallback={<ScreenLoadingFallback label="Загрузка панели администратора" />}>
              <AdminRoute />
            </Suspense>
          }
        />
        <Route element={<MainLayout />}>
          <Route index element={<FindRidesRoute />} />
          <Route path="find" element={<Navigate to="/" replace />} />
          <Route path="offer" element={<OfferRideRoute />} />
          <Route path="trips" element={<MyTripsRoute />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
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
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </BrowserRouter>
    </ThemeModeProvider>
  );
}

export default App;
