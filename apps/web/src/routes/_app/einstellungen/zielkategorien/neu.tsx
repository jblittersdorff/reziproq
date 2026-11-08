import { createFileRoute } from '@tanstack/react-router';
import { ObjectiveCategoryFormPage } from '@/features/supplier-plan/objective-categories-pages';

export const Route = createFileRoute('/_app/einstellungen/zielkategorien/neu')({
  component: function NewObjectiveCategory() {
    return <ObjectiveCategoryFormPage />;
  },
});
