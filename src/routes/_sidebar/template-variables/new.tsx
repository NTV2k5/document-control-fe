import { createFileRoute } from '@tanstack/react-router';
import { TemplateVariableEditorPage } from '../../../pages';

type TTemplateVariableEditorSearchType = 'DOCUMENT_VARIABLE' | 'TABLE_VARIABLE';

const normalizeVariableType = (value: unknown): TTemplateVariableEditorSearchType =>
  value === 'DOCUMENT_VARIABLE' ? 'DOCUMENT_VARIABLE' : 'TABLE_VARIABLE';

const TemplateVariableCreateRouteComponent = () => {
  const search = Route.useSearch();

  return (
    <TemplateVariableEditorPage
      variableType={search.variable_type}
      documentMode={search.document_mode ?? 'structured'}
    />
  );
};

export const Route = createFileRoute('/_sidebar/template-variables/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    variable_type: normalizeVariableType(search.variable_type),
    ...(search.document_mode === 'raw_html' ? { document_mode: 'raw_html' as const } : {}),
  }),
  component: TemplateVariableCreateRouteComponent,
});
