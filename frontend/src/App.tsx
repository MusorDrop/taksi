import { useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';
import GlobalStyles from '@mui/material/GlobalStyles';
import theme from './theme';
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
  const { user, isAuthLoading } = useApp();
  const [tab, setTab] = useState<TabKey>('find');

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

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
