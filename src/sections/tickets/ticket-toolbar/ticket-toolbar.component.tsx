import type { ITicketToolbarProps } from '../ticket.type';
import { ETicketType, ETicketStatus, ETicketSource } from '../ticket.type';
import { Search, Plus, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface IDropdownOption {
  value: string;
  label: string;
}

const DropdownFilter = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: IDropdownOption[];
  value: string;
  onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label || label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="whitespace-nowrap">{selectedLabel}</span>
        <ChevronDown className="size-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
              !value ? 'font-semibold text-blue-600' : 'text-slate-600'
            }`}
          >
            {label}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                value === opt.value ? 'font-semibold text-blue-600' : 'text-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const typeOptions: IDropdownOption[] = [
  { value: ETicketType.CUNG_CAP_THONG_TIN, label: 'Cung cấp thông tin' },
  { value: ETicketType.DICH_VU_HANH_CHINH, label: 'Dịch vụ hành chính' },
];

const statusOptions: IDropdownOption[] = [
  { value: ETicketStatus.MOI, label: 'Mới' },
  { value: ETicketStatus.DANG_XU_LY, label: 'Đang xử lý' },
  { value: ETicketStatus.CHO_SINH_VIEN, label: 'Chờ sinh viên' },
  { value: ETicketStatus.DA_HOAN_TAT, label: 'Đã hoàn tất' },
];

const sourceOptions: IDropdownOption[] = [
  { value: ETicketSource.AI_CHATBOT, label: 'AI Chatbot' },
  { value: ETicketSource.TAO_TICKET, label: 'Tạo ticket' },
];

export const TicketToolbar = ({ filter, onFilterChange, onCreateClick }: ITicketToolbarProps) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      {/* Search */}
      <div className="relative w-full sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm mã ticket, sinh viên, nội dung..."
          value={filter.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownFilter
          label="Tất cả loại"
          options={typeOptions}
          value={filter.type}
          onChange={(v) => onFilterChange({ type: v as ETicketType | '' })}
        />
        <DropdownFilter
          label="Tất cả trạng thái"
          options={statusOptions}
          value={filter.status}
          onChange={(v) => onFilterChange({ status: v as ETicketStatus | '' })}
        />
        <DropdownFilter
          label="Tất cả nguồn"
          options={sourceOptions}
          value={filter.source}
          onChange={(v) => onFilterChange({ source: v as ETicketSource | '' })}
        />
      </div>

      {/* Create button */}
      <button
        onClick={onCreateClick}
        className="flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-800 hover:shadow-md active:scale-[0.98]"
      >
        <Plus className="size-4" />
        <span>Tạo mới ticket</span>
      </button>
    </div>
  );
};
