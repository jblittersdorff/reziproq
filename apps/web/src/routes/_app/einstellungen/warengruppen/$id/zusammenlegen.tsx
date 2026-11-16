import { createFileRoute } from '@tanstack/react-router';
import { MergeMaterialGroupPage } from '@/features/material-groups/settings-pages';

export const Route = createFileRoute('/_app/einstellungen/warengruppen/$id/zusammenlegen')({
  component: function Merge() {
    const { id } = Route.useParams();
    return <MergeMaterialGroupPage id={id} />;
  },
});
