import { createFileRoute } from '@tanstack/react-router';
import { TemplatesPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/templates/')({
  component: TemplatesPage,
});
