import { cycleStatusQuerySchema } from '@reziproq/shared';
import { createFileRoute } from '@tanstack/react-router';
import { CycleStatusPage } from '@/features/portfolio/cycle-status-page';

// ZYK-04: Filter und Sortierung stehen in der Adresse.
export const Route = createFileRoute('/_app/portfolio/zyklen')({
  validateSearch: cycleStatusQuerySchema,
  component: CycleStatusPage,
});
