import { createFileRoute } from '@tanstack/react-router';
import { ImpactPage } from '@/features/impact/impact-page';

export const Route = createFileRoute('/_app/wirkung/')({
  component: ImpactPage,
});
