'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import {
  adminUpdateOrganizationUnitAPI,
  type IOrganizationUnit,
  type IUpdateOrganizationUnitPayload,
} from 'reactjs-platform/utilities';

interface IEditUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: IOrganizationUnit | null;
  onUpdated: (unit: IOrganizationUnit) => void | Promise<void>;
}

const DEFAULT_TYPES = [
  'UNIVERSITY',
  'CAMPUS',
  'FACULTY',
  'DEPARTMENT',
  'OFFICE',
  'CENTER',
  'INSTITUTE',
  'DIVISION',
  'TEAM',
];

export const EditUnitModal = ({ isOpen, onClose, unit, onUpdated }: IEditUnitModalProps) => {
  const nameId = useId();
  const typeId = useId();
  const sortId = useId();
  const activeId = useId();

  const [name, setName] = useState('');
  const [unit_type, setUnitType] = useState('');
  const [is_active, setIsActive] = useState(true);
  const [sort_order, setSortOrder] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !unit) return;
    setName(unit.name);
    setUnitType(unit.unit_type);
    setIsActive(unit.is_active);
    setSortOrder(unit.sort_order ?? 0);
    setError(null);
  }, [isOpen, unit]);

  if (!isOpen || !unit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tên là bắt buộc');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: IUpdateOrganizationUnitPayload = {
        name: name.trim(),
        unit_type: unit_type.trim() || unit.unit_type,
        is_active: is_active,
        sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      };
      const updated = await adminUpdateOrganizationUnitAPI(unit.id, payload);
      await onUpdated(updated);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể cập nhật đơn vị');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-4 py-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-7 py-5">
            <div>
              <h3 className="text-lg font-semibold text-[#002147]">Sửa đơn vị</h3>
              <p className="mt-1 text-sm text-slate-500">
                Mã <span className="font-mono text-slate-700">{unit.code}</span> · không thể thay đổi
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-7 py-6">
            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <div className="space-y-2">
              <label htmlFor={nameId} className="text-sm font-medium text-slate-700">
                Tên đơn vị
              </label>
              <input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/15"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor={typeId} className="text-sm font-medium text-slate-700">
                  Loại
                </label>
                <input
                  id={typeId}
                  list="edit-unit-type-options"
                  value={unit_type}
                  onChange={(e) => setUnitType(e.target.value.toUpperCase())}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/15"
                />
                <datalist id="edit-unit-type-options">
                  {DEFAULT_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <label htmlFor={sortId} className="text-sm font-medium text-slate-700">
                  Thứ tự sắp xếp
                </label>
                <input
                  id={sortId}
                  type="number"
                  value={sort_order}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/15"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                id={activeId}
                type="checkbox"
                checked={is_active}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4 rounded border-slate-300 text-[#002147] focus:ring-[#002147]/20"
              />
              <div className="text-sm">
                <label htmlFor={activeId} className="font-medium text-slate-700">
                  Đang hoạt động
                </label>
                <div className="text-xs text-slate-500">Tắt để ẩn khỏi danh sách chọn khi tạo người dùng/mẫu</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#002147] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#002147]/90 disabled:opacity-60">
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
