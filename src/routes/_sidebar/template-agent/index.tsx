import { createFileRoute } from '@tanstack/react-router';
import { TemplateAgentPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/template-agent/')({
  component: TemplateAgentPage,
});
