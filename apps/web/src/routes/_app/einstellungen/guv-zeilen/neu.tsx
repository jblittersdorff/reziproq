import { createFileRoute } from '@tanstack/react-router';
import { PnlLineFormPage } from '@/features/settings/pnl-lines-pages';

export const Route = createFileRoute('/_app/einstellungen/guv-zeilen/neu')({
  component: function Page() {
    return <PnlLineFormPage />;
  },
});
