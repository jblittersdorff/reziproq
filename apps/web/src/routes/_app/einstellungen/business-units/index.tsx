import { createFileRoute } from '@tanstack/react-router';
import { MasterDataListPage } from '@/features/master-data/list-page';

export const Route = createFileRoute('/_app/einstellungen/business-units/')({
  component: function BusinessUnits() {
    return <MasterDataListPage kind="business-units" />;
  },
});
