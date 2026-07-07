import { createFileRoute } from '@tanstack/react-router';
import { TemplateVariableDocViewerPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/template-variable-docs/$docId')({
  component: TemplateVariableDocsRouteComponent,
});

function TemplateVariableDocsRouteComponent() {
  const { docId } = Route.useParams();

  return <TemplateVariableDocViewerPage docId={docId} />;
}
