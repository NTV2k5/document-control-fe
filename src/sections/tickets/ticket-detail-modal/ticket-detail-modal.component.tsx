import { useState, useEffect } from 'react';
import type { ITicketDetailModalProps, ITicketStep } from '../ticket.type';
import { ETicketType, ETicketStatus, EPaymentStatus, EProcessingForm, EStepStatus } from '../ticket.type';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { TicketStepCard } from '../ticket-step-card';
import { X, FileText, Paperclip, CreditCard, Calendar, Clock, Settings } from 'lucide-react';

const avatarColor = (name: string) => {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-rose-500',
    'bg-cyan-500',
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

export const MockQRCode = ({ size = 120, value = 'GDU Document Control' }: { size?: number; value?: string }) => (
  <div
    className="flex flex-col items-center justify-center gap-1.5 bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm shrink-0"
    style={{ width: size + 20, height: size + 38 }}>
    <QRCode
      value={value}
      size={size}
      level="H"
      includeMargin={false}
      imageSettings={{
        src: '/gdu/logo/logo-icon.png',
        x: undefined,
        y: undefined,
        height: Math.max(16, Math.floor(size * 0.18)),
        width: Math.max(16, Math.floor(size * 0.18)),
        excavate: true,
      }}
    />
    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">VietQR</span>
  </div>
);

export const TicketDetailModal = ({ ticket, open, onClose }: ITicketDetailModalProps) => {
  const [viewRole, setViewRole] = useState<'staff' | 'student'>('staff');
  const [steps, setSteps] = useState<ITicketStep[]>([]);
  const [paymentBannerOpen, setPaymentBannerOpen] = useState(true);
  const [zoomedQR, setZoomedQR] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<typeof ticket>(null);

  useEffect(() => {
    if (ticket) {
      setCurrentTicket(ticket);
      setSteps(ticket.steps);
      setPaymentBannerOpen(true);
      setZoomedQR(false);
    }
  }, [ticket]);

  if (!open || !ticket || !currentTicket) return null;

  const showPaymentBanner =
    paymentBannerOpen &&
    currentTicket.type === ETicketType.DICH_VU_HANH_CHINH &&
    currentTicket.hasFee &&
    currentTicket.paymentStatus === EPaymentStatus.CHUA_THANH_TOAN &&
    currentTicket.status === ETicketStatus.MOI;

  const handleStepUpdate = (stepId: string, updatedFields: Partial<ITicketStep>) => {
    setSteps((prev) => {
      const newSteps = prev.map((s) => (s.id === stepId ? { ...s, ...updatedFields } : s));
      // Check if this step is the payment step and is now marked as done
      const updatedStep = newSteps.find((s) => s.id === stepId);
      if (updatedStep && updatedStep.icon === 'credit-card' && updatedStep.status === EStepStatus.DA_XONG) {
        // Update the ticket's payment status
        setCurrentTicket((prevTicket) => {
          if (!prevTicket) return prevTicket;
          return {
            ...prevTicket,
            paymentStatus: EPaymentStatus.DA_THANH_TOAN,
          };
        });
      }
      return newSteps;
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="mt-0 sm:mt-8 flex h-full sm:h-[calc(100vh-64px)] w-full max-w-6xl flex-col overflow-hidden sm:rounded-2xl bg-white shadow-2xl relative">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-blue-600">#{currentTicket.code}</span>
            <span className="text-slate-300">—</span>
            <span className="text-lg font-semibold text-slate-800">{currentTicket.title}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Role switch simulation */}
            <div className="flex items-center gap-1.5 rounded-full bg-slate-100 p-1">
              <button
                onClick={() => setViewRole('staff')}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                  viewRole === 'staff' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}>
                Cán bộ
              </button>
              <button
                onClick={() => setViewRole('student')}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                  viewRole === 'student' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}>
                Sinh viên
              </button>
            </div>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <X className="size-5" />
            </button>
          </div>
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
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${typeBadge(currentTicket.type)}`}>
                {typeLabel(currentTicket.type)}
              </span>
            </div>

            {/* Payment banner */}
            {showPaymentBanner && (
              <div className="mb-4 relative rounded-xl border border-amber-200 bg-amber-50 p-4">
                <button
                  onClick={() => setPaymentBannerOpen(false)}
                  className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full text-amber-500 hover:bg-amber-100 hover:text-amber-700">
                  <X className="size-3" />
                </button>
                <div className="flex items-center gap-2 pr-6">
                  <CreditCard className="size-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">
                    Cần thanh toán {currentTicket.feeAmount?.toLocaleString('vi-VN')}đ để bắt đầu xử lý
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-amber-600 pr-6">
                  Quét mã QR hoặc chuyển khoản để hoàn tất thanh toán.
                </p>

                {/* Transfer Info */}
                <div className="mt-3 space-y-1 rounded-lg border border-amber-100 bg-white p-2.5 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ngân hàng</span>
                    <span className="font-semibold text-slate-700">Vietcombank</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Số tài khoản</span>
                    <span className="font-semibold text-slate-700">1234567890</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chủ tài khoản</span>
                    <span className="font-semibold text-slate-700">Trường ĐH Gia Định</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Số tiền</span>
                    <span className="font-semibold text-slate-700">
                      {currentTicket.feeAmount?.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nội dung</span>
                    <span className="font-semibold text-blue-600">
                      {currentTicket.code} {currentTicket.student.mssv}
                    </span>
                  </div>
                </div>

                {/* QR Display with Lightbox click trigger */}
                <div className="mt-3 flex justify-center">
                  <div
                    onClick={() => setZoomedQR(true)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm transition-all hover:shadow-md">
                    <MockQRCode size={110} />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="rounded bg-white/95 px-2 py-1 text-[9px] font-bold text-slate-700">
                        Phóng to
                      </span>
                    </div>
                  </div>
                </div>
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
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Trạng thái
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge(currentTicket.status)}`}>
                    ● {statusLabel(currentTicket.status)}
                  </span>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tiêu đề</div>
                  <p className="text-sm font-medium text-slate-800">{currentTicket.title}</p>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Nội dung</div>
                  <p className="text-xs leading-relaxed text-slate-600">{currentTicket.content}</p>
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
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Người phụ trách
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(currentTicket.assignee.name)}`}>
                      {initials(currentTicket.assignee.name)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-800">{currentTicket.assignee.name}</div>
                      <div className="text-[10px] text-slate-400">{currentTicket.assignee.role}</div>
                    </div>
                  </div>
                </div>

                {/* Người hỗ trợ */}
                {currentTicket.supporters.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Người hỗ trợ
                    </div>
                    <div className="space-y-2">
                      {currentTicket.supporters.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <div
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(s.name)}`}>
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
                {currentTicket.notifyRecipients.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Người nhận thông báo
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentTicket.notifyRecipients.map((n) => (
                        <div key={n.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                          <div
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white ${avatarColor(n.name)}`}>
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
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Sinh viên
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(currentTicket.student.name)}`}>
                      {initials(currentTicket.student.name)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-800">{currentTicket.student.name}</div>
                      <div className="text-[10px] text-slate-400">{currentTicket.student.mssv}</div>
                    </div>
                  </div>
                </div>

                {currentTicket.attachments.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Tệp đính kèm
                    </div>
                    {currentTicket.attachments.map((f) => (
                      <div
                        key={f}
                        className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                        <Paperclip className="size-3.5 text-slate-400" />
                        <span className="text-xs text-blue-600">{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                {currentTicket.hasFee && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Thanh toán
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${paymentBadge(currentTicket.paymentStatus)}`}>
                      {paymentLabel(currentTicket.paymentStatus)}
                      {currentTicket.feeAmount ? ` · ${currentTicket.feeAmount.toLocaleString('vi-VN')}đ` : ''}
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
                  <span className="text-xs font-medium text-slate-700">{formatDate(currentTicket.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="size-3" />
                    Deadline
                  </span>
                  <span className="text-xs font-medium text-slate-700">{formatDate(currentTicket.deadline)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Settings className="size-3" />
                    Hình thức
                  </span>
                  <span className="text-xs font-medium text-slate-700">{formLabel(currentTicket.processingForm)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column — Action Flow */}
          <div className="flex-1 md:overflow-y-auto p-6 bg-slate-50/20">
            <h3 className="mb-4 text-sm font-bold text-slate-800">Luồng xử lý ticket</h3>
            <div className="pl-1">
              {steps.map((step, idx) => (
                <TicketStepCard
                  key={step.id}
                  step={step}
                  isLast={idx === steps.length - 1}
                  viewRole={viewRole}
                  onStepUpdate={handleStepUpdate}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end border-t border-slate-100 px-6 py-3 bg-white">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
            Đóng
          </button>
        </div>

        {/* Lightbox for large QR Code */}
        {zoomedQR && (
          <div
            onClick={() => setZoomedQR(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 cursor-zoom-out">
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative flex flex-col items-center rounded-2xl bg-white p-6 shadow-2xl max-w-sm w-full cursor-default">
              <button
                onClick={() => setZoomedQR(false)}
                className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                <X className="size-4" />
              </button>
              <h3 className="mb-4 text-base font-bold text-slate-800">Mã QR Thanh Toán</h3>
              <MockQRCode size={220} />
              <div className="mt-4 w-full space-y-1.5 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Ngân hàng:</span>
                  <span className="font-semibold text-slate-800">Vietcombank</span>
                </div>
                <div className="flex justify-between">
                  <span>Số tài khoản:</span>
                  <span className="font-semibold text-slate-800">1234567890</span>
                </div>
                <div className="flex justify-between">
                  <span>Chủ tài khoản:</span>
                  <span className="font-semibold text-slate-800">Trường ĐH Gia Định</span>
                </div>
                <div className="flex justify-between">
                  <span>Số tiền:</span>
                  <span className="font-semibold text-slate-800">
                    {currentTicket.feeAmount?.toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Nội dung:</span>
                  <span className="font-bold text-blue-600">
                    {currentTicket.code} {currentTicket.student.mssv}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-[10px] text-center text-slate-400">
                Vui lòng chuyển khoản đúng số tiền và nội dung chuyển khoản để giao dịch được xác thực tự động.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
