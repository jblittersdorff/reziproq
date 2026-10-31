import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/features/shell/app-layout';

// Layout aller Seiten mit Login: globale Leiste oben, Inhalt darunter (PLT-11).
export const Route = createFileRoute('/_app')({
  component: AppLayout,
});
