import type { ITicketDetailModalProps } from '../ticket.type';
import { ETicketType, ETicketStatus, EPaymentStatus, EProcessingForm } from '../ticket.type';
import { TicketStepCard } from '../ticket-step-card';
import {
  X,
  FileText,
  Paperclip,
  CreditCard,
  Calendar,
  Clock,
  Settings,
} from 'lucide-react';

const avatarColor = (name: string) => {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500',
    'bg-orange-500', 'bg-teal-500', 'bg-rose-500', 'bg-cyan-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const initials = (name: string) => {
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const statusLabel = (s: ETicketStatus) => {
  const map: Record<ETicketStatus, string> = {
    [ETicketStatus.MOI]: 'Mới',
    [ETicketStatus.DANG_XU_LY]: 'Đang xử lý',
    [ETicketStatus.CHO_SINH_VIEN]: 'Chờ sinh viên',
    [ETicketStatus.DA_HOAN_TAT]: 'Đã hoàn tất',
  };
  return map[s];
};

const statusBadge = (s: ETicketStatus) => {
  const map: Record<ETicketStatus, string> = {
    [ETicketStatus.MOI]: 'bg-slate-100 text-slate-600',
    [ETicketStatus.DANG_XU_LY]: 'bg-orange-50 text-orange-600 border border-orange-200',
    [ETicketStatus.CHO_SINH_VIEN]: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    [ETicketStatus.DA_HOAN_TAT]: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  };
  return map[s];
};

const typeLabel = (t: ETicketType) =>
  t === ETicketType.CUNG_CAP_THONG_TIN ? 'Cung cấp thông tin' : 'Dịch vụ hành chính';

const typeBadge = (t: ETicketType) =>
  t === ETicketType.CUNG_CAP_THONG_TIN
    ? 'bg-blue-50 text-blue-700 border border-blue-200'
    : 'bg-indigo-50 text-indigo-700 border border-indigo-200';

const formLabel = (f: EProcessingForm) => {
  const map: Record<EProcessingForm, string> = {
    [EProcessingForm.ONLINE_KY_SO]: 'Online ký số',
    [EProcessingForm.ONLINE_BAN_SCAN]: 'Online bản scan',
    [EProcessingForm.OFFLINE_KY_TAY]: 'Offline ký tay',
    [EProcessingForm.GOI_DIEN_KHAC]: 'Gọi điện / Khác',
  };
  return map[f];
};

const paymentLabel = (p: EPaymentStatus) => {
  const map: Record<EPaymentStatus, string> = {
    [EPaymentStatus.CHUA_THANH_TOAN]: 'Chưa thanh toán',
    [EPaymentStatus.DA_THANH_TOAN]: 'Đã thanh toán',
    [EPaymentStatus.KHONG_THU_PHI]: 'Không thu phí',
  };
  return map[p];
};

const paymentBadge = (p: EPaymentStatus) => {
  const map: Record<EPaymentStatus, string> = {
    [EPaymentStatus.CHUA_THANH_TOAN]: 'bg-red-50 text-red-600',
    [EPaymentStatus.DA_THANH_TOAN]: 'bg-emerald-50 text-emerald-600',
    [EPaymentStatus.KHONG_THU_PHI]: 'bg-slate-50 text-slate-500',
  };
  return map[p];
};

const formatDate = (d: string) => {
  const date = new Date(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

export const TicketDetailModal = ({ ticket, open, onClose }: ITicketDetailModalProps) => {
  if (!open || !ticket) return null;

  const showPaymentBanner =
    ticket.type === ETicketType.DICH_VU_HANH_CHINH &&
    ticket.hasFee &&
    ticket.paymentStatus === EPaymentStatus.CHUA_THANH_TOAN &&
    ticket.status === ETicketStatus.MOI;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="mt-0 sm:mt-8 flex h-full sm:h-[calc(100vh-64px)] w-full max-w-6xl flex-col overflow-hidden sm:rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-blue-600">#{ticket.code}</span>
            <span className="text-slate-300">—</span>
            <span className="text-lg font-semibold text-slate-800">{ticket.title}</span>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body (2 columns) */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
          {/* Left Column — Ticket Info */}
          <div className="w-full md:w-[380px] shrink-0 md:overflow-y-auto border-b md:border-b-0 md:border-r border-slate-100 p-6">
            {/* Tabs */}
            <div className="mb-4 flex gap-2">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                <FileText className="size-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Thông tin ticket</span>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${typeBadge(ticket.type)}`}>
                {typeLabel(ticket.type)}
              </span>
            </div>

            {/* Payment banner */}
            {showPaymentBanner && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">
                    Cần thanh toán {ticket.feeAmount?.toLocaleString('vi-VN')}đ để bắt đầu xử lý
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-amber-600">
                  Quét mã QR hoặc chuyển khoản để hoàn tất thanh toán.
                </p>
              </div>
            )}

            {/* Section: Tổng quan */}
            <div className="mb-5">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <FileText className="size-3.5" />
                Tổng quan
              </h3>
              <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Trạng thái</div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge(ticket.status)}`}>
                    ● {statusLabel(ticket.status)}
                  </span>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tiêu đề</div>
                  <p className="text-sm font-medium text-slate-800">{ticket.title}</p>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Nội dung</div>
                  <p className="text-xs leading-relaxed text-slate-600">{ticket.content}</p>
                </div>
              </div>
            </div>

            {/* Section: Phân công xử lý */}
            <div className="mb-5">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Settings className="size-3.5" />
                Phân công xử lý
              </h3>
              <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                {/* Người phụ trách */}
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Người phụ trách</div>
                  <div className="flex items-center gap-2">
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(ticket.assignee.name)}`}>
                      {initials(ticket.assignee.name)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-800">{ticket.assignee.name}</div>
                      <div className="text-[10px] text-slate-400">{ticket.assignee.role}</div>
                    </div>
                  </div>
                </div>

                {/* Người hỗ trợ */}
                {ticket.supporters.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Người hỗ trợ</div>
                    <div className="space-y-2">
                      {ticket.supporters.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(s.name)}`}>
                            {initials(s.name)}
                          </div>
                          <div>
                            <div className="text-xs text-slate-700">{s.name}</div>
                            <div className="text-[10px] text-slate-400">{s.department}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Người nhận thông báo */}
                {ticket.notifyRecipients.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Người nhận thông báo</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ticket.notifyRecipients.map((n) => (
                        <div key={n.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                          <div className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white ${avatarColor(n.name)}`}>
                            {initials(n.name)}
                          </div>
                          <span className="text-[10px] text-slate-600">{n.name}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400 italic">
                      Nhận email/thông báo khi ticket có cập nhật
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Section: Hồ sơ & sinh viên */}
            <div className="mb-5">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Paperclip className="size-3.5" />
                Hồ sơ & sinh viên
              </h3>
              <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sinh viên</div>
                  <div className="flex items-center gap-2">
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(ticket.student.name)}`}>
                      {initials(ticket.student.name)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-800">{ticket.student.name}</div>
                      <div className="text-[10px] text-slate-400">{ticket.student.mssv}</div>
                    </div>
                  </div>
                </div>

                {ticket.attachments.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tệp đính kèm</div>
                    {ticket.attachments.map((f) => (
                      <div key={f} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                        <Paperclip className="size-3.5 text-slate-400" />
                        <span className="text-xs text-blue-600">{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                {ticket.hasFee && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Thanh toán</div>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${paymentBadge(ticket.paymentStatus)}`}>
                      {paymentLabel(ticket.paymentStatus)}
                      {ticket.feeAmount ? ` · ${ticket.feeAmount.toLocaleString('vi-VN')}đ` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Section: Thời gian & hình thức */}
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Clock className="size-3.5" />
                Thời gian & hình thức
              </h3>
              <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="size-3" />
                    Ngày yêu cầu
                  </span>
                  <span className="text-xs font-medium text-slate-700">{formatDate(ticket.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="size-3" />
                    Deadline
                  </span>
                  <span className="text-xs font-medium text-slate-700">{formatDate(ticket.deadline)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Settings className="size-3" />
                    Hình thức
                  </span>
                  <span className="text-xs font-medium text-slate-700">{formLabel(ticket.processingForm)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column — Action Flow */}
          <div className="flex-1 md:overflow-y-auto p-6">
            <h3 className="mb-4 text-sm font-bold text-slate-800">
              Luồng xử lý ticket
            </h3>
            <div className="pl-1">
              {ticket.steps.map((step, idx) => (
                <TicketStepCard
                  key={step.id}
                  step={step}
                  isLast={idx === ticket.steps.length - 1}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end border-t border-slate-100 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
