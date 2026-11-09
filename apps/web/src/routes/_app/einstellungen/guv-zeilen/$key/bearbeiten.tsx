import { createFileRoute } from '@tanstack/react-router';
import { PnlLineFormPage } from '@/features/settings/pnl-lines-pages';

export const Route = createFileRoute('/_app/einstellungen/guv-zeilen/$key/bearbeiten')({
  component: function Page() {
    const { key } = Route.useParams();
    return <PnlLineFormPage categoryKey={key} />;
  },
});
