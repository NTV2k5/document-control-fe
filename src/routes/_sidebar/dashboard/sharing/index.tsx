import { createFileRoute } from '@tanstack/react-router';
import { SharingPage } from '../../../../pages';

export const Route = createFileRoute('/_sidebar/dashboard/sharing/')({
  component: SharingPage,
});
