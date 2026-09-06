import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

/**
 * Опция адреса для списка MUI Autocomplete
 */
export interface AddressOption {
  label: string;
  value: string;
  subtitle?: string;
}

interface SuggestApiResponseItem {
  title?: string | { text?: string };
  subtitle?: string | { text?: string };
  full_address?: string;
  address?: string;
  value?: string;
  displayName?: string;
}

interface SuggestApiResponse {
  suggestions?: SuggestApiResponseItem[];
  results?: SuggestApiResponseItem[];
}

/**
 * Жесткие границы Екатеринбурга для Yandex Maps API 2.1: [[lat1, lon1], [lat2, lon2]]
 */
export const EKATERINBURG_BOUNDS_21: [[number, number], [number, number]] = [
  [56.60, 60.20],
  [57.05, 61.05],
];

/**
 * BBox Екатеринбурга для HTTP API /api/suggest
 */
export const EKATERINBURG_BBOX_STRING = '60.20,56.60~61.05,57.05';

/**
 * Ожидание готовности Yandex Maps API 2.1 в объекте window
 */
function getReadyYmaps(): Promise<Window['ymaps'] | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  const ym = window.ymaps;
  if (!ym) {
    return Promise.resolve(null);
  }
  if (typeof ym.suggest === 'function') {
    return Promise.resolve(ym);
  }
  if (typeof ym.ready === 'function') {
    return new Promise((resolve) => {
      ym.ready(() => {
        resolve(window.ymaps ?? null);
      });
    });
  }
  return Promise.resolve(ym);
}

/**
 * Извлечение текстового поля из строки или объекта ответа Yandex
 */
function extractTextField(field: unknown): string {
  if (typeof field === 'string') {
    return field.trim();
  }
  if (field && typeof field === 'object' && 'text' in field) {
    const textVal = (field as { text?: unknown }).text;
    if (typeof textVal === 'string') {
      return textVal.trim();
    }
  }
  return '';
}

/**
 * Преобразование элемента ответа Yandex Suggest в структуру AddressOption
 */
export function parseSuggestItem(item: unknown): AddressOption | null {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    return trimmed ? { label: trimmed, value: trimmed } : null;
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const obj = item as Record<string, unknown>;
  const value = typeof obj.value === 'string' ? obj.value.trim() : '';
  const displayName = typeof obj.displayName === 'string' ? obj.displayName.trim() : '';
  const fullAddress = typeof obj.full_address === 'string' ? obj.full_address.trim() : '';
  const address = typeof obj.address === 'string' ? obj.address.trim() : '';
  const title = extractTextField(obj.title);
  const subtitle = extractTextField(obj.subtitle);

  const resolvedValue = value || fullAddress || address || displayName || title;
  const resolvedLabel = displayName || title || fullAddress || address || value;

  if (!resolvedValue) {
    return null;
  }

  return {
    label: resolvedLabel,
    value: resolvedValue,
    subtitle: subtitle || undefined,
  };
}

/**
 * Запрос подсказок адресов через window.ymaps.suggest (API 2.1) или бэкенд /api/suggest
 */
