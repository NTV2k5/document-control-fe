import { createFileRoute } from '@tanstack/react-router';
import { SplashScreenPage } from '../pages';

export const Route = createFileRoute('/')({
  component: SplashScreenPage,
});
