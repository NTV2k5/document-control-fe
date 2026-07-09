import type { ITicketTableProps } from '../ticket.type';
import { ETicketType, ETicketStatus, ETicketSource, EPaymentStatus, EProcessingForm } from '../ticket.type';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* ─── Helpers ────────────────────────────────────────────── */

const typeLabel = (t: ETicketType) =>
  t === ETicketType.CUNG_CAP_THONG_TIN ? 'Cung cấp thông tin' : 'Dịch vụ hành chính';

const typeBadgeClass = (t: ETicketType) =>
  t === ETicketType.CUNG_CAP_THONG_TIN
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-indigo-50 text-indigo-700 border-indigo-200';

const statusLabel = (s: ETicketStatus) => {
  const map: Record<ETicketStatus, string> = {
    [ETicketStatus.MOI]: 'Mới',
    [ETicketStatus.DANG_XU_LY]: 'Đang xử lý',
    [ETicketStatus.CHO_SINH_VIEN]: 'Chờ sinh viên',
    [ETicketStatus.DA_HOAN_TAT]: 'Đã hoàn tất',
  };
  return map[s];
};

const statusBadgeClass = (s: ETicketStatus) => {
  const map: Record<ETicketStatus, string> = {
    [ETicketStatus.MOI]: 'bg-slate-100 text-slate-600',
    [ETicketStatus.DANG_XU_LY]: 'bg-orange-50 text-orange-600',
    [ETicketStatus.CHO_SINH_VIEN]: 'bg-yellow-50 text-yellow-700',
    [ETicketStatus.DA_HOAN_TAT]: 'bg-emerald-50 text-emerald-600',
  };
  return map[s];
};

const sourceLabel = (s: ETicketSource) =>
  s === ETicketSource.AI_CHATBOT ? 'AI Chatbot' : 'Tạo ticket';

const sourceBadgeClass = (s: ETicketSource) =>
  s === ETicketSource.AI_CHATBOT
    ? 'bg-purple-50 text-purple-600 border-purple-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';

const formLabel = (f: EProcessingForm) => {
  const map: Record<EProcessingForm, string> = {
    [EProcessingForm.ONLINE_KY_SO]: 'Online ký số',
    [EProcessingForm.ONLINE_BAN_SCAN]: 'Online bản scan',
    [EProcessingForm.OFFLINE_KY_TAY]: 'Offline ký tay',
    [EProcessingForm.GOI_DIEN_KHAC]: 'Gọi điện / Khác',
  };
  return map[f];
};

const feeLabel = (p: EPaymentStatus) =>
  p === EPaymentStatus.KHONG_THU_PHI ? 'Không thu phí' : 'Có thu phí';

const feeBadgeClass = (p: EPaymentStatus) =>
  p === EPaymentStatus.KHONG_THU_PHI
    ? 'bg-emerald-50 text-emerald-600'
    : 'bg-amber-50 text-amber-600';

