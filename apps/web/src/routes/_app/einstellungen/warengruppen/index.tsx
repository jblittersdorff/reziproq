import { createFileRoute } from '@tanstack/react-router';
import { MasterDataListPage } from '@/features/master-data/list-page';

export const Route = createFileRoute('/_app/einstellungen/warengruppen/')({
  component: function MaterialGroups() {
    return <MasterDataListPage kind="material-groups" />;
  },
});
