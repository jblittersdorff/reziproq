import { createFileRoute } from '@tanstack/react-router';
import { ObjectiveCategoryFormPage } from '@/features/supplier-plan/objective-categories-pages';

export const Route = createFileRoute('/_app/einstellungen/zielkategorien/$key/bearbeiten')({
  component: function EditObjectiveCategory() {
    const { key } = Route.useParams();
    return <ObjectiveCategoryFormPage categoryKey={key} />;
  },
});
