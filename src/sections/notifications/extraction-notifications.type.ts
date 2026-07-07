export enum NotificationEvent {
  EXTRACTION_COMPLETED = 'extraction_completed',
  EXTRACTION_FAILED = 'extraction_failed',
}

export interface INotificationEventPayload {
  auditLogId?: string;
  dagRunId?: string;
  error?: string;
}

export interface INotificationEvent {
  event: NotificationEvent;
  document_id: string;
  status: 'success' | 'failed';
  occurredAt: string;
  payload?: INotificationEventPayload;
}
