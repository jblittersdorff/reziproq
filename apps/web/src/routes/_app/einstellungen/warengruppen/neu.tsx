import { createFileRoute } from '@tanstack/react-router';
import { MasterDataEntryPage } from '@/features/master-data/entry-page';

export const Route = createFileRoute('/_app/einstellungen/warengruppen/neu')({
  component: function NewMaterialGroups() {
    return <MasterDataEntryPage kind="material-groups" />;
  },
});
