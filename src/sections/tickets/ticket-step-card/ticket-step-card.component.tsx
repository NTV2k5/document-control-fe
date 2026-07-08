import type { ITicketStepCardProps } from '../ticket.type';
import { EStepStatus } from '../ticket.type';
import { useState } from 'react';
import {
  CheckCircle,
  Clock,
  Circle,
  ShieldCheck,
  CreditCard,
  FilePlus,
  GitBranch,
  Printer,
  Send,
  UserCheck,
  Phone,
  FileText,
  ClipboardCheck,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const stepIconMap: Record<string, React.ReactNode> = {
  'clipboard-check': <ClipboardCheck className="size-4" />,
  'shield-check': <ShieldCheck className="size-4" />,
  'credit-card': <CreditCard className="size-4" />,
  'file-plus': <FilePlus className="size-4" />,
  'git-branch': <GitBranch className="size-4" />,
  'printer': <Printer className="size-4" />,
  'send': <Send className="size-4" />,
  'user-check': <UserCheck className="size-4" />,
  'check-circle': <CheckCircle className="size-4" />,
  'phone': <Phone className="size-4" />,
  'file-text': <FileText className="size-4" />,
};

const statusConfig = {
  [EStepStatus.DA_XONG]: {
    dotBg: 'bg-emerald-500',
    dotBorder: 'border-emerald-200',
    lineBg: 'bg-emerald-300',
    badge: 'bg-emerald-50 text-emerald-600',
    badgeLabel: 'Đã xong',
    cardBorder: 'border-emerald-100',
    cardBg: 'bg-white',
  },
  [EStepStatus.DANG_CHO]: {
    dotBg: 'bg-amber-500',
    dotBorder: 'border-amber-200',
    lineBg: 'bg-slate-200',
    badge: 'bg-amber-50 text-amber-600',
    badgeLabel: 'Đang chờ',
    cardBorder: 'border-amber-200 ring-1 ring-amber-100',
    cardBg: 'bg-amber-50/30',
  },
  [EStepStatus.CHUA_TOI]: {
    dotBg: 'bg-slate-300',
    dotBorder: 'border-slate-200',
    lineBg: 'bg-slate-200',
    badge: 'bg-slate-100 text-slate-400',
    badgeLabel: 'Chưa tới',
    cardBorder: 'border-slate-100',
    cardBg: 'bg-slate-50/50 opacity-60',
  },
};

const formatDateTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

export const TicketStepCard = ({ step, isLast }: ITicketStepCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const config = statusConfig[step.status];

  return (
    <div className="relative flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${config.dotBorder} ${config.dotBg} text-white`}>
          {step.status === EStepStatus.DA_XONG ? (
            <CheckCircle className="size-4" />
          ) : step.status === EStepStatus.DANG_CHO ? (
            <Clock className="size-4" />
          ) : (
            <Circle className="size-4" />
          )}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 ${config.lineBg}`} />
        )}
      </div>

      {/* Card content */}
      <div className={`mb-4 flex-1 rounded-xl border p-4 ${config.cardBorder} ${config.cardBg} transition-all`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-slate-700">{stepIconMap[step.icon] || <Circle className="size-4" />}</div>
              <h4 className="text-sm font-semibold text-slate-800">{step.name}</h4>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              <span className="italic">by</span> {step.performer}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${config.badge}`}>
            {config.badgeLabel}
          </span>
        </div>

        {/* Completed timestamp */}
        {step.completedAt && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600">
            <CheckCircle className="size-3" />
            <span>Hoàn thành lúc {formatDateTime(step.completedAt)}</span>
          </div>
        )}

        {/* Description */}
        {step.description && step.status !== EStepStatus.DA_XONG && (
          <p className="mt-2 text-xs text-slate-500">{step.description}</p>
        )}

        {/* Result summary (when done) */}
        {step.resultSummary && step.status === EStepStatus.DA_XONG && (
          <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle className="mr-1 inline size-3" />
            {step.resultSummary}
          </div>
        )}

        {/* Approval levels detail */}
        {step.approvalLevels && step.approvalLevels.length > 0 && (
          <div className="mt-3 space-y-2">
            {step.approvalLevels.map((level) => (
              <div
                key={level.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${
                    level.status === 'approved' ? 'bg-emerald-500' : level.status === 'pending' ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                  <span className="text-xs font-medium text-slate-700">{level.label}</span>
                </div>
                {level.status === 'approved' ? (
                  <span className="text-[10px] text-emerald-600">Đã duyệt</span>
                ) : level.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                      Đang chờ duyệt
                    </span>
                    <button className="rounded-md bg-blue-600 px-3 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-blue-700">
                      Duyệt
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400">Chờ</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Payment info */}
        {step.paymentInfo && step.status === EStepStatus.DA_XONG && (
          <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Đã thu {step.paymentInfo.amount.toLocaleString('vi-VN')}đ qua QR ngân hàng.
          </div>
        )}

        {/* Call note */}
        {step.callNote && (
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <strong>Ghi chú:</strong> {step.callNote}
          </div>
        )}

        {/* Feedback note */}
        {step.feedbackNote && (
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <strong>Kết quả:</strong> {step.feedbackNote}
          </div>
        )}

        {/* CTA buttons for current step */}
        {step.status === EStepStatus.DANG_CHO && !step.approvalLevels && (
          <div className="mt-3">
            {step.icon === 'phone' && (
              <div className="flex gap-2">
                <button className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700">
                  Gọi qua GDU360
                </button>
                <button className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50">
                  Gọi số di động
                </button>
              </div>
            )}
            {step.icon === 'file-text' && (
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700">
                Lưu kết quả phản hồi
              </button>
            )}
            {step.icon === 'check-circle' && (
              <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700">
                Đóng ticket
              </button>
            )}
            {step.icon === 'file-plus' && (
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700">
                Tạo phiếu
              </button>
            )}
            {step.icon === 'send' && (
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700">
                Gửi email cho sinh viên
              </button>
            )}
            {step.icon === 'credit-card' && (
              <p className="text-xs text-amber-600 italic">
                Đang chờ sinh viên chuyển khoản và đính kèm minh chứng.
              </p>
            )}
            {step.icon === 'user-check' && (
              <p className="text-xs text-amber-600 italic">
                Đang chờ sinh viên xác nhận.
              </p>
            )}
          </div>
        )}

        {/* Comments toggle */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="mt-3 flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-blue-500"
        >
          <MessageSquare className="size-3" />
          <span>Trao đổi về bước này</span>
          {showComments ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>

        {showComments && (
          <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
            {step.comments.length === 0 && (
              <p className="text-[11px] text-slate-400 italic">Chưa có bình luận.</p>
            )}
            {step.comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-700">{c.author.name}</span>
                  <span className="text-[10px] text-slate-400">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
