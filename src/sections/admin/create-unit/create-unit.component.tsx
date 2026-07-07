'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import {
  adminCreateOrganizationUnitAPI,
  type ICreateOrganizationUnitPayload,
  type IOrganizationUnit,
} from 'reactjs-platform/utilities';

interface ICreateUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  parent: IOrganizationUnit | null;
  onCreated: (unitId: string) => void | Promise<void>;
}

const DEFAULT_TYPES = ['UNIVERSITY', 'CAMPUS', 'FACULTY', 'DEPARTMENT', 'DIVISION', 'TEAM'];

export const CreateUnitModal = ({ isOpen, onClose, parent, onCreated }: ICreateUnitModalProps) => {
  const nameId = useId();
  const codeId = useId();
  const typeId = useId();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [unit_type, setUnitType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setCode('');
    setUnitType(parent ? 'DEPARTMENT' : 'UNIVERSITY');
    setError(null);
  }, [isOpen, parent]);

  if (!isOpen) return null;

  const autoCode = () =>
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: ICreateOrganizationUnitPayload = {
        code: code.trim() || autoCode() || 'UNIT_' + Date.now(),
        name: name.trim(),
        unit_type: unit_type.trim() || 'UNIT',
        parent_id: parent?.id,
        is_active: true,
      };
      const created = await adminCreateOrganizationUnitAPI(payload);
      await onCreated(created.id);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể tạo đơn vị');
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
              <h3 className="text-lg font-semibold text-[#002147]">{parent ? 'Thêm đơn vị con' : 'Thêm tổ chức'}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {parent ? (
                  <>
                    Bên trong <span className="font-medium text-slate-700">{parent.name}</span>
                  </>
                ) : (
                  'Tạo tổ chức cấp cao nhất'
                )}
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
                placeholder={parent ? 'Khoa Công nghệ thông tin' : 'Document Portal'}
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
                  list="unit-type-options"
                  value={unit_type}
                  onChange={(e) => setUnitType(e.target.value.toUpperCase())}
                  placeholder="DEPARTMENT"
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/15"
                />
                <datalist id="unit-type-options">
                  {DEFAULT_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <label htmlFor={codeId} className="text-sm font-medium text-slate-700">
                  Mã <span className="text-xs font-normal text-slate-400">(tự sinh nếu bỏ trống)</span>
                </label>
                <input
                  id={codeId}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={autoCode() || 'FIT'}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/15"
                />
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
                {submitting ? 'Đang tạo…' : 'Tạo đơn vị'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
