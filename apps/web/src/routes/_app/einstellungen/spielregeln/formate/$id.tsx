import { createFileRoute } from '@tanstack/react-router';
import { FormatFormPage } from '@/features/playbook/formats-pages';

export const Route = createFileRoute('/_app/einstellungen/spielregeln/formate/$id')({
  component: function Page() {
    const { id } = Route.useParams();
    return <FormatFormPage key={id} id={id} />;
  },
});
