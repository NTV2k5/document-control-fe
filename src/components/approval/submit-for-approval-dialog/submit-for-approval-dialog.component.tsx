import { CheckCircle2, Clock3, Loader2, SendHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'reactjs-platform/ui';
import type { ISubmitForApprovalDialogProps } from './submit-for-approval-dialog.type';

export const SubmitForApprovalDialog = ({
  isOpen,
  templateName = 'Mẫu tài liệu',
  template_id,
  onClose,
  onSubmit,
}: ISubmitForApprovalDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      setIsSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isSuccess) return;

    const timer = window.setTimeout(() => {
      onClose();
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isSuccess, onClose]);

  const handleSubmit = async () => {
    if (isSubmitting || isSuccess) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(template_id);
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi duyệt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (isSubmitting) return;
        if (!nextOpen) onClose();
      }}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-xl">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#0B2559]">
              {isSuccess ? <CheckCircle2 className="size-6" /> : <SendHorizontal className="size-6" />}
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                {isSuccess ? 'Đã gửi duyệt' : 'Gửi duyệt'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-500">
                {isSuccess
                  ? 'Mẫu tài liệu đang chờ quản trị viên xử lý.'
                  : 'Đưa bản nháp vào luồng duyệt để quản trị viên phê duyệt hoặc từ chối.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <div className="font-semibold">Mẫu tài liệu</div>
            <div className="mt-1">{templateName}</div>
          </div>

          {isSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              <div className="font-semibold">Bước tiếp theo</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Quản trị viên có thể phê duyệt hoặc từ chối mẫu tài liệu này.</li>
                <li>Nếu bị từ chối, mẫu tài liệu sẽ được mở chỉnh sửa lại.</li>
                <li>Bạn có thể theo dõi trạng thái ngay trong trình soạn thảo và trang danh sách.</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Điều sẽ xảy ra</div>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 size-4 text-sky-600" />
                <span>Trạng thái mẫu sẽ chuyển sang đã gửi duyệt và bị khóa chỉnh sửa đến khi duyệt xong.</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                <span>Quản trị viên có thể phê duyệt trực tiếp hoặc trả về để chỉnh sửa.</span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-end">
          {!isSuccess && (
            <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-11 rounded-xl px-5">
              Hủy
            </Button>
          )}
          <Button
            onClick={isSuccess ? onClose : () => void handleSubmit()}
            disabled={isSubmitting}
            className="h-11 rounded-xl bg-[#0B2559] px-5 hover:bg-[#123C85]">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? 'Đang gửi…' : isSuccess ? 'Đóng' : 'Gửi duyệt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
