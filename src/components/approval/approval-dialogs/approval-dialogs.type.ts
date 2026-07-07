import type { ReactNode } from 'react';

export interface IRejectionDialogProps {
  isOpen: boolean;
  templateName?: string;
  template_id: string;
  approverId: string;
  onClose: () => void;
  onReject: (template_id: string, approverId: string, reason: string) => Promise<void>;
}

export interface ICancelApprovalDialogProps {
  isOpen: boolean;
  templateName?: string;
  template_id: string;
  currentVersion?: number;
  onClose: () => void;
  onCancel: (template_id: string, reason: string) => Promise<string>;
}

export interface IReasonDialogShellProps {
  open: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  error: string | null;
  isSubmitting: boolean;
  isSuccess: boolean;
  successTitle: string;
  successDescription: ReactNode;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  confirmLabel: string;
  confirmVariant: 'destructive' | 'default';
}
