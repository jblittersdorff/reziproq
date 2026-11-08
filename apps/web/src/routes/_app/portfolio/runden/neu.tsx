import { createFileRoute } from '@tanstack/react-router';
import { RoundNamePage } from '@/features/rounds/round-wizard';

export const Route = createFileRoute('/_app/portfolio/runden/neu')({
  component: () => <RoundNamePage />,
});
