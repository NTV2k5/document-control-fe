import { createFileRoute } from '@tanstack/react-router';
import { TemplateVariablesPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/template-variables/documents')({
  component: () => <TemplateVariablesPage variableType="DOCUMENT_VARIABLE" />,
});
