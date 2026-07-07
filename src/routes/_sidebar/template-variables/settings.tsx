import { createFileRoute } from '@tanstack/react-router';
import { TemplateVariablesPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/template-variables/settings')({
  component: () => <TemplateVariablesPage variableType="settings" />,
});
