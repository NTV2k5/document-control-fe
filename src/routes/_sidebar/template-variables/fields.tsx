import { createFileRoute } from '@tanstack/react-router';
import { TemplateVariablesPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/template-variables/fields')({
  component: () => <TemplateVariablesPage variableType="FIELD_VARIABLE" />,
});
