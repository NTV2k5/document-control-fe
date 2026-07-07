import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_sidebar/openai/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings' });
  },
});
