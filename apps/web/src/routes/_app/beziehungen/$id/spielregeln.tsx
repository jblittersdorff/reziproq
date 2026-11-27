import { createFileRoute } from '@tanstack/react-router';
import { RulesSheet } from '@/features/akte/akte-rules-sheet';

// AK-01 (K2-c.5): Blatt Spielregeln über der Akte (Rechte, Pflichten, Formate)
export const Route = createFileRoute('/_app/beziehungen/$id/spielregeln')({
  component: function Rules() {
    const { id } = Route.useParams();
    return <RulesSheet relationshipId={id} />;
  },
});
