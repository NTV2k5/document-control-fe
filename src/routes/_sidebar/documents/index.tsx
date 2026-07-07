import { createFileRoute } from '@tanstack/react-router';
import { DocumentsPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/documents/')({
  component: DocumentsPage,
});
