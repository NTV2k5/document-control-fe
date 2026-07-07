'use client';

import { useEffect, useState } from 'react';

export const useSearchDebounce = (value: string, delay: number, minLength = 3): string => {
  const [debouncedValue, setDebouncedValue] = useState<string>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (value.length < minLength) {
        setDebouncedValue('');
      } else {
        setDebouncedValue(value);
      }
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay, minLength]);

  return debouncedValue;
};
