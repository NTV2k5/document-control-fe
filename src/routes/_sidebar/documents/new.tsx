import { createFileRoute } from '@tanstack/react-router';
import { NewDocumentPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/documents/new')({
  component: NewDocumentPage,
});
