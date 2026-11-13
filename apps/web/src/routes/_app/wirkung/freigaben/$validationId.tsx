import { createFileRoute } from '@tanstack/react-router';
import { ValidationReviewPage } from '@/features/impact/validation-pages';

export const Route = createFileRoute('/_app/wirkung/freigaben/$validationId')({
  component: function Page() {
    const { validationId } = Route.useParams();
    return <ValidationReviewPage validationId={validationId} />;
  },
});
