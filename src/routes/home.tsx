import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '../pages';

export const Route = createFileRoute('/home')({
  component: HomePage,
});
