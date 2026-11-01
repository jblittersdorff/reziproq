import { createFileRoute } from '@tanstack/react-router';
import { MasterDataEntryPage } from '@/features/master-data/entry-page';

export const Route = createFileRoute('/_app/einstellungen/warengruppen/$id/bearbeiten')({
  component: function EditMaterialGroups() {
    const { id } = Route.useParams();
    return <MasterDataEntryPage key={id} kind="material-groups" id={id} />;
  },
});
