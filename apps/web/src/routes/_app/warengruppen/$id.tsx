import { createFileRoute } from '@tanstack/react-router';
import { MaterialGroupPage } from '@/features/material-groups/material-groups-pages';

export const Route = createFileRoute('/_app/warengruppen/$id')({
  component: function MaterialGroup() {
    const { id } = Route.useParams();
    return <MaterialGroupPage key={id} id={id} />;
  },
});
