import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { DocumentEditorPage } from '../../../pages';

const DocumentDetailRouteComponent = () => {
  const { id } = Route.useParams();
  const { pathname } = useLocation();

  if (pathname.endsWith('/variables')) {
    return <Outlet />;
  }

  return <DocumentEditorPage document_id={id} />;
};

export const Route = createFileRoute('/_sidebar/documents/$id')({
  component: DocumentDetailRouteComponent,
});
