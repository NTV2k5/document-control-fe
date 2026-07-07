import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { TemplateEditorPage } from '../../../pages';

const TemplateDetailRouteComponent = () => {
  const { id } = Route.useParams() as { id: string };
  const { pathname } = useLocation();

  if (pathname.endsWith('/variables')) {
    return <Outlet />;
  }

  return <TemplateEditorPage template_id={id} />;
};

export const Route = createFileRoute('/_sidebar/templates/$id')({
  component: TemplateDetailRouteComponent,
});
