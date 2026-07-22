import { createFileRoute } from '@tanstack/react-router';
import { SharedPage } from '../../../../pages';

export const Route = createFileRoute('/_sidebar/dashboard/shared/')({
  component: SharedPage,
});
