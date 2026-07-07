import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { CookieService, CONFIGURATION } from 'reactjs-platform/utilities';
import { toast } from 'react-toastify';
import { buildUserNotificationsStreamUrl } from '../../api/notifications/notifications.api';
import { cn } from '../../lib';
import { useSSE } from '../../lib/sse/use-sse.hook';
import type { INotificationEvent } from './extraction-notifications.type';
import { NotificationEvent } from './extraction-notifications.type';

interface IExtractionNotificationToastProps {
  title: string;
  description: string;
  tone: 'success' | 'error';
  onOpen: () => void;
  closeToast?: () => void;
}

const ExtractionNotificationToast = ({
  title,
  description,
  tone,
  onOpen,
  closeToast,
}: IExtractionNotificationToastProps) => (
  <button
    type="button"
    onClick={() => {
      onOpen();
      closeToast?.();
    }}
    className={cn(
      'group flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2',
      tone === 'success'
        ? 'border-emerald-200 bg-white text-slate-900 focus:ring-emerald-300'
        : 'border-rose-200 bg-white text-slate-900 focus:ring-rose-300',
    )}>
    <span
      className={cn(
        'mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
        tone === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
      )}>
      {tone === 'success' ? '✓' : '!'}
    </span>

    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
        <span>Mở tài liệu</span>
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </span>
  </button>
);

export const ExtractionNotificationsSection = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const accessToken = CookieService.getItem<string>(CONFIGURATION.ACCESS_TOKEN_LS_KEY) || '';
  const url = accessToken ? buildUserNotificationsStreamUrl() : null;

  const openDocument = useCallback(
    (document_id: string) => {
      void navigate({ to: '/documents/$id', params: { id: document_id } });
    },
    [navigate],
  );

  const onMessage = useCallback(
    (event: INotificationEvent) => {
      if (location.pathname.startsWith(`/documents/${event.document_id}`)) {
        return;
      }

      const toastId = `document-extraction:${event.event}:${event.document_id}:${event.payload?.dagRunId ?? event.occurredAt}`;

      if (event.event === NotificationEvent.EXTRACTION_COMPLETED) {
        toast.success(
          ({ closeToast }) => (
            <ExtractionNotificationToast
              title="Tài liệu đã được cập nhật"
              description="Hệ thống đã xử lý xong nội dung từ file Word. Nhấn để mở tài liệu này."
              tone="success"
              onOpen={() => openDocument(event.document_id)}
              closeToast={closeToast}
            />
          ),
          {
            toastId,
            autoClose: 8000,
            closeButton: false,
            closeOnClick: false,
            icon: false,
            className: '!min-h-0 !bg-transparent !p-0 !shadow-none',
          },
        );
      } else if (event.event === NotificationEvent.EXTRACTION_FAILED) {
        const description = event.payload?.error?.trim()
          ? `Hệ thống chưa thể xử lý tài liệu: ${event.payload.error}. Nhấn để mở tài liệu và kiểm tra lại.`
          : 'Hệ thống chưa thể xử lý tài liệu. Nhấn để mở tài liệu và kiểm tra lại.';

        toast.error(
          ({ closeToast }) => (
            <ExtractionNotificationToast
              title="Xử lý tài liệu chưa thành công"
              description={description}
              tone="error"
              onOpen={() => openDocument(event.document_id)}
              closeToast={closeToast}
            />
          ),
          {
            toastId,
            autoClose: 10000,
            closeButton: false,
            closeOnClick: false,
            icon: false,
            className: '!min-h-0 !bg-transparent !p-0 !shadow-none',
          },
        );
      }
    },
    [location.pathname, openDocument],
  );

  useSSE<INotificationEvent>(url, { onMessage });

  return null;
};
