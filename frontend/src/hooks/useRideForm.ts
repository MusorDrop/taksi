import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useApp } from '../AppContext';
import { api } from '../api';
import type { Vehicle, VehiclesResponse } from '../types';
import { formatDateString } from '../utils';
import { useAddressSuggest, type UseAddressSuggestReturn } from './useAddressSuggest';
import { useRoutePreview } from './useRoutePreview';

export const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const AVAILABLE_TAGS = [
  'Можно с багажом',
  'Пустой багажник',
  'Люблю поболтать',
  'Еду молча',
  'С музыкой',
  'Тишина',
  'Аккуратно вожу',
  'Чистый салон',
  'Не курить',
  'Можно с животными',
  'Можно с кофе/едой',
  'Без остановок',
] as const;

export type RideTag = (typeof AVAILABLE_TAGS)[number];

export const AI_ACCENT = {
  bg: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
  border: 'rgba(99, 102, 241, 0.22)',
  iconBg: 'rgba(99, 102, 241, 0.12)',
  iconColor: '#6366f1',
  text: '#4338ca',
  subtleText: '#6d28d9',
  button: '#6366f1',
  buttonHover: '#4f46e5',
};

/**
 * Получение текущей даты в формате YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Получение времени выезда по умолчанию (+1 час от текущего) в формате HH:mm
 */
export function getDefaultTimeString(): string {
  const target = new Date(Date.now() + 60 * 60 * 1000);
  const hours = String(target.getHours()).padStart(2, '0');
  const minutes = String(target.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Получение даты выезда по умолчанию в формате YYYY-MM-DD (+1 час от текущего)
 */
export function getDefaultDateString(): string {
  const target = new Date(Date.now() + 60 * 60 * 1000);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


export interface UseRideFormReturn {
  fromSuggest: UseAddressSuggestReturn;
  toSuggest: UseAddressSuggestReturn;
  rideType: 'one_off' | 'regular';
  setRideType: (type: 'one_off' | 'regular') => void;
  regularDays: string[];
  handleDayToggle: (day: string) => void;
  date: string;
  setDate: (date: string) => void;
  time: string;
  setTime: (time: string) => void;
  telegram: string;
  setTelegram: (tg: string) => void;
  price: string;
  setPrice: (price: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  tags: string[];
  setTags: (tags: string[]) => void;
  handleTagToggle: (tag: string) => void;
  vehicles: Vehicle[];
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  isVehiclesLoading: boolean;
  hasNoVehicles: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  setSubmitError: (err: string | null) => void;
  success: boolean;
  canSubmit: boolean;
  routePolyline: [number, number][] | null;
  routeDistance: number | null;
  routeDuration: number | null;
  startCoords: [number, number] | null;
  endCoords: [number, number] | null;
  recommendedPrice: number;
  isPeakDemand: boolean;
  isRouteLoading: boolean;
  handleApplyRecommendation: () => void;
  handleSubmit: (e: FormEvent) => Promise<void>;
}

/**
 * Кастомный хук формы создания поездки (управление состоянием, API запросами и валидацией)
 */
export function useRideForm(): UseRideFormReturn {
  const { addRide, user } = useApp();

  const fromSuggest = useAddressSuggest();
  const toSuggest = useAddressSuggest();

  const [rideType, setRideType] = useState<'one_off' | 'regular'>('one_off');
  const [regularDays, setRegularDays] = useState<string[]>(['Пн', 'Вт', 'Ср', 'Чт', 'Пт']);
  const [date, setDate] = useState<string>(getDefaultDateString);
  const [time, setTime] = useState<string>(getDefaultTimeString);
  const [telegram, setTelegram] = useState(user?.telegram ?? '');
  const [price, setPrice] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [isVehiclesLoading, setIsVehiclesLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    routePolyline,
    routeDistance,
    routeDuration,
    startCoords,
    endCoords,
    recommendedPrice,
    isPeakDemand,
    isRouteLoading,
    clear: clearRoute,
  } = useRoutePreview(fromSuggest.value, toSuggest.value, time);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  // Загрузка доступных автомобилей пользователя
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadVehicles(): Promise<void> {
      try {
        const res = await api.get<VehiclesResponse>('/api/vehicles', {
          signal: controller.signal,
        });
        if (isMounted && res?.vehicles) {
          setVehicles(res.vehicles);
          if (res.vehicles.length > 0) {
            setSelectedVehicleId(res.vehicles[0].id);
          }
        }
      } catch {
        // При ошибке форма продолжает работать без выбора авто
      } finally {
        if (isMounted) {
          setIsVehiclesLoading(false);
        }
      }
    }

    loadVehicles();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const hasNoVehicles = !isVehiclesLoading && vehicles.length === 0;


  const parsedPrice = price.trim() === '' ? null : Number(price);
  const isPriceValid = parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice > 0;
  const isDateOrDaysValid = rideType === 'one_off' ? Boolean(date) : regularDays.length > 0;
  const canSubmit = Boolean(
    !hasNoVehicles &&
      fromSuggest.value.trim() &&
      toSuggest.value.trim() &&
      telegram.trim() &&
      isPriceValid &&
      isDateOrDaysValid &&
      time,
  );

  const handleApplyRecommendation = useCallback((): void => {
    setPrice(String(recommendedPrice));
  }, [recommendedPrice]);

  const handleDayToggle = useCallback((day: string): void => {
    setRegularDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }, []);

  const handleTagToggle = useCallback((tag: string): void => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit || parsedPrice === null || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const departureDate = new Date(`${date}T${time}`);
      const departureIso = !isNaN(departureDate.getTime())
        ? departureDate.toISOString()
        : new Date().toISOString();

      const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
      const totalSeats = selectedVehicle?.seats || 4;

      await addRide({
        from: fromSuggest.value,
        to: toSuggest.value,
        dateFormatted: rideType === 'regular' ? regularDays.join(', ') : formatDateString(departureIso),
        dateString: rideType === 'regular' ? regularDays.join(', ') : formatDateString(departureIso),
        departure_time: departureIso,
        departureTime: departureIso,
        time,
        telegram: telegram.replace('@', ''),
        price: parsedPrice,
        distanceKm: routeDistance ?? 5.0,
        isPeak: isPeakDemand,
        vehicleId: selectedVehicleId || undefined,
        totalSeats,
        rideType,
        ride_type: rideType,
        regularDays: rideType === 'regular' ? regularDays.join(', ') : null,
        regular_days: rideType === 'regular' ? regularDays.join(', ') : null,
        description: description.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      setSuccess(true);
      fromSuggest.clear();
      toSuggest.clear();
      setDate(getDefaultDateString());
      setTime(getDefaultTimeString());
      setPrice('');
      setDescription('');
      setTags([]);
      clearRoute();

      successTimerRef.current = setTimeout(() => {
        setSuccess(false);
        successTimerRef.current = null;
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось опубликовать поездку на сервере';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
    setTags,
    handleTagToggle,
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    isVehiclesLoading,
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
  };
}
