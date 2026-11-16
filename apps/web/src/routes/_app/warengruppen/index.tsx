import { createFileRoute } from '@tanstack/react-router';
import { MaterialGroupsPage } from '@/features/material-groups/material-groups-pages';

export const Route = createFileRoute('/_app/warengruppen/')({
  component: MaterialGroupsPage,
});
