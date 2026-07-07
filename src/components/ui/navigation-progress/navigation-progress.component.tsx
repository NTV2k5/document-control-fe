'use client';

import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

export const NavigationProgress = () => {
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      setVisible(true);

      // Tăng dần đến ~85%, chừa chỗ cho lúc xong
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 85) return p;
          // Tăng chậm dần khi gần 85
          const step = (85 - p) * 0.08;
          return p + Math.max(step, 0.5);
        });
      }, 80);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);

      // Kéo nhanh lên 100 rồi fade out
      setProgress(100);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[2px] bg-primary transition-all duration-200 ease-out"
      style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
    />
  );
};
