import type { LucideIcon } from 'lucide-react';

export type TApprovalUiStatus =
  | 'Draft'
  | 'Submitted'
  | 'Approval'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Active'
  | 'Pending'
  | 'Published'
  | 'Unpublished';

export interface IApprovalStatusBadgeProps {
  status: string;
  approvalLevel?: number;
  totalLevels?: number;
  rejection_reason?: string;
}

export interface IApprovalStatusPanelProps {
  status: string;
  approvalLevel?: number;
  totalLevels?: number;
  submitted_at?: number | string | null;
  approved_at?: number | string | null;
  rejected_at?: number | string | null;
  rejection_reason?: string | null;
}

export interface IApprovalStatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;
  detail?: (approvalLevel: number, totalLevels: number) => string | null;
}
