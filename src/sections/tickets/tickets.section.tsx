import { useState, useMemo, useCallback } from 'react';
import type { ITicketsSectionProps, ITicketFilter, ITicket } from './ticket.type';
import { ETicketType, ETicketStatus, ETicketSource } from './ticket.type';
import { mockTickets, buildTicketStats } from './ticket.mock';
import { TicketStats } from './ticket-stats';
import { TicketToolbar } from './ticket-toolbar';
import { TicketTable } from './ticket-table';
import { TicketDetailModal } from './ticket-detail-modal';
import { CreateTicketModal } from './create-ticket-modal';
import { TicketSourceModal } from './ticket-source-modal';

const PAGE_SIZE = 6;

export const TicketsSection = (_props: ITicketsSectionProps) => {
  /* ─── State ───────────────────────────────────────────── */
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
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  /* ─── Derived ─────────────────────────────────────────── */
  const stats = useMemo(() => buildTicketStats(mockTickets), []);

  const handleSort = useCallback((field: string) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDirection((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDirection('asc');
      return field;
    });
    setPage(1);
  }, []);

  const filteredTickets = useMemo(() => {
    let result = [...mockTickets];

    // Stats filter
    if (filter.statsFilter === 'assigned_to_me') {
      result = result.filter((t) => t.assignee.id === 's1');
    } else if (filter.statsFilter === 'in_progress') {
      result = result.filter((t) => t.status === ETicketStatus.DANG_XU_LY);
    } else if (filter.statsFilter === 'overdue') {
      result = result.filter((t) => t.slaLabel.includes('Quá'));
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

    // Sort logic
    if (sortField) {
      result.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortField === 'code') {
          valA = a.code;
          valB = b.code;
        } else if (sortField === 'title') {
          valA = a.title;
          valB = b.title;
        } else if (sortField === 'student') {
          valA = a.student.name;
          valB = b.student.name;
        } else if (sortField === 'type') {
          valA = a.type;
          valB = b.type;
        } else if (sortField === 'creator') {
          valA = a.creator.name;
          valB = b.creator.name;
        } else if (sortField === 'createdAt') {
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
        } else if (sortField === 'source') {
          valA = a.source;
          valB = b.source;
        } else if (sortField === 'documentCode') {
          valA = a.documentCode || '';
          valB = b.documentCode || '';
        } else if (sortField === 'processingForm') {
          valA = a.processingForm;
          valB = b.processingForm;
        } else if (sortField === 'paymentStatus') {
          valA = a.paymentStatus;
          valB = b.paymentStatus;
        } else if (sortField === 'assignee') {
          valA = a.assignee.name;
          valB = b.assignee.name;
        } else if (sortField === 'deadline') {
          valA = new Date(a.deadline).getTime();
          valB = new Date(b.deadline).getTime();
        } else if (sortField === 'status') {
          valA = a.status;
          valB = b.status;
        } else if (sortField === 'sla') {
          valA = a.slaPercent;
          valB = b.slaPercent;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [filter, sortField, sortDirection]);

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
      // Clear other filters when clicking stats
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
        <h1 className="text-2xl font-bold text-slate-900">Quản lý ticket</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
          Dashboard quản lý ticket cho toàn bộ phòng/ban. Ticket phát sinh từ Q&A hoặc tự tạo sau khi sinh viên thanh toán QR. Mỗi ticket ghi rõ ngày nhận, thời gian muốn phản hồi, loại, hình thức, SLA và trạng thái — duyệt online, ký số đóng dấu và trả kết quả qua email.
        </p>
      </div>

      {/* Stats Cards */}
      <TicketStats
        stats={stats}
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
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
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
