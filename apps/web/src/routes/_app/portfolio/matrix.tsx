import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { MatrixPage } from '@/features/portfolio/matrix-page';

export const Route = createFileRoute('/_app/portfolio/matrix')({
  // WG-18: ansicht schaltet bei gefilterter Warengruppe zwischen Ist, Soll und beidem.
  validateSearch: z.object({
    bu: z.uuid().optional(),
    wg: z.uuid().optional(),
    ansicht: z.enum(['ist', 'soll', 'both']).optional(),
  }),
  component: MatrixPage,
});
