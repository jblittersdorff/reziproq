import { createFileRoute } from '@tanstack/react-router';
import { AppearancePage } from '@/features/profile/appearance-page';

export const Route = createFileRoute('/_app/profil/erscheinungsbild')({
  component: AppearancePage,
});
