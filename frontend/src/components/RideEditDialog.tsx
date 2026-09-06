import { useState, useEffect, type FormEvent } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PaymentsIcon from '@mui/icons-material/Payments';
import GroupIcon from '@mui/icons-material/Group';
import { useApp } from '../AppContext';
import { useAddressSuggest, type AddressOption, type UseAddressSuggestReturn } from '../hooks/useAddressSuggest';
import { useRoutePreview } from '../hooks/useRoutePreview';
import RouteMap from './RouteMap';
import type { Ride } from '../types';

interface AddressAutocompleteFieldProps {
  label: string;
  placeholder: string;
  iconColor: string;
  suggest: UseAddressSuggestReturn;
  disabled?: boolean;
}

/**
 * Вспомогательный компонент автодополнения адреса на базе Яндекс Карт
 */
function AddressAutocompleteField({
  label,
  placeholder,
  iconColor,
  suggest,
  disabled = false,
}: AddressAutocompleteFieldProps) {
  return (
    <Autocomplete<AddressOption | string, false, false, true>
      freeSolo
      disabled={disabled}
      options={suggest.options}
      loading={suggest.isLoading}
      filterOptions={(x) => x}
      value={suggest.value || null}
      inputValue={suggest.inputValue}
      open={
        suggest.isOpen &&
        Boolean(suggest.inputValue.trim() && (suggest.options.length > 0 || suggest.isLoading))
      }
      onOpen={() => suggest.setIsOpen(true)}
      onClose={() => suggest.setIsOpen(false)}
      onInputChange={(e, val, reason) => {
        suggest.handleInputChange(e, val, reason);
        if (reason === 'input') {
          suggest.setValue(val);
        }
      }}
      onChange={suggest.handleChange}
      onBlur={suggest.handleBlur}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option.label || option.value || ''
      }
      isOptionEqualToValue={(option, val) => {
        const optVal = typeof option === 'string' ? option : option.value || option.label;
        const targetVal = typeof val === 'string' ? val : val.value || val.label;
        return optVal === targetVal;
      }}
      noOptionsText={
        suggest.inputValue.trim().length < 2
          ? 'Введите не менее 2 символов'
          : 'Адрес в Екатеринбурге не найден'
      }
      loadingText="Поиск адресов в Екатеринбурге..."
      slotProps={{
        popper: {
          sx: { zIndex: 1600 },
          modifiers: [
            {
              name: 'preventOverflow',
              options: { boundary: 'clippingParents' },
            },
          ],
        },
        paper: {
          elevation: 6,
          sx: { borderRadius: 2, mt: 0.5 },
        },
        listbox: {
          sx: { maxHeight: 220 },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          fullWidth
          label={label}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <InputAdornment position="start">
                  <LocationOnIcon sx={{ fontSize: 20, color: iconColor }} />
                </InputAdornment>
                {params.InputProps.startAdornment}
              </>
            ),
            endAdornment: (
              <>
                {suggest.isLoading ? (
                  <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        const addressText = typeof option === 'string' ? option : option.label;
        const subtitleText = typeof option === 'string' ? undefined : option.subtitle;
        return (
          <Box component="li" key={key} {...optionProps}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', py: 0.5 }}>
              <LocationOnIcon sx={{ fontSize: 20, color: iconColor, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                  {addressText}
                </Typography>
                {subtitleText && (
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {subtitleText}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>
        );
      }}
    />
  );
}

interface ValidationParams {
  from: string;
  to: string;
  time: string;
  price: number;
  seats: number;
  passengersCount: number;
}

/**
 * Валидация полей формы редактирования поездки
 */
function validateEditForm(params: ValidationParams): string | null {
  if (!params.from || !params.to) {
    return 'Укажите начальный и конечный адреса поездки';
  }
  if (params.from.toLowerCase() === params.to.toLowerCase()) {
    return 'Точки отправления и назначения не могут совпадать';
  }
  if (!params.time) {
    return 'Укажите время выезда';
  }
  if (isNaN(params.price) || params.price <= 0) {
    return 'Укажите корректную стоимость поездки (больше 0)';
  }
  if (isNaN(params.seats) || params.seats < 1 || params.seats > 8) {
    return 'Количество мест должно быть от 1 до 8';
  }
  if (params.seats < params.passengersCount) {
    return `Количество мест (${params.seats}) не может быть меньше числа записавшихся пассажиров (${params.passengersCount})`;
  }
  return null;
}

/**
 * Извлечение начальных координат [lon, lat] из объекта поездки
 */
function getRideStartCoords(ride: Ride): [number, number] | null {
  if (ride.startLon !== undefined && ride.startLat !== undefined) {
    return [ride.startLon, ride.startLat];
  }
  if (
    ride.startCoords &&
    typeof ride.startCoords.lon === 'number' &&
    typeof ride.startCoords.lat === 'number'
  ) {
    return [ride.startCoords.lon, ride.startCoords.lat];
  }
  return null;
}

/**
 * Извлечение конечных координат [lon, lat] из объекта поездки
 */
function getRideEndCoords(ride: Ride): [number, number] | null {
  if (ride.endLon !== undefined && ride.endLat !== undefined) {
    return [ride.endLon, ride.endLat];
  }
  if (
    ride.endCoords &&
    typeof ride.endCoords.lon === 'number' &&
    typeof ride.endCoords.lat === 'number'
  ) {
    return [ride.endCoords.lon, ride.endCoords.lat];
  }
  return null;
}

export interface RideEditDialogProps {
  open: boolean;
  onClose: () => void;
  ride: Ride;
}

/**
 * Диалоговое окно редактирования параметров поездки с автодополнением адресов
 */
export default function RideEditDialog({ open, onClose, ride }: RideEditDialogProps) {
  const { updateRide } = useApp();
  const fromSuggest = useAddressSuggest(ride.from);
  const toSuggest = useAddressSuggest(ride.to);
  const [time, setTime] = useState<string>(ride.time);
  const [price, setPrice] = useState<string>(String(ride.price));
  const [seats, setSeats] = useState<string>(String(ride.totalSeats || 4));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const {
    setValue: setFromValue,
    setInputValue: setFromInputValue,
    setOptions: setFromOptions,
  } = fromSuggest;

  const {
    setValue: setToValue,
    setInputValue: setToInputValue,
    setOptions: setToOptions,
  } = toSuggest;

  const {
    polyline,
    distanceKm,
    durationMin,
    startCoords,
    endCoords,
    isRouteLoading,
    setInitialRoute,
  } = useRoutePreview(fromSuggest.value, toSuggest.value, time, {
    enabled: open,
    initialPolyline: ride.polyline ?? null,
    initialStartCoords: getRideStartCoords(ride),
    initialEndCoords: getRideEndCoords(ride),
    initialDistanceKm: ride.distanceKm ?? null,
    initialDurationMin: ride.durationMin ?? null,
  });

  // Синхронизация состояния полей при открытии диалога с актуальными данными поездки
  useEffect(() => {
    if (open) {
      setFromValue(ride.from || '');
      setFromInputValue(ride.from || '');
      setFromOptions([]);
      setToValue(ride.to || '');
      setToInputValue(ride.to || '');
      setToOptions([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTime(ride.time || '');
      setPrice(String(ride.price ?? ''));
      setSeats(String(ride.totalSeats || 4));
      setError(null);
      setInitialRoute({
        polyline: ride.polyline ?? null,
        startCoords: getRideStartCoords(ride),
        endCoords: getRideEndCoords(ride),
        distanceKm: ride.distanceKm ?? null,
        durationMin: ride.durationMin ?? null,
      });
    }
  }, [
    open,
    ride,
    setFromValue,
    setFromInputValue,
    setFromOptions,
    setToValue,
    setToInputValue,
    setToOptions,
    setInitialRoute,
  ]);

  const handleClose = (): void => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const finalFrom = fromSuggest.value.trim() || fromSuggest.inputValue.trim();
    const finalTo = toSuggest.value.trim() || toSuggest.inputValue.trim();
    const numPrice = Number(price);
    const numSeats = Number(seats);
    const passengersCount = ride.passengers?.length || ride.passengerIds?.length || 0;

    const validationError = validateEditForm({
      from: finalFrom,
      to: finalTo,
      time: time.trim(),
      price: numPrice,
      seats: numSeats,
      passengersCount,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateRide(ride.id, {
        from: finalFrom,
        to: finalTo,
        time: time.trim(),
        departure_time: time.trim(),
        price: numPrice,
        base_price: numPrice,
        seats: numSeats,
        total_seats: numSeats,
        distance_km: distanceKm ?? ride.distanceKm,
        distanceKm: distanceKm ?? ride.distanceKm,
      });
      setIsSubmitting(false);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось обновить маршрут';
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      onClick={(e) => e.stopPropagation()}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3.5 },
      }}
    >
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle
          component="div"
          sx={{
            m: 0,
            p: 2.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h6" component="span" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            Редактировать маршрут
          </Typography>
          <IconButton
            size="small"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="close"
            sx={{ borderRadius: 2 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2.5 }}>
          <Stack spacing={2.5}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {/* Точка А: Откуда с автосаджестом */}
            <AddressAutocompleteField
              label="Откуда (Точка А)"
              placeholder="Например: проспект Ленина 51"
              iconColor="primary.main"
              suggest={fromSuggest}
              disabled={isSubmitting}
            />

            {/* Точка Б: Куда с автосаджестом */}
            <AddressAutocompleteField
              label="Куда (Точка Б)"
              placeholder="Например: Кампус Новокольцовский"
              iconColor="error.main"
              suggest={toSuggest}
              disabled={isSubmitting}
            />

            {/* Интерактивная карта маршрута */}
            <Box
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 4px 16px rgba(0, 0, 0, 0.25)'
                    : '0 2px 8px -2px rgba(15, 23, 42, 0.06)',
              }}
            >
              <RouteMap
                from={fromSuggest.value || 'Точка А'}
                to={toSuggest.value || 'Точка Б'}
                polyline={polyline}
                startCoords={startCoords}
                endCoords={endCoords}
                distanceKm={distanceKm}
                durationMin={durationMin}
                height={240}
              />
            </Box>

            {/* Время выезда */}
            <TextField
              fullWidth
              label="Время выезда"
              type="time"
              disabled={isSubmitting}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccessTimeIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {/* Цена за место */}
              <TextField
                fullWidth
                label="Цена за место (₽)"
                placeholder="Например: 150"
                type="number"
                disabled={isSubmitting}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PaymentsIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { min: 0, step: 5, inputMode: 'numeric' },
                }}
              />

              {/* Всего мест */}
              <TextField
                fullWidth
                label="Всего мест"
                placeholder="4"
                type="number"
                disabled={isSubmitting}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                helperText={`Свободно сейчас: ${ride.availableSeats ?? 0}`}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <GroupIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { min: 1, max: 8, inputMode: 'numeric' },
                }}
              />
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting} color="inherit" sx={{ fontWeight: 600 }}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || isRouteLoading}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              fontWeight: 700,
              borderRadius: 2.5,
              px: 3,
              boxShadow: '0 4px 14px rgba(0, 113, 227, 0.25)',
            }}
          >
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
