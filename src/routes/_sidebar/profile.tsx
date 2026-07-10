import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '../../pages';

export const Route = createFileRoute('/_sidebar/profile')({
  component: ProfilePage,
});
