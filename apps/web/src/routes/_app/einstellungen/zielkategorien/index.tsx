import { createFileRoute } from '@tanstack/react-router';
import { ObjectiveCategoriesPage } from '@/features/supplier-plan/objective-categories-pages';

export const Route = createFileRoute('/_app/einstellungen/zielkategorien/')({
  component: ObjectiveCategoriesPage,
});
