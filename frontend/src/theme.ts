import { createTheme } from '@mui/material/styles';
import { blue, blueGrey } from '@mui/material/colors';
import { ruRU } from '@mui/material/locale';
import type { PaletteMode, Theme } from '@mui/material';

const createAppTheme = (mode: PaletteMode): Theme =>
  createTheme(
    {
      palette: {
        mode,
        primary: {
          main: blue[700],
          light: blue[500],
          dark: blue[900],
        },
        secondary: {
          main: blueGrey[500],
          light: blueGrey[300],
          dark: blueGrey[700],
        },
        background:
          mode === 'dark'
            ? {
                default: '#121212',
                paper: '#1e1e1e',
              }
            : {
                default: '#f5f7fa',
                paper: '#ffffff',
              },
      },
      typography: {
        fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
        subtitle1: { fontWeight: 500 },
        subtitle2: { fontWeight: 500 },
        button: { textTransform: 'none', fontWeight: 600 },
      },
      shape: {
        borderRadius: 12,
      },
      components: {
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: { borderRadius: 10 },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: { borderRadius: 16 },
          },
        },
        MuiPaper: {
          styleOverrides: {
            rounded: { borderRadius: 16 },
          },
        },
        MuiTextField: {
          defaultProps: { size: 'small' },
        },
        MuiChip: {
          styleOverrides: {
            root: { fontWeight: 500 },
          },
        },
      },
    },
    ruRU,
  );

export default createAppTheme;