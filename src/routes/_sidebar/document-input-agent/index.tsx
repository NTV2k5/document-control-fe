import { createFileRoute } from '@tanstack/react-router';
import { DocumentInputAgentPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/document-input-agent/')({
  component: DocumentInputAgentPage,
});
