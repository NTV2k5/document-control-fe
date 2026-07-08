import { createFileRoute } from '@tanstack/react-router';
import { TicketsPage } from '../../../../pages';

export const Route = createFileRoute('/_sidebar/dashboard/tickets/')({
  component: TicketsPage,
});
