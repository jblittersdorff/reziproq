import { createFileRoute } from '@tanstack/react-router';
import { DemoRegiePage } from '@/features/demo/demo-regie-page';

// DM-01 (K1-g.4): Demo-Regie, nur im Demo-Mandanten; ⌥D öffnet sie in einer Demo-Sitzung
export const Route = createFileRoute('/_app/demo')({
  component: DemoRegiePage,
});
