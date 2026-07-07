import { createFileRoute } from '@tanstack/react-router';
import { ReportsDashboardPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/dashboard/')({
  component: ReportsDashboardPage,
});
