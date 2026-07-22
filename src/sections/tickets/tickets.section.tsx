import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ITicketFilter, ITicket, ITicketStatsCard } from './ticket.type';
import { ETicketType, ETicketStatus, ETicketSource, EPaymentStatus, EProcessingForm, type ITicketsSectionProps } from './ticket.type';
import { TicketStats } from './ticket-stats';
import { TicketToolbar } from './ticket-toolbar';
import { TicketTable } from './ticket-table';
import { TicketDetailModal } from './ticket-detail-modal';
import { CreateTicketModal } from './create-ticket-modal';
import { TicketSourceModal } from './ticket-source-modal';
import { listTicketsAPI } from 'api';
import type { ITicketAPIItem } from 'api';
import { toast } from 'react-toastify';
import { profileStore } from 'reactjs-platform/utilities';

const PAGE_SIZE = 6;

/* ─── Helpers: map API ticket_type / status / source → Enum ── */

const mapTicketType = (raw: string): ETicketType => {
  if (raw === 'Information Provision' || raw === 'Cung cấp thông tin') return ETicketType.CUNG_CAP_THONG_TIN;
  if (raw === 'Administrative Service' || raw === 'Dịch vụ hành chính') return ETicketType.DICH_VU_HANH_CHINH;
  return ETicketType.CUNG_CAP_THONG_TIN;
};

const mapTicketStatus = (raw: string): ETicketStatus => {
  if (raw === 'New' || raw === 'Mới' || raw === 'Chờ xử lý') return ETicketStatus.MOI;
  if (raw === 'In Progress' || raw === 'Đang xử lý') return ETicketStatus.DANG_XU_LY;
  if (raw === 'Pending Student' || raw === 'Chờ sinh viên' || raw === 'Chờ sinh viên phản hồi') return ETicketStatus.CHO_SINH_VIEN;
  if (raw === 'Completed' || raw === 'Closed' || raw === 'Hoàn tất' || raw === 'Đã đóng') return ETicketStatus.DA_HOAN_TAT;
  return ETicketStatus.MOI;
};

const mapTicketSource = (raw: string): ETicketSource => {
  if (raw === 'AI Chatbot') return ETicketSource.AI_CHATBOT;
  return ETicketSource.TAO_TICKET;
};

const mapProcessingMethod = (raw: string): EProcessingForm => {
  if (raw === 'Online Digital Sign') return EProcessingForm.ONLINE_KY_SO;
  if (raw === 'Online Scan') return EProcessingForm.ONLINE_BAN_SCAN;
  if (raw === 'Offline Handwritten') return EProcessingForm.OFFLINE_KY_TAY;
  return EProcessingForm.GOI_DIEN_KHAC;
};

const mapApiItemToTicket = (item: ITicketAPIItem): ITicket => ({
  id: item.name,
  code: item.name,
  title: item.title,
  content: '',
  student: {
    id: item.student,
    name: item.student_name,
    mssv: item.student_code,
    department: item.faculty_name,
  },
  type: mapTicketType(item.ticket_type),
  creator: {
    id: item.created_by_user,
    name: item.created_by_display.full_name || item.created_by_user,
    avatar: item.created_by_display.user_image || undefined,
  },
  createdAt: item.request_date,
  source: mapTicketSource(item.source),
  documentCode: item.document_form_code || undefined,
  processingForm: mapProcessingMethod(item.processing_method),
  hasFee: item.has_fee === 1,
  paymentStatus: item.has_fee === 0 ? EPaymentStatus.KHONG_THU_PHI : EPaymentStatus.CHUA_THANH_TOAN,
  feeAmount: item.fee_amount,
  assignee: {
    id: item.assignee,
    name: item.assignee_name || item.assignee_display?.full_name || item.assignee,
    avatar: item.assignee_display?.user_image || undefined,
  },
  supporters: [],
  notifyRecipients: [],
  deadline: item.deadline,
  status: mapTicketStatus(item.status),
  slaPercent: item.sla_percentage,
  slaLabel: item.sla_label || '',
  attachments: [],
  steps: [],
});

/* ─── Build Stats Cards from API stats object ─────────────── */

const buildTicketStatsFromAPI = (
  stats: { total: number; need_action: number; processing: number; overdue: number; completed: number },
): ITicketStatsCard[] => [
  {
    key: 'total',
    label: 'Tổng số ticket',
    value: stats.total,
    subLabel: '+32 tháng này',
    color: 'blue',
    icon: 'layers',
  },
  {
    key: 'assigned_to_me',
    label: 'Cần tôi xử lý',
    value: stats.need_action,
    subLabel: 'Theo người phụ trách',
    color: 'yellow',
    icon: 'user',
  },
  {
    key: 'in_progress',
    label: 'Đang xử lý',
    value: stats.processing,
    subLabel: '5 ngày gần nhất',
    color: 'orange',
    icon: 'clock',
  },
  {
    key: 'overdue',
    label: 'Quá hạn SLA',
    value: stats.overdue,
    subLabel: 'Cần xử lý gấp',
    color: 'red',
    icon: 'alert-triangle',
  },
  {
    key: 'completed',
    label: 'Đã hoàn tất',
    value: stats.completed,
    subLabel: 'Đạt SLA 95%',
    color: 'green',
    icon: 'check-circle',
  },
];

