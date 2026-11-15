import { createFileRoute } from '@tanstack/react-router';
import { FiscalYearSettingsPage } from '@/features/impact/portfolio-pages';

export const Route = createFileRoute('/_app/einstellungen/geschaeftsjahr')({
  component: FiscalYearSettingsPage,
});
