import { createFileRoute } from '@tanstack/react-router';
import { TemplateVariableDocsPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/template-variable-docs/')({
  component: TemplateVariableDocsPage,
});
