import { createFileRoute } from '@tanstack/react-router';
import { MyActionsPage } from '@/features/actions/action-pages';

export const Route = createFileRoute('/_app/start/massnahmen')({
  component: MyActionsPage,
});
