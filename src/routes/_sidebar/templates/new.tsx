import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { TemplateEditorPage } from '../../../pages';

const TemplateCreateRouteComponent = () => {
  const { pathname } = useLocation();

  if (pathname.endsWith('/variables')) {
    return <Outlet />;
  }

  return <TemplateEditorPage />;
};

export const Route = createFileRoute('/_sidebar/templates/new')({
  component: TemplateCreateRouteComponent,
});