const DEFAULT_STATS: ITicketStatsCard[] = buildTicketStatsFromAPI({
  total: 0, need_action: 0, processing: 0, overdue: 0, completed: 0,
});

export const TicketsSection = (_props: ITicketsSectionProps) => {
  /* ─── State ───────────────────────────────────────────── */
  const [tickets, setTickets] = useState<ITicket[]>([]);
  const [statsCards, setStatsCards] = useState<ITicketStatsCard[]>(DEFAULT_STATS);
  const [filter, setFilter] = useState<ITicketFilter>({
    search: '',
    type: '',
    status: '',
    source: '',
    statsFilter: '',
  });
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<ITicket | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [sourceTicket, setSourceTicket] = useState<ITicket | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);

  const profile = profileStore((state: any) => state.profile);

  const fetchTickets = useCallback(() => {
    listTicketsAPI({ start: 0, page_size: 1000 })
      .then((data) => {
        setTickets((data.tickets ?? []).map(mapApiItemToTicket));
        setStatsCards(buildTicketStatsFromAPI(data.stats ?? { total: 0, need_action: 0, processing: 0, overdue: 0, completed: 0 }));
      })
      .catch((err) => {
        console.error('Failed to fetch tickets:', err);
        toast.error('Không thể tải danh sách ticket.');
      });
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  /* ─── Derived ─────────────────────────────────────────── */

  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    // Stats filter
    if (filter.statsFilter === 'assigned_to_me') {
      result = result.filter(
        (t) =>
          (t.status === ETicketStatus.MOI || t.status === ETicketStatus.CHO_SINH_VIEN) &&
          profile?.email &&
          t.assignee?.id?.toLowerCase() === profile.email.toLowerCase()
      );
    } else if (filter.statsFilter === 'in_progress') {
      result = result.filter((t) => t.status === ETicketStatus.DANG_XU_LY);
    } else if (filter.statsFilter === 'overdue') {
      result = result.filter((t) => t.slaLabel?.includes('Quá') || t.slaPercent >= 100);
    } else if (filter.statsFilter === 'completed') {
      result = result.filter((t) => t.status === ETicketStatus.DA_HOAN_TAT);
    }

    // Type filter
    if (filter.type) {
      result = result.filter((t) => t.type === filter.type);
    }

    // Status filter
    if (filter.status) {
      result = result.filter((t) => t.status === filter.status);
    }

    // Source filter
    if (filter.source) {
      result = result.filter((t) => t.source === filter.source);
    }

    // Search filter
    if (filter.search.trim()) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.code.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.student.name.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q),
      );
    }

    return result;
  }, [filter, tickets]);

  const pagedTickets = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTickets.slice(start, start + PAGE_SIZE);
  }, [filteredTickets, page]);

  /* ─── Handlers ────────────────────────────────────────── */
  const handleFilterChange = useCallback((partial: Partial<ITicketFilter>) => {
    setFilter((prev) => ({ ...prev, ...partial }));
    setPage(1);
  }, []);

  const handleStatsFilterClick = useCallback((key: string) => {
    setFilter((prev) => ({
      ...prev,
      statsFilter: prev.statsFilter === key ? '' : key,
      type: '' as ETicketType | '',
      status: '' as ETicketStatus | '',
      source: '' as ETicketSource | '',
      search: '',
    }));
    setPage(1);
  }, []);

  const handleRowClick = useCallback((ticket: ITicket) => {
    setSelectedTicket(ticket);
    setDetailOpen(true);
  }, []);

  const handleSourceClick = useCallback((ticket: ITicket) => {
    setSourceTicket(ticket);
    setSourceOpen(true);
  }, []);

  const handleDocumentCodeClick = useCallback((_ticket: ITicket) => {
    // Placeholder — would open PVB document in real app
  }, []);

  /* ─── Render ──────────────────────────────────────────── */
  return (
    <div className="space-y-5 pb-10">
      {/* Breadcrumb */}
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Vận hành · Đo bảng chỉ số
      </div>

      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Quản lý ticket</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
          Dashboard quản lý ticket cho toàn bộ phòng/ban. Ticket phát sinh từ Q&A hoặc tự tạo sau khi sinh viên thanh toán QR. Mỗi ticket ghi rõ ngày nhận, thời gian muốn phản hồi, loại, hình thức, SLA và trạng thái — duyệt online, ký số đóng dấu và trả kết quả qua email.
        </p>
      </div>

      {/* Stats Cards */}
      <TicketStats
        stats={statsCards}
        activeFilter={filter.statsFilter}
        onFilterClick={handleStatsFilterClick}
      />

      {/* Toolbar */}
      <TicketToolbar
        filter={filter}
        onFilterChange={handleFilterChange}
        onCreateClick={() => setCreateOpen(true)}
      />

      {/* Table */}
      <TicketTable
        tickets={pagedTickets}
        page={page}
        pageSize={PAGE_SIZE}
        total={filteredTickets.length}
        onPageChange={setPage}
        onRowClick={handleRowClick}
        onSourceClick={handleSourceClick}
        onDocumentCodeClick={handleDocumentCodeClick}
      />

      {/* Detail Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      {/* Create Modal */}
      <CreateTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onTicketCreated={fetchTickets}
      />

      {/* Source Modal */}
      <TicketSourceModal
        ticket={sourceTicket}
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
      />
    </div>
  );
};
