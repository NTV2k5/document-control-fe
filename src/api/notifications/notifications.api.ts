import { buildSseUrl } from '../../lib/sse/use-sse.hook';

export const buildUserNotificationsStreamUrl = (): string => buildSseUrl('/notifications/stream');

export const buildDocumentExtractionStreamUrl = (document_id: string): string =>
  buildSseUrl(`/notifications/documents/${document_id}/stream`);
