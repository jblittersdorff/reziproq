import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { useMessages } from '@/lib/i18n';
import { akteSheetMessages } from './akte-sheet-messages';
import type { AkteViewKey } from './akte-view';

/**
 * Blatt über der Akte (AK-01, K2-c.5; erlaubt nach E-K0-01): 620 px von rechts, Esc schließt, mobil
 * volle Seite. Die Akte bleibt dahinter in derselben Sicht; Schließen führt dorthin zurück.
 */
export function AkteSheet({
  relationshipId,
  title,
  subtitle,
  children,
}: {
  relationshipId: string;
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const search = useSearch({ from: '/_app/beziehungen/$id' });
  const text = useMessages(akteSheetMessages);
  return (
    <Sheet
      open
      onClose={() =>
        void navigate({ to: '/beziehungen/$id', params: { id: relationshipId }, search })
      }
      title={title}
      {...(subtitle ? { subtitle } : {})}
      closeLabel={text.close}
    >
      {children}
    </Sheet>
  );
}

/** Adresse eines Blatts mit der Sicht dahinter, z. B. /beziehungen/<id>/profil?sicht=privat#team */
export function sheetHref(
  relationshipId: string,
  path: string,
  view: AkteViewKey = 'gemeinsam',
  hash = '',
): string {
  const search = view === 'gemeinsam' ? '' : `?sicht=${view}`;
  return `/beziehungen/${relationshipId}/${path}${search}${hash ? `#${hash}` : ''}`;
}
