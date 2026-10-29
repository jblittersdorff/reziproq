import { createFileRoute } from '@tanstack/react-router';
import { RelationshipsPage } from '@/features/relationships/relationships-page';

export const Route = createFileRoute('/_app/beziehungen')({
  component: RelationshipsPage,
});
