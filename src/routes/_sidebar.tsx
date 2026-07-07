import { createFileRoute } from '@tanstack/react-router';
import { SidebarLayoutPage } from '../pages';

export const Route = createFileRoute('/_sidebar')({
  component: SidebarLayoutPage,
});
