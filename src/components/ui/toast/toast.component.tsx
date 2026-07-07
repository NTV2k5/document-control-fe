'use client';

import { useEffect } from 'react';
import type { IToastProps } from './toast.type';

/**
 * Toast
 */
export const Toast = ({ message, type, onClose = () => {} }: IToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast-notification toast-${type}`}>
      <span>
        {type === 'success' && '✓'}
        {type === 'error' && '✕'}
        {type === 'info' && 'ℹ'}
      </span>
      <span>{message}</span>
    </div>
  );
};
