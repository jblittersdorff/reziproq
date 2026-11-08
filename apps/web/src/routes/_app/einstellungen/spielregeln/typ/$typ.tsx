import { createFileRoute } from '@tanstack/react-router';
import { PreviewPage } from '@/features/playbook/preview-page';

export const Route = createFileRoute('/_app/einstellungen/spielregeln/typ/$typ')({
  component: function Page() {
    const { typ } = Route.useParams();
    return <PreviewPage key={typ} type={typ} />;
  },
});
