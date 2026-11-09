import { createFileRoute } from '@tanstack/react-router';
import { JbpTopicImportPage } from '@/features/jbp/jbp-topic-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/themen/uebernehmen')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpTopicImportPage relationshipId={id} />;
  },
});
