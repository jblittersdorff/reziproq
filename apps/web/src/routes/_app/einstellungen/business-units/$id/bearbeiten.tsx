import { createFileRoute } from '@tanstack/react-router';
import { MasterDataEntryPage } from '@/features/master-data/entry-page';

export const Route = createFileRoute('/_app/einstellungen/business-units/$id/bearbeiten')({
  component: function EditBusinessUnits() {
    const { id } = Route.useParams();
    return <MasterDataEntryPage key={id} kind="business-units" id={id} />;
  },
});
