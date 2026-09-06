import { createTheme } from '@mui/material/styles';
import { ruRU } from '@mui/material/locale';
import type { PaletteMode, Shadows, Theme } from '@mui/material';

/**
 * Создает массив из 25 многослойных мягких теней в стиле Apple / Material You
 */
const createModernShadows = (mode: PaletteMode): Shadows => {
  const isDark = mode === 'dark';
  const shadowColor = isDark ? '0, 0, 0' : '15, 23, 42';
  return [
    'none',
    `0 1px 2px 0 rgba(${shadowColor}, 0.04), 0 1px 1px 0 rgba(${shadowColor}, 0.02)`,
    `0 3px 6px -1px rgba(${shadowColor}, 0.05), 0 1px 3px -1px rgba(${shadowColor}, 0.03)`,
    `0 6px 12px -2px rgba(${shadowColor}, 0.06), 0 2px 5px -1px rgba(${shadowColor}, 0.03)`,
    `0 10px 20px -3px rgba(${shadowColor}, 0.07), 0 4px 8px -2px rgba(${shadowColor}, 0.04)`,
    `0 14px 26px -4px rgba(${shadowColor}, 0.08), 0 6px 12px -3px rgba(${shadowColor}, 0.04)`,
    `0 18px 32px -5px rgba(${shadowColor}, 0.09), 0 8px 16px -4px rgba(${shadowColor}, 0.05)`,
    `0 20px 36px -5px rgba(${shadowColor}, 0.10), 0 10px 18px -4px rgba(${shadowColor}, 0.05)`,
    `0 24px 42px -6px rgba(${shadowColor}, 0.11), 0 12px 20px -4px rgba(${shadowColor}, 0.06)`,
    `0 28px 48px -7px rgba(${shadowColor}, 0.12), 0 14px 22px -5px rgba(${shadowColor}, 0.06)`,
    `0 32px 54px -8px rgba(${shadowColor}, 0.13), 0 16px 24px -5px rgba(${shadowColor}, 0.07)`,
    `0 36px 60px -9px rgba(${shadowColor}, 0.14), 0 18px 26px -6px rgba(${shadowColor}, 0.07)`,
    `0 40px 66px -10px rgba(${shadowColor}, 0.15), 0 20px 28px -6px rgba(${shadowColor}, 0.08)`,
    `0 44px 72px -11px rgba(${shadowColor}, 0.16), 0 22px 30px -7px rgba(${shadowColor}, 0.08)`,
    `0 48px 78px -12px rgba(${shadowColor}, 0.17), 0 24px 32px -7px rgba(${shadowColor}, 0.09)`,
    `0 52px 84px -13px rgba(${shadowColor}, 0.18), 0 26px 34px -8px rgba(${shadowColor}, 0.09)`,
    `0 56px 90px -14px rgba(${shadowColor}, 0.19), 0 28px 36px -8px rgba(${shadowColor}, 0.10)`,
    `0 60px 96px -15px rgba(${shadowColor}, 0.20), 0 30px 38px -9px rgba(${shadowColor}, 0.10)`,
    `0 64px 102px -16px rgba(${shadowColor}, 0.21), 0 32px 40px -9px rgba(${shadowColor}, 0.11)`,
    `0 68px 108px -17px rgba(${shadowColor}, 0.22), 0 34px 42px -10px rgba(${shadowColor}, 0.11)`,
    `0 72px 114px -18px rgba(${shadowColor}, 0.23), 0 36px 44px -10px rgba(${shadowColor}, 0.12)`,
    `0 76px 120px -19px rgba(${shadowColor}, 0.24), 0 38px 46px -11px rgba(${shadowColor}, 0.12)`,
    `0 80px 126px -20px rgba(${shadowColor}, 0.25), 0 40px 48px -11px rgba(${shadowColor}, 0.13)`,
    `0 84px 132px -21px rgba(${shadowColor}, 0.26), 0 42px 50px -12px rgba(${shadowColor}, 0.13)`,
    `0 88px 138px -22px rgba(${shadowColor}, 0.27), 0 44px 52px -12px rgba(${shadowColor}, 0.14)`,
  ] as Shadows;
};

const createAppTheme = (mode: PaletteMode): Theme => {
  const isDark = mode === 'dark';

  return createTheme(
    {
      palette: {
        mode,
        primary: {
          main: '#0071e3',
          light: '#47a1ff',
          dark: '#005bb5',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#64748b',
          light: '#94a3b8',
          dark: '#475569',
          contrastText: '#ffffff',
        },
        background: isDark
          ? {
              default: '#0f172a',
              paper: '#1e293b',
            }
          : {
              default: '#f8fafc',
              paper: '#ffffff',
            },
        divider: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.18)',
        text: isDark
          ? {
              primary: '#f8fafc',
              secondary: '#94a3b8',
            }
          : {
              primary: '#0f172a',
              secondary: '#64748b',
            },
      },
      shadows: createModernShadows(mode),
      typography: {
        fontFamily:
          "'-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
        h4: { fontWeight: 700, letterSpacing: '-0.025em' },
        h5: { fontWeight: 650, letterSpacing: '-0.02em' },
        h6: { fontWeight: 650, letterSpacing: '-0.015em' },
        subtitle1: { fontWeight: 600, letterSpacing: '-0.01em' },
        subtitle2: { fontWeight: 600, letterSpacing: '-0.005em' },
        body1: { letterSpacing: '-0.005em' },
        body2: { letterSpacing: '0em' },
        button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.005em' },
      },
      shape: {
        borderRadius: 14,
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              scrollbarWidth: 'thin',
              scrollbarColor: isDark ? '#334155 transparent' : '#cbd5e1 transparent',
            },
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              borderRadius: 12,
              padding: '7px 16px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:active': {
                transform: 'scale(0.97)',
              },
            },
            containedPrimary: {
              boxShadow: '0 3px 12px 0 rgba(0, 113, 227, 0.22)',
              '&:hover': {
                boxShadow: '0 6px 18px 0 rgba(0, 113, 227, 0.32)',
                transform: 'translateY(-1px)',
              },
            },
            outlined: {
              borderWidth: 1.5,
              '&:hover': {
                borderWidth: 1.5,
                backgroundColor: isDark ? 'rgba(0, 113, 227, 0.08)' : 'rgba(0, 113, 227, 0.04)',
                transform: 'translateY(-1px)',
              },
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 18,
              transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            rounded: {
              borderRadius: 18,
            },
          },
        },
        MuiTextField: {
          defaultProps: { size: 'small' },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 12,
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              '&.Mui-focused': {
                boxShadow: '0 0 0 3.5px rgba(0, 113, 227, 0.14)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderWidth: 1.5,
              },
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              fontWeight: 600,
              borderRadius: 9,
              transition: 'all 0.15s ease',
            },
            clickable: {
              '&:hover': {
                transform: 'translateY(-1px)',
              },
              '&:active': {
                transform: 'scale(0.96)',
              },
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: 22,
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              boxShadow: isDark
                ? '0 24px 60px -10px rgba(0, 0, 0, 0.6)'
                : '0 24px 60px -12px rgba(15, 23, 42, 0.22)',
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            indicator: {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              borderRadius: 10,
              minHeight: 44,
              transition: 'all 0.2s ease',
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:active': {
                transform: 'scale(0.92)',
              },
            },
          },
        },
      },
    },
    ruRU,
  );
};

export default createAppTheme;

