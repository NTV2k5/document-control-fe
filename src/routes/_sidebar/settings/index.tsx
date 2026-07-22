import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/settings/')({
  component: SettingsPage,
});
