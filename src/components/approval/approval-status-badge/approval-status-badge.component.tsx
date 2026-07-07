import { AlertCircle, CheckCircle2, Clock3, FileEdit, ShieldAlert, Slash } from 'lucide-react';

import { Badge } from 'reactjs-platform/ui';
import type {
  IApprovalStatusBadgeProps,
  IApprovalStatusConfig,
  IApprovalStatusPanelProps,
  TApprovalUiStatus,
} from './approval-status-badge.type';

const STATUS_CONFIG: Record<TApprovalUiStatus, IApprovalStatusConfig> = {
  Draft: {
    label: 'Bản nháp',
    icon: FileEdit,
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  Submitted: {
    label: 'Đã gửi duyệt',
    icon: Clock3,
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  Approval: {
    label: 'Đang duyệt',
    icon: ShieldAlert,
    className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    detail: (approvalLevel, totalLevels) => (totalLevels > 0 ? `Cấp ${approvalLevel || 1}/${totalLevels}` : null),
  },
  Approved: {
    label: 'Đã duyệt',
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  Rejected: {
    label: 'Bị từ chối',
    icon: AlertCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  Cancelled: {
    label: 'Đã huỷ',
    icon: Slash,
    className: 'border-slate-200 bg-slate-100 text-slate-600',
  },
  Active: {
    label: 'Đang hoạt động',
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  Pending: {
    label: 'Đang chờ',
    icon: Clock3,
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  Published: {
    label: 'Đã ban hành',
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  Unpublished: {
    label: 'Chưa ban hành',
    icon: Slash,
    className: 'border-slate-200 bg-slate-100 text-slate-600',
  },
};

const getStatusConfig = (status: string, approvalLevel: number, totalLevels: number) => {
  const normalized = (status?.trim() || 'Draft') as TApprovalUiStatus;
  const fallback = STATUS_CONFIG.Draft;
  const config = STATUS_CONFIG[normalized] ?? fallback;
  const detail = config.detail?.(approvalLevel, totalLevels);

  return {
    ...config,
    detail,
  };
};

const formatDate = (value?: number | string | null) => {
  if (!value) return '-';

  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('vi-VN');
};

export const ApprovalStatusBadge = ({
  status,
  approvalLevel = 0,
  totalLevels = 0,
  rejection_reason,
}: IApprovalStatusBadgeProps) => {
  const config = getStatusConfig(status, approvalLevel, totalLevels);
  const Icon = config.icon;

  return (
    <div className="group relative inline-flex">
      <Badge
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}>
        <Icon className="size-3.5" />
        <span>{config.label}</span>
        {config.detail && <span className="hidden sm:inline">• {config.detail}</span>}
      </Badge>

      {rejection_reason?.trim() && (
        <div className="pointer-events-none absolute left-1/2 top-full z-30 hidden w-64 -translate-x-1/2 pt-2 group-hover:block">
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-left text-xs text-slate-600 shadow-lg">
            <div className="mb-1 font-semibold text-slate-900">Lý do từ chối</div>
            <div className="leading-5">{rejection_reason}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ApprovalStatusPanel = ({
  status,
  approvalLevel = 0,
  totalLevels = 0,
  submitted_at,
  approved_at,
  rejected_at,
  rejection_reason,
}: IApprovalStatusPanelProps) => {
  const isApproval = status === 'Approval' && totalLevels > 0;
  const progressPercentage = isApproval ? Math.min(100, (approvalLevel / totalLevels) * 100) : 0;

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Trạng thái phê duyệt</p>
          <p className="mt-1 text-xs text-slate-500">Trạng thái hiện tại trong luồng xử lý.</p>
        </div>
        <ApprovalStatusBadge
          status={status}
          approvalLevel={approvalLevel}
          totalLevels={totalLevels}
          rejection_reason={rejection_reason ?? undefined}
        />
      </div>

      {isApproval && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Tiến độ duyệt</span>
            <span>
              {approvalLevel}/{totalLevels}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2 text-xs text-slate-500">
        {submitted_at && (
          <div className="flex items-center justify-between gap-3">
            <span>Đã gửi duyệt</span>
            <span className="text-slate-700">{formatDate(submitted_at)}</span>
          </div>
        )}
        {approved_at && (
          <div className="flex items-center justify-between gap-3">
            <span>Đã duyệt</span>
            <span className="text-slate-700">{formatDate(approved_at)}</span>
          </div>
        )}
        {rejected_at && (
          <div className="flex items-center justify-between gap-3">
            <span>Bị từ chối</span>
            <span className="text-slate-700">{formatDate(rejected_at)}</span>
          </div>
        )}
        {rejection_reason?.trim() && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-rose-700">
            <div className="mb-1 font-semibold">Lý do từ chối</div>
            <div>{rejection_reason}</div>
          </div>
        )}
      </div>
    </div>
  );
};
