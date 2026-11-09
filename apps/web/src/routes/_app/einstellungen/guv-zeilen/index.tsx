import { createFileRoute } from '@tanstack/react-router';
import { PnlLinesPage } from '@/features/settings/pnl-lines-pages';

export const Route = createFileRoute('/_app/einstellungen/guv-zeilen/')({
  component: function Page() {
    return <PnlLinesPage />;
  },
});
