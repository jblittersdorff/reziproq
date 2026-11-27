import { createFileRoute } from '@tanstack/react-router';
import { ProfileSheet } from '@/features/akte/akte-profile-sheet';

// AK-01 (K2-c.5): Blatt Profil über der Akte (Vorlage K2-Profil)
export const Route = createFileRoute('/_app/beziehungen/$id/profil')({
  component: function Profile() {
    const { id } = Route.useParams();
    return <ProfileSheet relationshipId={id} />;
  },
});
