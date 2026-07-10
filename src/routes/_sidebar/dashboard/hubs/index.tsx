import { createFileRoute } from '@tanstack/react-router';
import { UniversityHubsPage } from '../../../../pages';

export const Route = createFileRoute('/_sidebar/dashboard/hubs/')({
  component: UniversityHubsPage,
});