const formatDate = (d: string) => {
  const date = new Date(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

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

const slaBarColor = (pct: number) => {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-blue-500';
  if (pct >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
};

const slaLabelColor = (label: string) => {
  if (label.includes('Đạt')) return 'text-emerald-600';
  if (label.includes('Quá')) return 'text-red-600';
  return 'text-slate-600';
};

/* ─── Component ──────────────────────────────────────────── */

export const TicketTable = ({
  tickets,
  page,
  pageSize,
  total,
  onPageChange,
  onRowClick,
  onSourceClick,
  onDocumentCodeClick,
  sortField,
  sortDirection,
  onSort,
}: ITicketTableProps) => {
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  const renderSortableHeader = (field: string, label: string, className = '') => {
    const isSorted = sortField === field;
    return (
      <th
        onClick={() => onSort?.(field)}
        className={`px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer select-none transition-colors hover:bg-slate-100/80 hover:text-slate-800 ${className} ${
          isSorted ? 'bg-blue-50/50 text-blue-700 font-bold' : ''
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          <span className="text-[9px] font-sans opacity-70">
            {isSorted ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 whitespace-nowrap">
              <th className="w-10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">STT</th>
              {renderSortableHeader('code', 'Mã', 'min-w-[90px]')}
              {renderSortableHeader('title', 'Nội dung', 'min-w-[200px]')}
              {renderSortableHeader('student', 'Sinh viên')}
              {renderSortableHeader('type', 'Loại', 'min-w-[150px]')}
              {renderSortableHeader('creator', 'Người tạo ticket')}
              {renderSortableHeader('createdAt', 'Ngày yêu cầu')}
              {renderSortableHeader('source', 'Nguồn', 'min-w-[110px]')}
              {renderSortableHeader('documentCode', 'Mã phiếu')}
              {renderSortableHeader('processingForm', 'Hình thức')}
              {renderSortableHeader('paymentStatus', 'Phí', 'min-w-[110px]')}
              {renderSortableHeader('assignee', 'Người phụ trách')}
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Người hỗ trợ</th>
              {renderSortableHeader('deadline', 'Deadline')}
              {renderSortableHeader('status', 'Trạng thái', 'min-w-[125px]')}
              {renderSortableHeader('sla', 'SLA', 'min-w-[120px]')}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tickets.map((ticket, idx) => (
              <tr
                key={ticket.id}
                onClick={() => onRowClick(ticket)}
                className="cursor-pointer transition-colors hover:bg-blue-50/40"
              >
                {/* 1. STT */}
                <td className="px-3 py-3 text-slate-500">{start + idx + 1}</td>

                {/* 2. Mã */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="font-semibold text-blue-600">{ticket.code}</span>
                </td>

                {/* 3. Nội dung */}
                <td className="max-w-[200px] px-3 py-3">
                  <span className="line-clamp-2 text-slate-800">{ticket.title}</span>
                </td>

                {/* 4. Sinh viên */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(ticket.student.name)}`}>
                      {initials(ticket.student.name)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-800">{ticket.student.name}</div>
                      <div className="text-[10px] text-slate-400">{ticket.student.mssv}</div>
                    </div>
                  </div>
                </td>

                {/* 5. Loại */}
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${typeBadgeClass(ticket.type)}`}>
                    <span className={`mr-1 size-1.5 rounded-full ${
                      ticket.type === ETicketType.CUNG_CAP_THONG_TIN ? 'bg-blue-500' : 'bg-indigo-700'
                    }`} />
                    {typeLabel(ticket.type)}
                  </span>
                </td>

                {/* 6. Người tạo ticket */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <div className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor(ticket.creator.name)}`}>
                      {initials(ticket.creator.name)}
                    </div>
                    <div>
                      <div className="text-xs text-slate-700">{ticket.creator.name}</div>
                      <div className="text-[10px] text-slate-400">{ticket.creator.role}</div>
                    </div>
                  </div>
                </td>

                {/* 7. Ngày yêu cầu */}
                <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                  {formatDate(ticket.createdAt)}
                </td>

                {/* 8. Nguồn (bấm được) */}
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onSourceClick(ticket)}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap transition-colors hover:opacity-80 ${sourceBadgeClass(ticket.source)}`}
                  >
                    <span className={`mr-1 size-1.5 rounded-full ${
                      ticket.source === ETicketSource.AI_CHATBOT ? 'bg-purple-600' : 'bg-slate-500'
                    }`} />
                    {sourceLabel(ticket.source)}
                  </button>
                </td>

                {/* 9. Mã phiếu văn bản */}
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  {ticket.documentCode ? (
                    <button
                      onClick={() => onDocumentCodeClick(ticket)}
                      className="text-xs font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
                    >
                      {ticket.documentCode}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>

                {/* 10. Hình thức */}
                <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                  {formLabel(ticket.processingForm)}
                </td>

                {/* 11. Có thu phí */}
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${feeBadgeClass(ticket.paymentStatus)}`}>
                    {feeLabel(ticket.paymentStatus)}
                  </span>
                </td>

                {/* 12. Người phụ trách */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <div className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor(ticket.assignee.name)}`}>
                      {initials(ticket.assignee.name)}
                    </div>
                    <span className="text-xs text-slate-700">{ticket.assignee.name}</span>
                  </div>
                </td>

                {/* 13. Người hỗ trợ */}
                <td className="px-3 py-3">
                  {ticket.supporters.length > 0 ? (
                    <div className="flex -space-x-1.5">
                      {ticket.supporters.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          title={s.name}
                          className={`flex size-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white ${avatarColor(s.name)}`}
                        >
                          {initials(s.name)}
                        </div>
                      ))}
                      {ticket.supporters.length > 3 && (
                        <div className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[9px] font-bold text-slate-600">
                          +{ticket.supporters.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>

                {/* 14. Deadline */}
                <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                  {formatDate(ticket.deadline)}
                </td>

                {/* 15. Trạng thái */}
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${statusBadgeClass(ticket.status)}`}>
                    {statusLabel(ticket.status)}
                  </span>
                </td>

                {/* 16. SLA */}
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${slaBarColor(ticket.slaPercent)}`}
                        style={{ width: `${Math.min(ticket.slaPercent, 100)}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-medium ${slaLabelColor(ticket.slaLabel)}`}>
                      {ticket.slaLabel}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
        <span className="text-xs text-slate-500">
          Hiển thị {start + 1}–{end} trên {total} ticket
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`flex size-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
