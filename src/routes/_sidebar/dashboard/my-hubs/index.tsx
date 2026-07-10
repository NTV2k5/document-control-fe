import { createFileRoute } from '@tanstack/react-router';
import { MyHubsPage } from '../../../../pages';

export const Route = createFileRoute('/_sidebar/dashboard/my-hubs/')({
  component: MyHubsPage,
});
