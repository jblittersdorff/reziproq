import type { SupplierOverview } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { NextCard } from '@/components/ui/next-card';
import { useHintWhy } from '@/features/hints/hint-panel';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { NextActionCard, shortDate } from '@/features/start/next-action';
import { nextActionQueryOptions, supplierRingsQueryOptions } from '@/lib/api';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { currentStepIndex } from './phases';
import { supplierMessages } from './supplier-messages';

/**
 * „Als Nächstes“ im Überblick des Lieferanten (NAV-10 1.1, `next_action` scope relationship):
 * zuerst die fälligste Aufgabe der Person bei diesem Lieferanten, dann ein Hinweis hoher Schwere,
 * dann der Jahreszyklus (starten, JBP-Termin, nächster Zyklus, aktueller Schritt), zuletzt der
 * wichtigste übrige Hinweis. Ohne Kandidat keine Karte.
 */
export function SupplierNextCard({
  relationshipId,
  overview,
}: {
  relationshipId: string;
  /** Ohne Überblick (Fehler) zählen nur Aufgaben und Hinweise, nicht der Zyklus. */
  overview: SupplierOverview | undefined;
}) {
  const t = useT();
  const text = useMessages(supplierMessages).next;
  const { locale } = useLocale();
  const accessToken = useToken();
  const hintWhy = useHintWhy();
  const enabled = accessToken !== '';
  const next = useQuery({ ...nextActionQueryOptions(accessToken, relationshipId), enabled });
  const rings = useQuery({ ...supplierRingsQueryOptions(accessToken, relationshipId), enabled });
  // Erst entscheiden, wenn beide Quellen geantwortet haben; sonst springt die Karte um.
  if (next.isPending || rings.isPending) return null;
  if (next.data?.next) return <NextActionCard next={next.data.next} />;

  const base = `/lieferanten/${relationshipId}`;
  const cycle = overview?.cycle ?? null;
  const kicker = cycle?.jbpDate ? text.kickerJbp(shortDate(locale, cycle.jbpDate)) : text.kicker;
  const risk = rings.data?.risk ?? null;
  const hintCard = risk && (
    <NextCard
      kicker={`${text.kicker} · ${t.hints.severityOf(t.hints.severities[risk.severity])}`}
      title={hintWhy({ ruleKey: risk.ruleKey, detail: risk.detail })}
      text={t.hints.nextSteps[risk.ruleKey]}
      action={{ label: text.hint, href: `/warum/${risk.hintId}` }}
      renderLink={routerLink}
    />
  );
  if (risk?.severity === 'high') return hintCard;

  if (overview && !cycle && overview.head.isFocus && overview.canStartCycle) {
    return (
      <NextCard
        kicker={text.kicker}
        title={text.startCycle.title}
        text={text.startCycle.text}
        action={{ label: text.startCycle.action, href: `${base}/zyklus/start` }}
        renderLink={routerLink}
      />
    );
  }
  if (cycle && !cycle.jbpDate && overview?.canSetJbpDate) {
    return (
      <NextCard
        kicker={kicker}
        title={text.setDate.title}
        text={text.setDate.text}
        action={{ label: text.setDate.action, href: `${base}/zyklus/termin` }}
        renderLink={routerLink}
      />
    );
  }
  if (cycle && overview?.canStartNextCycle) {
    return (
      <NextCard
        kicker={kicker}
        title={text.nextCycle.title}
        text={text.nextCycle.text}
        action={{ label: text.nextCycle.action, href: `${base}/zyklus/neu` }}
        renderLink={routerLink}
      />
    );
  }
  const step = cycle ? cycle.steps[currentStepIndex(cycle)] : undefined;
  if (step?.href) {
    return (
      <NextCard
        kicker={kicker}
        title={t.workspace.cycle.actions[step.key]}
        text={text.stepText(t.workspace.cycle.steps[step.key])}
        action={{ label: text.step, href: step.href }}
        renderLink={routerLink}
      />
    );
  }
  return hintCard || null;
}
