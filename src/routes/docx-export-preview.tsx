import { createFileRoute } from '@tanstack/react-router';
import { DocxExportPreviewPage } from '../pages';

export const Route = createFileRoute('/docx-export-preview')({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === 'string' ? search.id : '',
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useSearch();

  return <DocxExportPreviewPage payloadId={id} />;
}
