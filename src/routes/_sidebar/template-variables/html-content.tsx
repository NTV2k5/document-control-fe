import { createFileRoute } from '@tanstack/react-router';
import { TemplateVariablesPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/template-variables/html-content')({
  component: () => <TemplateVariablesPage variableType="HTML_CONTENT_VARIABLE" />,
});
