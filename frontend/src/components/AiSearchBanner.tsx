import type { KeyboardEvent } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';

export interface AiSearchBannerProps {
  query: string;
  onChangeQuery: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * CSS-анимация переливания радуги по контуру при обработке запроса ИИ
 */
const rainbowKeyframes = {
  '@keyframes rainbowGlow': {
    '0%': {
      boxShadow: '0 0 0 3px #ff1744, 0 0 22px rgba(255, 23, 68, 0.65)',
    },
    '20%': {
      boxShadow: '0 0 0 3px #ff9100, 0 0 22px rgba(255, 145, 0, 0.65)',
    },
    '40%': {
      boxShadow: '0 0 0 3px #00e676, 0 0 22px rgba(0, 230, 118, 0.65)',
    },
    '60%': {
      boxShadow: '0 0 0 3px #00b0ff, 0 0 22px rgba(0, 176, 255, 0.65)',
    },
    '80%': {
      boxShadow: '0 0 0 3px #d500f9, 0 0 22px rgba(213, 0, 249, 0.65)',
    },
    '100%': {
      boxShadow: '0 0 0 3px #ff1744, 0 0 22px rgba(255, 23, 68, 0.65)',
    },
  },
  '@keyframes spinIcon': {
    '0%': {
      transform: 'rotate(0deg)',
    },
    '100%': {
      transform: 'rotate(360deg)',
    },
  },
};

/**
 * Компонент баннера интеллектуального поиска поездок через GigaChat AI
 * Позволяет пользователю вводить запрос в свободной форме (естественный язык)
 * В процессе загрузки активирует переливающуюся радужную анимацию по контуру инпута
 */
export default function AiSearchBanner({
  query,
  onChangeQuery,
  onSearch,
  isLoading,
  disabled = false,
  placeholder = 'Например: Нужно уехать в среду к 8:30 от кампуса Новокольцовский в центр',
}: AiSearchBannerProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading && !disabled && query.trim()) {
        onSearch();
      }
    }
  };

  const handleButtonClick = (): void => {
    if (!isLoading && !disabled && query.trim()) {
      onSearch();
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2.5,
        borderRadius: 3.5,
        background: 'linear-gradient(135deg, #0071e3 0%, #0056b3 50%, #003e85 100%)',
        boxShadow: isLoading
          ? '0 0 0 2px rgba(255, 255, 255, 0.5), 0 8px 30px rgba(0, 113, 227, 0.45)'
          : '0 8px 24px -4px rgba(0, 113, 227, 0.35)',
        color: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          color: 'white',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 0.6,
          mb: 1.25,
          fontSize: '0.85rem',
        }}
      >
        <AutoAwesomeIcon
          sx={{
            fontSize: 16,
            animation: isLoading ? 'spinIcon 2s linear infinite' : 'none',
            ...rainbowKeyframes,
          }}
        />
        {isLoading ? 'GigaChat анализирует поездку...' : 'Быстрый поиск ИИ (GigaChat)'}
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          placeholder={placeholder}
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading || disabled}
          sx={{
            ...rainbowKeyframes,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'white',
              borderRadius: 2.5,
              boxShadow: isLoading
                ? '0 0 0 3px #ff1744, 0 0 22px rgba(255, 23, 68, 0.65)'
                : '0 2px 8px rgba(0, 0, 0, 0.08)',
              animation: isLoading ? 'rainbowGlow 2.5s linear infinite' : 'none',
              transition: 'box-shadow 0.3s ease',
              '& fieldset': { borderColor: 'transparent' },
              '&:hover fieldset': { borderColor: 'transparent' },
              '&.Mui-focused fieldset': { borderColor: 'white' },
            },
            '& .MuiOutlinedInput-input': {
              color: '#0f172a',
            },
            '& .MuiOutlinedInput-input::placeholder': {
              color: '#64748b',
              opacity: 1,
            },
          }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleButtonClick}
          disabled={isLoading || disabled || !query.trim()}
          sx={{
            bgcolor: 'white',
            color: 'primary.main',
            borderRadius: 2.5,
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.92)',
              transform: 'scale(1.04)',
            },
            minWidth: 44,
            px: 1.5,
          }}
        >
          {isLoading ? <CircularProgress size={20} /> : <SearchIcon />}
        </Button>
      </Stack>
    </Paper>
  );
}
