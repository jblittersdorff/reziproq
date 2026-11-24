import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { DuePage } from '@/features/start/due-page';

export const Route = createFileRoute('/_app/start/faellig')({
  // ?ansicht=wartet: Zusagen, Beiträge und Maßnahmen anderer (Vorlage Aufgaben.dc.html)
  validateSearch: z.object({ ansicht: z.enum(['wartet']).optional() }),
  component: function Due() {
    const { ansicht } = Route.useSearch();
    return <DuePage view={ansicht === 'wartet' ? 'waiting' : 'mine'} />;
  },
});
