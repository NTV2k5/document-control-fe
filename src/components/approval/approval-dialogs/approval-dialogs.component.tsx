import { FileX2, FolderGit2, Loader2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from 'reactjs-platform/ui';
import type {
  ICancelApprovalDialogProps,
  IReasonDialogShellProps,
  IRejectionDialogProps,
} from './approval-dialogs.type';

const ReasonDialogShell = ({
  open,
  title,
  description,
  icon,
  value,
  onValueChange,
  placeholder,
  error,
  isSubmitting,
  isSuccess,
  successTitle,
  successDescription,
  onClose,
  onConfirm,
  confirmLabel,
  confirmVariant,
}: IReasonDialogShellProps) => {
  const canSubmit = value.trim().length >= 10;
  const reasonFieldId = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSubmitting) return;
        if (!nextOpen) onClose();
      }}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-xl">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#0B2559]">
              {icon}
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                {isSuccess ? successTitle : title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-500">
                {isSuccess ? 'Trạng thái luồng xử lý đã được cập nhật thành công.' : description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          {isSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              {successDescription}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor={reasonFieldId} className="text-sm font-semibold text-slate-900">
                  Lý do
                </label>
                <Textarea
                  id={reasonFieldId}
                  value={value}
                  onChange={(event) => onValueChange(event.target.value)}
                  placeholder={placeholder}
                  className="min-h-32 rounded-xl border-slate-200 text-sm"
                />
                <div className="text-xs text-slate-500">{value.trim().length}/10 ký tự tối thiểu</div>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-end">
          {!isSuccess && (
            <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-11 rounded-xl px-5">
              Hủy
            </Button>
          )}
          <Button
            variant={isSuccess ? 'default' : confirmVariant}
            onClick={isSuccess ? onClose : () => void onConfirm()}
            disabled={isSubmitting || (!isSuccess && !canSubmit)}
            className="h-11 rounded-xl px-5">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? 'Đang xử lý…' : isSuccess ? 'Đóng' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const RejectionDialog = ({
  isOpen,
  templateName = 'Mẫu tài liệu',
  template_id,
  approverId,
  onClose,
  onReject,
}: IRejectionDialogProps) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setError(null);
      setIsSubmitting(false);
      setIsSuccess(false);
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

  const handleReject = async () => {
    if (isSubmitting || isSuccess) return;

    if (reason.trim().length < 10) {
      setError('Vui lòng nhập ít nhất 10 ký tự để người tạo biết cần chỉnh sửa gì.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onReject(template_id, approverId, reason.trim());
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể từ chối mẫu tài liệu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ReasonDialogShell
      open={isOpen}
      title="Từ chối mẫu tài liệu"
      description={`Trả "${templateName}" về cho người tạo để chỉnh sửa.`}
      icon={<FileX2 className="size-6" />}
      value={reason}
      onValueChange={setReason}
      placeholder="Nhập rõ nội dung cần chỉnh sửa trước khi gửi lại."
      error={error}
      isSubmitting={isSubmitting}
      isSuccess={isSuccess}
      successTitle="Đã từ chối mẫu tài liệu"
      successDescription={
        <div className="space-y-2">
          <div className="font-semibold">Bước tiếp theo</div>
          <ul className="list-disc space-y-1 pl-5">
            <li>Người tạo có thể chỉnh sửa lại mẫu tài liệu.</li>
            <li>Lý do từ chối sẽ hiển thị trong lịch sử luồng duyệt.</li>
            <li>Mẫu tài liệu có thể được gửi duyệt lại sau khi chỉnh sửa.</li>
          </ul>
        </div>
      }
      onClose={onClose}
      onConfirm={handleReject}
      confirmLabel="Từ chối mẫu"
      confirmVariant="destructive"
    />
  );
};

export const CancelApprovalDialog = ({
  isOpen,
  templateName = 'Mẫu tài liệu',
  template_id,
  currentVersion = 1,
  onClose,
  onCancel,
}: ICancelApprovalDialogProps) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setError(null);
      setIsSubmitting(false);
      setIsSuccess(false);
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

  const handleCancel = async () => {
    if (isSubmitting || isSuccess) return;

    if (reason.trim().length < 10) {
      setError('Vui lòng nhập ít nhất 10 ký tự để lý do được lưu vết rõ ràng.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onCancel(template_id, reason.trim());
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo phiên bản mới');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ReasonDialogShell
      open={isOpen}
      title="Tạo phiên bản mới"
      description={`Tạo bản nháp v${currentVersion + 1} từ "${templateName}".`}
      icon={<FolderGit2 className="size-6" />}
      value={reason}
      onValueChange={setReason}
      placeholder="Nhập lý do cần tạo phiên bản mới."
      error={error}
      isSubmitting={isSubmitting}
      isSuccess={isSuccess}
      successTitle="Đã tạo phiên bản mới"
      successDescription={
        <div className="space-y-2">
          <div className="font-semibold">Bước tiếp theo</div>
          <ul className="list-disc space-y-1 pl-5">
            <li>Phiên bản nháp mới đã sẵn sàng để chỉnh sửa.</li>
            <li>Phiên bản đã duyệt hiện tại vẫn được lưu vết trong lịch sử.</li>
          </ul>
        </div>
      }
      onClose={onClose}
      onConfirm={handleCancel}
      confirmLabel="Tạo phiên bản mới"
      confirmVariant="default"
    />
  );
};
