import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Autocomplete from '@mui/material/Autocomplete';
import BoltIcon from '@mui/icons-material/Bolt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SendIcon from '@mui/icons-material/Send';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PaymentsIcon from '@mui/icons-material/Payments';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import RepeatIcon from '@mui/icons-material/Repeat';
import RouteMap from '../components/RouteMap';
import { formatPrice } from '../utils';
import type { AddressOption } from '../hooks/useAddressSuggest';
import {
  useRideForm,
  WEEK_DAYS,
  AVAILABLE_TAGS,
  AI_ACCENT,
  getTodayDateString,
} from '../hooks/useRideForm';

export interface OfferRideScreenProps {
  onNavigateToProfile?: () => void;
  onSuccess?: () => void;
}

/**
 * Экран предложения новой поездки водителем с интерактивной картой и автодополнением адресов
 */
export default function OfferRideScreen({ onNavigateToProfile, onSuccess }: OfferRideScreenProps) {
  const {
    fromSuggest,
    toSuggest,
    rideType,
    setRideType,
    regularDays,
    handleDayToggle,
    date,
    setDate,
    time,
    setTime,
    telegram,
    setTelegram,
    price,
    setPrice,
    description,
    setDescription,
    tags,
    handleTagToggle,
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    hasNoVehicles,
    isSubmitting,
    submitError,
    setSubmitError,
    success,
    canSubmit,
    routePolyline,
    routeDistance,
    routeDuration,
    startCoords,
    endCoords,
    recommendedPrice,
    isPeakDemand,
    isRouteLoading,
    handleApplyRecommendation,
    handleSubmit,
  } = useRideForm();

  // Автоматическое переключение на вкладку «Мои поездки» при успешном создании маршрута
  useEffect(() => {
    if (success && onSuccess) {
      onSuccess();
    }
  }, [success, onSuccess]);

  return (
    <Box component="section" aria-label="Создать поездку" sx={{ pb: { xs: 12, sm: 8 } }}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 2.5, letterSpacing: '-0.02em' }}>
        Создать поездку
      </Typography>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      {hasNoVehicles && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            onNavigateToProfile ? (
              <Button color="inherit" size="small" onClick={onNavigateToProfile} sx={{ fontWeight: 600 }}>
                В профиль
              </Button>
            ) : null
          }
        >
          Сначала добавьте автомобиль в профиле, чтобы предложить поездку.
        </Alert>
      )}

      {success && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'success.light',
            color: 'success.contrastText',
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Ваш маршрут опубликован! Пассажиры теперь могут найти и забронировать его.
          </Typography>
        </Paper>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {/* Поле выбора начальной точки отправления (Откуда) с автодополнением */}
          <Autocomplete<AddressOption | string, false, false, true>
            freeSolo
            disabled={hasNoVehicles}
            options={fromSuggest.options}
            loading={fromSuggest.isLoading}
            filterOptions={(x) => x}
            value={fromSuggest.value || null}
            inputValue={fromSuggest.inputValue}
            open={
              fromSuggest.isOpen &&
              Boolean(fromSuggest.inputValue.trim() && (fromSuggest.options.length > 0 || fromSuggest.isLoading))
            }
            onOpen={() => fromSuggest.setIsOpen(true)}
            onClose={() => fromSuggest.setIsOpen(false)}
            onInputChange={fromSuggest.handleInputChange}
            onChange={fromSuggest.handleChange}
            onBlur={fromSuggest.handleBlur}
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.label || option.value || ''
            }
            isOptionEqualToValue={(option, val) => {
              const optVal = typeof option === 'string' ? option : option.value || option.label;
              const targetVal = typeof val === 'string' ? val : val.value || val.label;
              return optVal === targetVal;
            }}
            noOptionsText={
              fromSuggest.inputValue.trim().length < 2
                ? 'Введите не менее 2 символов'
                : 'Адрес в Екатеринбурге не найден'
            }
            loadingText="Поиск адресов в Екатеринбурге..."
            slotProps={{
              popper: {
                sx: { zIndex: 1500 },
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
                sx: { maxHeight: 280 },
              },
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                label="Откуда (Точка А)"
                placeholder="Например: проспект Ленина 51 или Мира 19"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <LocationOnIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {fromSuggest.isLoading ? (
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
                    <LocationOnIcon sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
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

          {/* Поле выбора конечной точки назначения (Куда) с автодополнением */}
          <Autocomplete<AddressOption | string, false, false, true>
            freeSolo
            disabled={hasNoVehicles}
            options={toSuggest.options}
            loading={toSuggest.isLoading}
            filterOptions={(x) => x}
            value={toSuggest.value || null}
            inputValue={toSuggest.inputValue}
            open={
              toSuggest.isOpen &&
              Boolean(toSuggest.inputValue.trim() && (toSuggest.options.length > 0 || toSuggest.isLoading))
            }
            onOpen={() => toSuggest.setIsOpen(true)}
            onClose={() => toSuggest.setIsOpen(false)}
            onInputChange={toSuggest.handleInputChange}
            onChange={toSuggest.handleChange}
            onBlur={toSuggest.handleBlur}
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.label || option.value || ''
            }
            isOptionEqualToValue={(option, val) => {
              const optVal = typeof option === 'string' ? option : option.value || option.label;
              const targetVal = typeof val === 'string' ? val : val.value || val.label;
              return optVal === targetVal;
            }}
            noOptionsText={
              toSuggest.inputValue.trim().length < 2
                ? 'Введите не менее 2 символов'
                : 'Адрес в Екатеринбурге не найден'
            }
            loadingText="Поиск адресов в Екатеринбурге..."
            slotProps={{
              popper: {
                sx: { zIndex: 1500 },
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
                sx: { maxHeight: 280 },
              },
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                label="Куда (Точка Б)"
                placeholder="Например: Кампус Новокольцовский"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <LocationOnIcon sx={{ fontSize: 20, color: 'error.main' }} />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {toSuggest.isLoading ? (
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
                    <LocationOnIcon sx={{ fontSize: 20, color: 'error.main', flexShrink: 0 }} />
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

          <Box
            sx={{
              borderRadius: 3.5,
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
              polyline={routePolyline}
              startCoords={startCoords}
              endCoords={endCoords}
              distanceKm={routeDistance}
              durationMin={routeDuration}
              height={280}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Тип поездки
            </Typography>
            <ToggleButtonGroup
              value={rideType}
              exclusive
              disabled={hasNoVehicles}
              aria-label="Тип поездки: одноразовая или регулярная"
              onChange={(_, val) => {
                if (val) setRideType(val);
              }}
              fullWidth
              size="small"
            >
              <ToggleButton value="one_off" sx={{ textTransform: 'none', fontWeight: 500 }}>
                <CalendarTodayIcon sx={{ fontSize: 16, mr: 1 }} />
                Одноразовая
              </ToggleButton>
              <ToggleButton value="regular" sx={{ textTransform: 'none', fontWeight: 500 }}>
                <RepeatIcon sx={{ fontSize: 16, mr: 1 }} />
                Регулярная
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {rideType === 'one_off' ? (
            <TextField
              fullWidth
              label="Дата поездки"
              type="date"
              disabled={hasNoVehicles}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: getTodayDateString() },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarTodayIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          ) : (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 500 }}>
                Дни недели:
              </Typography>
              <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                {WEEK_DAYS.map((day) => {
                  const isSelected = regularDays.includes(day);
                  return (
                    <Chip
                      key={day}
                      label={day}
                      clickable={!hasNoVehicles}
                      disabled={hasNoVehicles}
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      onClick={() => handleDayToggle(day)}
                      sx={{ fontWeight: 600, minWidth: 40 }}
                    />
                  );
                })}
              </Stack>
              {regularDays.length === 0 && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  Выберите хотя бы один день недели
                </Typography>
              )}
            </Box>
          )}

          <TextField
            fullWidth
            label="Время выезда"
            type="time"
            disabled={hasNoVehicles}
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

          <TextField
            fullWidth
            label="Ваша цена за место (₽)"
            placeholder="Например, 150"
            type="number"
            disabled={hasNoVehicles}
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

          {/* Карточка рекомендуемой цены с расчетом дистанции */}
          <Paper
            component="section"
            aria-label="Расчет стоимости маршрута"
            variant="outlined"
            sx={{
              p: 2.25,
              borderRadius: 3.5,
              background: AI_ACCENT.bg,
              borderColor: AI_ACCENT.border,
              boxShadow: '0 4px 18px rgba(0, 113, 227, 0.08)',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: AI_ACCENT.iconBg,
                  color: AI_ACCENT.iconColor,
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0, 113, 227, 0.2)',
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 18 }} />
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: AI_ACCENT.text, letterSpacing: '-0.01em' }}>
                Расчет стоимости маршрута
              </Typography>
              {isRouteLoading && <CircularProgress size={16} sx={{ color: AI_ACCENT.iconColor, ml: 1 }} />}
              {isPeakDemand && (
                <Chip
                  icon={<BoltIcon sx={{ fontSize: 14 }} />}
                  label="Пиковый спрос +30%"
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 650, ml: 'auto', borderRadius: 2 }}
                />
              )}
            </Stack>

            <Typography variant="body2" sx={{ color: AI_ACCENT.subtleText, fontWeight: 500, mb: 1.5, lineHeight: 1.5 }}>
              {isRouteLoading
                ? 'Связываемся с сервисом маршрутов для точного расчета...'
                : routeDistance
                ? `✨ Рекомендация: ${formatPrice(recommendedPrice)} (дистанция ${routeDistance} км, в пути ~${routeDuration || Math.round(routeDistance * 2.2)} мин)`
                : '✨ Укажите точки отправления и назначения для расчета цены и построения маршрута'}
            </Typography>

            <Button
              fullWidth
              variant="contained"
              disabled={hasNoVehicles || isRouteLoading}
              onClick={handleApplyRecommendation}
              sx={{
                bgcolor: AI_ACCENT.button,
                py: 1,
                borderRadius: 2.5,
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(0, 113, 227, 0.25)',
                '&:hover': { bgcolor: AI_ACCENT.buttonHover },
              }}
            >
              Применить ({formatPrice(recommendedPrice)})
            </Button>
          </Paper>

          {vehicles.length > 0 && (
            <FormControl fullWidth disabled={hasNoVehicles}>
              <InputLabel id="offer-vehicle-label">Автомобиль</InputLabel>
              <Select
                labelId="offer-vehicle-label"
                value={selectedVehicleId}
                label="Автомобиль"
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <DirectionsCarIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  </InputAdornment>
                }
              >
                {vehicles.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.brand} ({v.license_plate}){v.color ? ` • ${v.color}` : ''} • {v.seats ?? 4} мест
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Панель выбора тегов поездки (Chips) */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 650, mb: 1 }}>
              Особенности поездки
            </Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              {AVAILABLE_TAGS.map((tag) => {
                const isSelected = tags.includes(tag);
                return (
                  <Chip
                    key={tag}
                    label={tag}
                    clickable={!hasNoVehicles}
                    disabled={hasNoVehicles}
                    color={isSelected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    onClick={() => handleTagToggle(tag)}
                    sx={{ fontWeight: 600, borderRadius: 2 }}
                  />
                );
              })}
            </Stack>
          </Box>

          {/* Многострочное текстовое поле "Примечания к маршруту" (description) */}
          <TextField
            fullWidth
            label="Примечания к маршруту"
            placeholder="Например: встречаемся у главного входа, багажник свободен, едем без остановок"
            multiline
            rows={3}
            disabled={hasNoVehicles}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <TextField
            fullWidth
            label="Ваш Telegram (@username)"
            placeholder="@username"
            disabled={hasNoVehicles}
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SendIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={!canSubmit || isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{
              py: 1.3,
              borderRadius: 3,
              fontSize: '1rem',
              fontWeight: 700,
              boxShadow: '0 4px 18px rgba(0, 113, 227, 0.32)',
            }}
          >
            {isSubmitting ? 'Публикация на сервере...' : 'Опубликовать поездку'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
