import { createFileRoute } from '@tanstack/react-router';
import { OpenAiSettingsPage } from '../../../pages';

export const Route = createFileRoute('/_sidebar/settings/')({
  component: OpenAiSettingsPage,
});
