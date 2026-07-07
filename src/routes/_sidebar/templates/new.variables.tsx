import { createFileRoute } from '@tanstack/react-router';
import { TemplateEditorPage } from '../../../pages';

const TemplateNewVariablesRouteComponent = () => {
  return <TemplateEditorPage workspaceMode />;
};

export const Route = createFileRoute('/_sidebar/templates/new/variables')({
  component: TemplateNewVariablesRouteComponent,
});
