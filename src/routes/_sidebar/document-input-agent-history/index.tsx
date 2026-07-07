import { createFileRoute } from '@tanstack/react-router';
import { DocumentInputAgentHistoryPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/document-input-agent-history/')({
  component: DocumentInputAgentHistoryPage,
});
