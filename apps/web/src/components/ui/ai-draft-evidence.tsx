import type { AiDraft, DraftSource } from '@reziproq/shared';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

function linkOf(relationshipId: string, source: DraftSource) {
  if (source.kind === 'public') return source.url;
  const base = `/lieferanten/${relationshipId}`;
  switch (source.objectType) {
    case 'meeting':
      return `${base}/umsetzung/termine/${source.objectId}`;
    case 'survey_wave':
      return `${base}/beziehung/feedback/${source.objectId}`;
    case 'segmentation_round':
      return `${base}/strategie/segmentierung`;
    case 'supplier_plan':
      return `${base}/strategie/lieferantenplan`;
    case 'supplier_spend':
      return `${base}/strategie/spend`;
    case 'supplier_context':
      return base;
    case 'supplier_profile':
      return `${base}/strategie/profil`;
    default:
      return null;
  }
}

/** Die Quellen gehören zum Originalentwurf und bleiben auch nach einer Bearbeitung sichtbar. */
export function AiDraftEvidence({
  claims,
  relationshipId,
}: {
  claims: NonNullable<AiDraft['claims']>;
  relationshipId: string;
}) {
  const t = useT().draftEvidence;
  const format = useFormat();
  return (
    <ul className="grid gap-2 text-sm">
      {claims.map((claim) => (
        <li key={claim.key}>
          {claim.thinlySupported && <p className="font-medium text-muted-foreground">{t.thin}</p>}
          <ul className="flex flex-wrap gap-2">
            {claim.sources.map((source) => {
              const href = linkOf(relationshipId, source);
              const label =
                t.sourceNames[source.objectType as keyof typeof t.sourceNames] ?? source.title;
              return (
                <li key={source.id} className="max-w-full">
                  <details className="rounded-lg bg-line-soft px-3">
                    <summary className="min-h-11 cursor-pointer content-center font-medium">
                      {label}
                    </summary>
                    <p className="text-muted-foreground">{claim.text}</p>
                    {source.publishedAt && <p>{format.date(source.publishedAt)}</p>}
                    {source.excerpt && <p>{source.excerpt}</p>}
                    {href && (
                      <a className="inline-flex min-h-11 items-center underline" href={href}>
                        {t.open}
                      </a>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
