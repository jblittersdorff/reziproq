import { createFileRoute } from '@tanstack/react-router';
import { JbpTopicFormPage } from '@/features/jbp/jbp-topic-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/themen/neu')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpTopicFormPage place={{ side: 'supplier', relationshipId: id }} />;
  },
});
