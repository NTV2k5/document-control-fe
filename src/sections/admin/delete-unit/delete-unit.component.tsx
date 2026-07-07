'use client';

import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import {
  adminDeleteOrganizationUnitAPI,
  adminGetOrganizationUnitDeleteImpactAPI,
  type IOrganizationUnit,
  type IOrganizationUnitDeleteImpact,
} from 'reactjs-platform/utilities';

interface IDeleteUnitDialogProps {
  isOpen: boolean;
  unit: IOrganizationUnit | null;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}

export const DeleteUnitDialog = ({ isOpen, unit, onClose, onDeleted }: IDeleteUnitDialogProps) => {
  const cascadeFieldId = useId();
  const confirmFieldId = useId();

  const [impact, setImpact] = useState<IOrganizationUnitDeleteImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [cascade, setCascade] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !unit) return;
    setImpact(null);
    setCascade(false);
    setTyped('');
    setError(null);
    setLoading(true);
    adminGetOrganizationUnitDeleteImpactAPI(unit.id)
      .then((res) => {
        setImpact(res);
        setCascade(res.requires_cascade);
      })
      .catch((err) => setError((err as Error).message || 'Không thể tải phạm vi ảnh hưởng'))
      .finally(() => setLoading(false));
  }, [isOpen, unit]);

  if (!isOpen || !unit) return null;

  const mustCascade = impact?.requires_cascade ?? false;
  const canConfirm = !!impact && typed.trim() === unit.name.trim() && (!mustCascade || cascade);

  const handleDelete = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await adminDeleteOrganizationUnitAPI(unit.id, { cascade });
      await onDeleted();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể xóa đơn vị');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-4 py-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="my-auto flex w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-red-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-red-100 bg-red-50/60 px-7 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-700">Xóa đơn vị?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{unit.name}</span>
                  <span className="ml-2 font-mono text-xs text-slate-500">{unit.code}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-5 px-7 py-6">
            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            {loading && <div className="text-sm text-slate-500">Đang kiểm tra ràng buộc…</div>}

            {!loading && impact && (
              <>
                {impact.requires_cascade ? (
                  <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                    <p className="text-sm font-medium text-amber-900">Đơn vị này vẫn còn dữ liệu liên quan:</p>
                    <ul className="space-y-1 text-sm text-amber-800">
                      {impact.descendant_count > 0 && (
                        <li>
                          • <span className="font-semibold">{impact.descendant_count}</span> đơn vị con
                          {impact.descendants.length > 0 && (
                            <span className="ml-1 text-xs text-amber-700">
                              (
                              {impact.descendants
                                .slice(0, 3)
                                .map((d) => d.name)
                                .join(', ')}
                              {impact.descendants.length > 3 ? `, +${impact.descendants.length - 3}` : ''})
                            </span>
                          )}
                        </li>
                      )}
                      {impact.active_assignment_count > 0 && (
                        <li>
                          • <span className="font-semibold">{impact.active_assignment_count}</span> phân quyền người
                          dùng đang hoạt động
                        </li>
                      )}
                    </ul>
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5">
                      <input
                        id={cascadeFieldId}
                        type="checkbox"
                        checked={cascade}
                        onChange={(e) => setCascade(e.target.checked)}
                        className="mt-0.5 size-4 rounded border-slate-300 text-red-600 focus:ring-red-500/20"
                      />
                      <div className="text-sm">
                        <label htmlFor={cascadeFieldId} className="font-medium text-slate-800">
                          Xóa toàn bộ nhánh con và thu hồi phân quyền
                        </label>
                        <div className="text-xs text-slate-500">
                          Mẫu/tài liệu đang tham chiếu các đơn vị này sẽ được bỏ liên kết, dữ liệu vẫn được giữ.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    Không có đơn vị con hoặc phân quyền đang hoạt động. Có thể xóa.
                  </p>
                )}

                <div className="space-y-2">
                  <label htmlFor={confirmFieldId} className="text-sm font-medium text-slate-700">
                    Nhập đúng <span className="font-semibold text-slate-900">{unit.name}</span> để xác nhận
                  </label>
                  <input
                    id={confirmFieldId}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={unit.name}
                    className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-7 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-60">
              Hủy
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canConfirm || submitting}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? 'Đang xóa…' : cascade ? 'Xóa nhánh con' : 'Xóa đơn vị'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
