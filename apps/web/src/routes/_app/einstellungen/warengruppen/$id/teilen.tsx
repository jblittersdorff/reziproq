import { createFileRoute } from '@tanstack/react-router';
import { SplitMaterialGroupPage } from '@/features/material-groups/settings-pages';

export const Route = createFileRoute('/_app/einstellungen/warengruppen/$id/teilen')({
  component: function Split() {
    const { id } = Route.useParams();
    return <SplitMaterialGroupPage id={id} />;
  },
});
