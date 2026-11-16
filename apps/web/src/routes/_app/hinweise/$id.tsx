import { createFileRoute } from '@tanstack/react-router';
import { HintPage } from '@/features/hints/hints-pages';

export const Route = createFileRoute('/_app/hinweise/$id')({
  component: function Hint() {
    const { id } = Route.useParams();
    return <HintPage hintId={id} />;
  },
});
