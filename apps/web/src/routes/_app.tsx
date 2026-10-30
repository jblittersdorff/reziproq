import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/features/shell/app-layout';

// Layout aller Seiten mit Login: Seitenleiste links, Inhalt rechts.
export const Route = createFileRoute('/_app')({
  component: AppLayout,
});
