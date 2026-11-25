import { createFileRoute } from '@tanstack/react-router';
import { DonePage } from '@/features/today/done-page';

// HE-01 Erledigt im Hintergrund (K1-e.3)
export const Route = createFileRoute('/_app/erledigt')({ component: DonePage });
