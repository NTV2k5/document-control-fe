import { createFileRoute } from '@tanstack/react-router';
import { TemplateVariablesPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/template-variables/powerpoint')({
  component: () => <TemplateVariablesPage variableType="presentation" />,
});
