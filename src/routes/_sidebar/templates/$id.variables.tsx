import { createFileRoute } from '@tanstack/react-router';
import { TemplateEditorPage } from '../../../pages';

const TemplateVariablesRouteComponent = () => {
  const { id } = Route.useParams() as { id: string };
  return <TemplateEditorPage template_id={id} workspaceMode />;
};

export const Route = createFileRoute('/_sidebar/templates/$id/variables')({
  component: TemplateVariablesRouteComponent,
});
