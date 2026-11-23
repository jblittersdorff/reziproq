import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { buttonVariants } from '@/components/ui/button';
import { ListCard, ListCardHeader } from '@/components/ui/list-card';
import { Monogram } from '@/components/ui/monogram';
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { hintsQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { isActive, SeverityBadge, useHintWhy } from './hint-panel';

/**
 * „Wo du handeln musst“ (KI-16, nach Main.neu.dc.html): höchstens vier offene Hinweise der eigenen
 * Beziehungen nach score, je Zeile Kreis, Titel, Schwere als Text, Lieferant und nächster Schritt.
 * relationshipId: nur die Hinweise eines Lieferanten (Überblick, ohne Beschränkung auf eigene).
 */
export function HintsAttention({
  relationshipId,
  limit = 4,
}: {
  relationshipId?: string;
  limit?: number;
}) {
  const t = useT();
  const text = t.hints;
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const allowed = useCan('hinweise.sehen');
  const query = useQuery({
    ...hintsQueryOptions(accessToken),
    enabled: accessToken !== '' && allowed,
  });
  const why = useHintWhy();
  if (!allowed || !query.data) return null;
  const open = query.data.hints.filter(
    (hint) =>
      isActive(hint) && (relationshipId ? hint.relationshipId === relationshipId : hint.isOwn),
  );
  // Auf der Seite des Lieferanten nur, wenn es etwas gibt
  if (relationshipId && open.length === 0) return null;
  const headingId = relationshipId ? `hinweise-${relationshipId}` : 'start-hinweise';
  return (
    <ListCard data-slot="hints-attention" aria-labelledby={headingId}>
      <ListCardHeader id={headingId} title={relationshipId ? text.supplierHints : text.actTitle} />
      {open.length === 0 ? (
        <p className="px-5.5 pb-5.5 text-muted-foreground">{text.actEmpty}</p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col divide-y divide-line-soft">
          {open.slice(0, limit).map((hint) => {
            const supplier = hint.supplier ?? text.organization;
            const title = why(hint);
            return (
              <li key={hint.id} className="flex items-start gap-3 px-5.5 py-3">
                <Monogram name={supplier} tone={hint.isFocus ? 'shared' : 'neutral'} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {routerLink({
                    href: `/hinweise?hinweis=${hint.id}`,
                    className:
                      'font-semibold text-sm text-text no-underline hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    children: title,
                  })}
                  <span className="flex flex-wrap items-center gap-2 text-muted-foreground text-chip">
                    <SeverityBadge hint={hint} />
                    {!relationshipId && <span>{supplier}</span>}
                  </span>
                  {routerLink({
                    href: hint.href,
                    className: cn(
                      'inline-flex min-h-11 items-center gap-1 self-start font-semibold text-petrol-dark text-sm no-underline hover:underline',
                    ),
                    'aria-label': `${text.nextSteps[hint.ruleKey]}: ${title}`,
                    children: (
                      <>
                        {text.nextSteps[hint.ruleKey]}
                        <ArrowRightIcon aria-hidden className="size-4" />
                      </>
                    ),
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-col gap-1 border-line-soft border-t px-5.5 py-3">
        {routerLink({
          href: '/hinweise',
          className: cn(buttonVariants({ variant: 'link' }), 'self-start px-0 has-[>svg]:px-0'),
          children: (
            <>
              {text.allHints}
              <ArrowRightIcon aria-hidden />
            </>
          ),
        })}
        {!relationshipId && <p className="text-muted-foreground text-chip">{text.attentionNote}</p>}
      </div>
    </ListCard>
  );
}