export async function fetchAddressSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<AddressOption[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  // 1. Поиск через клиентский API 2.1 Яндекс Карт с жесткими границами Екатеринбурга
  const ymaps2 = await getReadyYmaps();
  if (ymaps2 && typeof ymaps2.suggest === 'function') {
    try {
      const results = await ymaps2.suggest(trimmed, {
        results: 7,
        boundedBy: EKATERINBURG_BOUNDS_21,
        strictBounds: true,
      });
      if (Array.isArray(results) && results.length > 0) {
        const parsedList: AddressOption[] = [];
        for (const item of results) {
          const parsed = parseSuggestItem(item);
          if (parsed && !parsedList.some((opt) => opt.value === parsed.value)) {
            parsedList.push(parsed);
          }
        }
        if (parsedList.length > 0) {
          return parsedList;
        }
      }
    } catch (err: unknown) {
      console.warn('Предупреждение: ошибка вызова window.ymaps.suggest:', err);
    }
  }

  // 2. Резервный запрос к бэкенду /api/suggest с явным boundedBy для Екатеринбурга
  try {
    const url = `/api/suggest?text=${encodeURIComponent(trimmed)}&boundedBy=${encodeURIComponent(EKATERINBURG_BBOX_STRING)}`;
    const res = await api.get<SuggestApiResponse | SuggestApiResponseItem[]>(url, { signal });
    if (res) {
      const list = Array.isArray(res) ? res : (res.suggestions || res.results || []);
      const parsedList: AddressOption[] = [];
      for (const item of list) {
        const parsed = parseSuggestItem(item);
        if (parsed && !parsedList.some((opt) => opt.value === parsed.value)) {
          parsedList.push(parsed);
        }
      }
      return parsedList;
    }
  } catch {
    // Возвращаем пустой массив при сетевых сбоях или отмене запроса
  }

  return [];
}

export interface UseAddressSuggestReturn {
  value: string;
  setValue: (val: string) => void;
  inputValue: string;
  setInputValue: (val: string) => void;
  options: AddressOption[];
  setOptions: (opts: AddressOption[]) => void;
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  handleInputChange: (_event: unknown, newInputValue: string, reason: string) => void;
  handleChange: (_event: unknown, newValue: string | AddressOption | null) => void;
  handleBlur: () => void;
  clear: () => void;
}

/**
 * Кастомный хук для управления полем ввода адреса с автодополнением
 * @param initialValue - Начальное значение адреса
 */
export function useAddressSuggest(initialValue = ''): UseAddressSuggestReturn {
  const [value, setValue] = useState<string>(initialValue);
  const [inputValue, setInputValue] = useState<string>(initialValue);
  const [options, setOptions] = useState<AddressOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const valueRef = useRef<string>(value);
  valueRef.current = value;

  useEffect(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length < 2) {
      setOptions([]);
      setIsLoading(false);
      return;
    }

    if (trimmed === valueRef.current.trim() && valueRef.current.trim().length > 0) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await fetchAddressSuggestions(trimmed, controller.signal);
        if (isMounted) {
          setOptions(results);
          if (results.length > 0) {
            setIsOpen(true);
          }
        }
      } catch {
        if (isMounted) {
          setOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }, 280);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputValue]);

  const handleInputChange = useCallback(
    (_event: unknown, newInputValue: string, reason: string): void => {
      if (reason === 'input') {
        setInputValue(newInputValue);
        setIsOpen(true);
        return;
      }
      if (reason === 'clear') {
        setInputValue('');
        setValue('');
        setOptions([]);
        setIsOpen(false);
        return;
      }
      if (reason === 'reset') {
        setInputValue(newInputValue);
      }
    },
    [],
  );

  const handleChange = useCallback(
    (_event: unknown, newValue: string | AddressOption | null): void => {
      if (!newValue) {
        setValue('');
        setInputValue('');
        setOptions([]);
        setIsOpen(false);
        return;
      }
      const resolved = typeof newValue === 'string' ? newValue.trim() : newValue.value.trim();
      const label = typeof newValue === 'string' ? newValue.trim() : (newValue.label || newValue.value).trim();
      setValue(resolved);
      setInputValue(label);
      setIsOpen(false);
    },
    [],
  );

  const handleBlur = useCallback((): void => {
    setIsOpen(false);
    const trimmed = inputValue.trim();
    if (trimmed !== value) {
      setValue(trimmed);
    }
  }, [inputValue, value]);

  const clear = useCallback((): void => {
    setValue('');
    setInputValue('');
    setOptions([]);
    setIsOpen(false);
    setIsLoading(false);
  }, []);

  return {
    value,
    setValue,
    inputValue,
    setInputValue,
    options,
    setOptions,
    isLoading,
    isOpen,
    setIsOpen,
    handleInputChange,
    handleChange,
    handleBlur,
    clear,
  };
}
