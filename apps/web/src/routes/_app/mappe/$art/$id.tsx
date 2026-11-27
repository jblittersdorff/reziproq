import { createFileRoute } from '@tanstack/react-router';
import { MailDraftPage } from '@/features/postfach/mail-draft-page';
import { MapPage } from '@/features/today/map-page';

// HE-01 Fokus-Mappe (K1-e.4); die Art im Pfad nennt, worum es geht (z. B. freigabe, hinweis).
// PO-01 (K2-d.3b): Zusagen aus einer Mail haben eine eigene Seite zum Entwurf (/mappe/mail/<Entwurf>)
export const Route = createFileRoute('/_app/mappe/$art/$id')({
  component: function FocusFolder() {
    const { art, id } = Route.useParams();
    return art === 'mail' ? <MailDraftPage key={id} draftId={id} /> : <MapPage id={id} />;
  },
});
