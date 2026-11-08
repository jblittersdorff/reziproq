import { createFileRoute } from '@tanstack/react-router';
import { RoundsPage } from '@/features/rounds/rounds-page';

export const Route = createFileRoute('/_app/portfolio/runden/')({
  component: RoundsPage,
});
