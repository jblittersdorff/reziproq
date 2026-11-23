import { createFileRoute } from '@tanstack/react-router';
import { ImportBatchPage } from '@/features/imports/import-pages';

export const Route = createFileRoute('/_app/einstellungen/daten/import/$batchId')({
  component: function Page() {
    const { batchId } = Route.useParams();
    return <ImportBatchPage key={batchId} batchId={batchId} />;
  },
});
