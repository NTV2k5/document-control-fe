import { useEffect, useRef, useState } from 'react';
import { CookieService, CONFIGURATION } from 'reactjs-platform/utilities';
import { API_ENDPOINT } from 'reactjs-platform/utilities';

export type SseStatus = 'connecting' | 'open' | 'closed';

interface UseSseOptions<T> {
  onMessage: (data: T) => void;
  onError?: (event: Event) => void;
}

const getToken = (): string => {
  return CookieService.getItem<string>(CONFIGURATION.ACCESS_TOKEN_LS_KEY) || '';
};

export const buildSseUrl = (path: string): string => {
  const token = getToken();
  const base = API_ENDPOINT.replace(/\/$/, '');
  const sep = path.includes('?') ? '&' : '?';
  return `${base}${path}${sep}token=${encodeURIComponent(token)}`;
};

export const useSSE = <T>(url: string | null, options: UseSseOptions<T>): SseStatus => {
  const [status, setStatus] = useState<SseStatus>('closed');
  const onMessageRef = useRef(options.onMessage);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    onMessageRef.current = options.onMessage;
    onErrorRef.current = options.onError;
  });

  useEffect(() => {
    if (!url) {
      setStatus('closed');
      return;
    }

    setStatus('connecting');
    const es = new EventSource(url);

    es.onopen = () => setStatus('open');

    es.onmessage = (event: MessageEvent) => {
      try {
        const data: T = JSON.parse(event.data as string);
        onMessageRef.current(data);
      } catch {
        // keep-alive ping or non-JSON frame — ignore
      }
    };

    es.onerror = (event) => {
      setStatus('closed');
      onErrorRef.current?.(event);
    };

    return () => {
      es.close();
      setStatus('closed');
    };
  }, [url]);

  return status;
};
