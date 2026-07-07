export interface IToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose?: () => void;
}

export type ToastProps = IToastProps;
