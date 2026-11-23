import { useQuery } from '@tanstack/react-query';
import { buildInitiativeBridge } from '@/components/charts/bridge';
import { PnlBridge } from '@/components/charts/pnl-bridge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Statement } from '@/features/insights/statement';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { securedResultsQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useMoney } from './portfolio-pages';

/**
 * AW-01 Ergebnisse · Gesichert (nach Vorlage W-Initiative und D-Diagramme): Aussage, Tinte-Karte
 * mit den Monaten, die noch auf das Controlling warten, Brücke nur aus bestätigten Werten mit
 * „Gesichert“ als Summe, Zeilenliste je Initiative. Andere Wirkungsarten als eigene Zeile.
 */
export function SecuredSection({
  relationshipId,
  fiscalYear,
}: {
  relationshipId: string;
  fiscalYear?: number | undefined;
}) {
  const t = useT();
  const text = t.insights;
  const money = useMoney();
  const token = useToken();
  const query = useQuery({
    ...securedResultsQueryOptions(token, relationshipId, fiscalYear),
    enabled: token !== '',
  });
  if (query.isError) return <ErrorState title={t.impact.portfolio.failed} />;
  const data = query.data;
  if (!data) return <LoadingState label={t.impact.portfolio.loading} />;
  const goal = data.target?.approved ? money.full(data.target.ebitTargetCents) : null;
  const steps = buildInitiativeBridge(
    data.steps.map((step) => ({
      label: step.title,
      amountCents: step.securedCents,
      maturity: step.maturity,
    })),
    t.impact.portfolio.total,
  );
  return (
    <section aria-label={text.securedTable} className="flex min-w-0 flex-col gap-6">
      <Statement statement={data.statement} />
      {data.pending.months > 0 && (
        <NextStep
          eyebrow={t.agents.nextStep}
          title={text.pendingTitle(data.pending.months)}
          text={text.pendingText(money.full(data.pending.amountCents), data.pending.initiatives)}
          action={
            <Button variant="mint" size="hero" asChild>
              {routerLink({
                href: '/wirkung/freigaben',
                className: '',
                children: (
                  <>
                    {text.pendingAction}
                    <NextStepArrow />
                  </>
                ),
              })}
            </Button>
          }
        />
      )}
      <PnlBridge
        title={text.securedTitle(money.full(data.securedEbitCents), goal)}
        description={text.securedSource(data.fiscalYear)}
        steps={steps}
        formatAxis={money.short}
        formatDelta={(step) =>
          step.maturity
            ? `${money.short(step.deltaCents)} · ${t.impact.portfolio.maturity(step.maturity)}`
            : money.short(step.deltaCents)
        }
        empty={{ title: text.securedEmpty, description: text.securedEmptyText }}
      />
      {data.steps.length > 0 && (
        <Table>
          <caption className="sr-only">{text.securedTable}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>{t.impact.portfolio.initiative}</TableHead>
              <TableHead className="text-right">{t.impact.portfolio.amount}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.steps.map((step) => (
              <TableRow key={step.initiativeId}>
                <TableCell>
                  {routerLink({
                    href: `/lieferanten/${relationshipId}/wirkung/initiativen/${step.initiativeId}`,
                    className:
                      'font-medium hover:underline focus-visible:underline focus-visible:outline-none',
                    children: step.title,
                  })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money.full(step.securedCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {data.others.length > 0 && (
        <p className="text-muted-foreground text-sm">
          {text.securedOthers}:{' '}
          {data.others
            .map(
              (other) => `${t.impact.effects[other.effectType]} ${money.full(other.securedCents)}`,
            )
            .join(' · ')}
        </p>
      )}
    </section>
  );
}
