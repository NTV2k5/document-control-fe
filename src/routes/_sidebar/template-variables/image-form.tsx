import { createFileRoute } from '@tanstack/react-router';
import { TemplateVariablesPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/template-variables/image-form')({
  component: () => <TemplateVariablesPage variableType="image_form" />,
});
