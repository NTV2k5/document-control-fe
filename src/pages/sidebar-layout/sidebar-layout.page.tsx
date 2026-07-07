import { Outlet } from '@tanstack/react-router';
import { MainLayout } from '../../components';

export const SidebarLayoutPage = () => (
  <MainLayout>
    <Outlet />
  </MainLayout>
);
