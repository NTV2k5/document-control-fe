import { createFileRoute } from '@tanstack/react-router';
import { DocumentEditorPage } from '../../../pages';

const DocumentVariablesRouteComponent = () => {
  const { id } = Route.useParams();
  return <DocumentEditorPage document_id={id} workspaceMode />;
};

export const Route = createFileRoute('/_sidebar/documents/$id/variables')({
  component: DocumentVariablesRouteComponent,
});
