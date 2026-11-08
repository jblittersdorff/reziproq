import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { MatrixPage } from '@/features/portfolio/matrix-page';

export const Route = createFileRoute('/_app/portfolio/matrix')({
  validateSearch: z.object({ bu: z.uuid().optional(), wg: z.uuid().optional() }),
  component: MatrixPage,
});
