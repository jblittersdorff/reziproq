import { createFileRoute } from '@tanstack/react-router';
import { StartPage } from '@/features/start/start-page';
// NAV-10 2.0: Heute für Käufer und Lieferanten; bis K1-e beim Käufer Mein Tag, beim Lieferanten der
// Start (LIF-02, LP-01 folgt mit K5-b).
export const Route = createFileRoute('/_app/heute')({ component: StartPage });
