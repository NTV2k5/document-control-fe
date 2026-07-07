import { createFileRoute } from '@tanstack/react-router';
import { TemplateVariableEditorPage } from '../../../pages';

type TTemplateVariableEditorSearchType = 'DOCUMENT_VARIABLE' | 'TABLE_VARIABLE';

const normalizeVariableType = (value: unknown): TTemplateVariableEditorSearchType =>
  value === 'DOCUMENT_VARIABLE' ? 'DOCUMENT_VARIABLE' : 'TABLE_VARIABLE';

const TemplateVariableDetailRouteComponent = () => {
  const { id } = Route.useParams() as { id: string };
  const search = Route.useSearch();

  return <TemplateVariableEditorPage variableId={id} variableType={search.variable_type} />;
};

export const Route = createFileRoute('/_sidebar/template-variables/$id')({
  validateSearch: (search: Record<string, unknown>) => ({
    variable_type: normalizeVariableType(search.variable_type),
  }),
  component: TemplateVariableDetailRouteComponent,
});
