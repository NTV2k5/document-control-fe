import { createFileRoute } from '@tanstack/react-router';
import { RecycleBinPage } from '../../../../pages';

export const Route = createFileRoute('/_sidebar/dashboard/recycle-bin/')({
  component: RecycleBinPage,
});
