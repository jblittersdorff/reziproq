import { createFileRoute } from '@tanstack/react-router';
import { MasterDataEntryPage } from '@/features/master-data/entry-page';

export const Route = createFileRoute('/_app/einstellungen/business-units/neu')({
  component: function NewBusinessUnits() {
    return <MasterDataEntryPage kind="business-units" />;
  },
});
