import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { GoalRings } from '@/components/ui/goal-rings';
import { Input } from '@/components/ui/input';
import { EvidenceCard, EvidenceRow, QuestionSuggestions } from '@/components/ui/insight';
import { ListCard } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { Tile } from '@/components/ui/tile';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import {
  approveSupplierTarget,
  overviewInsightQueryOptions,
  proposeSupplierTarget,
  saveEbitGoal,
  supplierRingsQueryOptions,
  valueOverviewQueryOptions,
} from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { Statement } from './statement';
import { formatMoney } from '@/lib/money';

function useAmount() {
  const { locale } = useLocale();
  return (cents: number, currency = 'EUR') =>
    formatMoney({ amountCents: cents, currency }, locale, { compact: true });
}

/** Betrag in Euro aus dem Eingabefeld, z. B. „600000“ oder „600.000,50“ → Cent */
const centsOf = (value: string) => {
  const number = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : null;
};

/** Ein Betrag mit Speichern und Abbrechen (Jahresziel, Ziel des Lieferanten) */
function AmountForm({
  label,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  onSubmit: (cents: number) => Promise<void>;
  onCancel: () => void;
}) {
  const text = useT().insights;
  const [value, setValue] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      aria-label={label}
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        const cents = centsOf(value);
        if (cents === null) {
          setFailed(true);
          return;
        }
        setBusy(true);
        setFailed(false);
        try {
          await onSubmit(cents);
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormField
        label={label}
        className="min-w-0 grow"
        error={failed ? text.goalFailed : undefined}
      >
        {(field) => (
          <Input
            {...field}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
      </FormField>
      <FormActions>
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {text.cancel}
        </Button>
      </FormActions>
    </form>
  );
}

/**
 * Übersicht (NAV-10, AW-01, nach Uebersicht.dc.html): Beleg als Ringpaar, außen gesichertes EBIT
 * gegen das Jahresziel, innen Fokuslieferanten mit freigegebenem JBP; darunter die Zeilenliste und
 * drei Fragevorschläge. Aussage und drei Sätze von Reziproq kommen mit KI-04 und KI-16.
 */
export function OverviewPage() {
  const t = useT();
  const text = t.insights;
  const accessToken = useToken();
  const client = useQueryClient();
  const amount = useAmount();
  const query = useQuery({
    ...overviewInsightQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  // KI-11: Wertpotenziale als dritte Zeile, nur wenn es sie gibt
  const opportunities = useQuery({
    ...valueOverviewQueryOptions(accessToken),
    enabled: accessToken !== '',
  }).data;
  const data = query.data;

  if (query.isError) {
    return (
      <>
        <PageHeader size="list" title={text.overviewTitle} purpose="" />
        <ErrorState title={text.failed} />
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader size="list" title={text.overviewTitle} purpose="" />
        <LoadingState label={text.loading} />
      </>
    );
  }
  const secured = amount(data.securedEbitCents, data.currency);
  const goal = data.goalEbitCents === null ? null : amount(data.goalEbitCents, data.currency);

  return (
    <>
      <PageHeader
        size="list"
        title={text.overviewTitle}
        purpose={text.overviewPurpose(data.fiscalYear)}
      />
      <div className="flex flex-col gap-6">
        {saved && <StatusLine message={text.goalSaved} onHidden={() => setSaved(false)} />}
        <Statement statement={data.statement} />
        <EvidenceCard title={text.evidenceTitle(secured, goal)} source={text.evidenceSource}>
          <GoalRings
            result={{
              label: text.result,
              actual: data.securedEbitCents,
              target: data.goalEbitCents,
              format: (value, target) =>
                target === null
                  ? amount(value, data.currency)
                  : text.moneyOf(amount(value, data.currency), amount(target, data.currency)),
            }}
            relationships={{
              label: text.relationships,
              actual: data.focusWithApprovedJbp,
              target: data.focusTotal || null,
              format: (value, target) => text.countOf(value, target ?? 0),
            }}
          />
          {data.goalEbitCents === null && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">{text.noGoal}</span>
              {data.canSetGoal && !editing && (
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  {text.setGoal}
                </Button>
              )}
            </div>
          )}
          {editing && (
            <AmountForm
              label={text.goalLabel(data.fiscalYear)}
              submitLabel={text.saveGoal}
              onCancel={() => setEditing(false)}
              onSubmit={async (cents) => {
                await saveEbitGoal(accessToken, { year: data.fiscalYear, amountCents: cents });
                await client.invalidateQueries({ queryKey: ['uebersicht'] });
                setEditing(false);
                setSaved(true);
              }}
            />
          )}
        </EvidenceCard>
        {(data.sentences?.length ?? 0) > 0 && (
          <section aria-label={text.sentencesLabel} className="grid gap-3 sm:grid-cols-3">
            {data.sentences?.map((sentence) => (
              <Tile key={sentence.kind} className="gap-2">
                <span className="font-semibold text-muted-foreground text-sm">
                  {text.sentenceKinds[sentence.kind]}
                </span>
                <p>{sentence.text}</p>
                {routerLink({
                  href: sentence.href,
                  className:
                    'mt-auto self-start font-semibold text-primary text-sm underline-offset-4 hover:underline',
                  children: sentence.kind === 'todo' ? text.toMyDay : text.view,
                })}
              </Tile>
            ))}
          </section>
        )}
        <ListCard aria-label={text.rowsLabel}>
          <EvidenceRow
            href="/uebersicht/ergebnisse"
            title={text.inProgress}
            detail={text.inProgressDetail}
            value={text.range(
              amount(data.inProgress.lowCents, data.currency),
              amount(data.inProgress.highCents, data.currency),
            )}
          />
          <EvidenceRow
            href="/uebersicht/ergebnisse"
            title={text.cash}
            detail={text.cashDetail}
            value={amount(data.cashCents, data.currency)}
          />
          {opportunities && opportunities.suppliers.length > 0 && (
            <EvidenceRow
              href="/uebersicht/wertpotenziale"
              title={t.opportunities.overview.rowTitle}
              detail={t.opportunities.overview.rowDetail}
              value={t.opportunities.overview.rowValue(opportunities.counts.new)}
            />
          )}
        </ListCard>
        <QuestionSuggestions
          title={text.questionsTitle}
          questions={text.questions.map((question) => ({
            label: question,
            href: `/fragen?q=${encodeURIComponent(question)}`,
          }))}
        />
      </div>
    </>
  );
}

/**
 * Lieferant · Überblick (AW-01): Ringpaar außen gesichertes EBIT gegen das freigegebene Ziel,
 * innen Zusagen, die im Geschäftsjahr fällig waren und rechtzeitig eingehalten wurden.
 */
export function SupplierRingsCard({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.insights;
  const accessToken = useToken();
  const client = useQueryClient();
  const amount = useAmount();
  const query = useQuery({
    ...supplierRingsQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const [editing, setEditing] = useState(false);
  const data = query.data;
  // Ohne Recht oder Daten bleibt der Abschnitt weg, statt leer zu erscheinen.
  if (!data) return null;
  const approved = data.target?.approved ? data.target.ebitTargetCents : null;
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['suppliers', relationshipId, 'ringe'] });

  const chance = data.chance;
  return (
    <>
      <Statement statement={data.statement} />
      <EvidenceCard
        title={text.supplierEvidence(amount(data.securedEbitCents, data.currency))}
        source={text.supplierSource(data.fiscalYear)}
      >
        <GoalRings
          result={{
            label: text.result,
            actual: data.securedEbitCents,
            target: approved,
            format: (value, target) =>
              target === null
                ? amount(value, data.currency)
                : text.moneyOf(amount(value, data.currency), amount(target, data.currency)),
          }}
          relationships={{
            label: text.commitments,
            actual: data.commitments.keptOnTime,
            target: data.commitments.due || null,
            format: (value, target) => text.commitmentsOf(value, target ?? 0),
          }}
        />
        {data.target && !data.target.approved && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {text.targetPending(amount(data.target.ebitTargetCents, data.currency))}
            </span>
            {data.canApprove && (
              <Button
                size="sm"
                onClick={async () => {
                  await approveSupplierTarget(accessToken, relationshipId, data.fiscalYear);
                  await refresh();
                }}
              >
                {text.approveTarget}
              </Button>
            )}
          </div>
        )}
        {!approved && data.canPropose && !editing && (
          <Button
            size="sm"
            variant="secondary"
            className="self-start"
            onClick={() => setEditing(true)}
          >
            {data.target ? text.proposeTarget : text.setGoal}
          </Button>
        )}
        {editing && (
          <AmountForm
            label={text.targetLabel(data.fiscalYear)}
            submitLabel={text.saveTarget}
            onCancel={() => setEditing(false)}
            onSubmit={async (cents) => {
              await proposeSupplierTarget(accessToken, relationshipId, {
                year: data.fiscalYear,
                amountCents: cents,
              });
              await refresh();
              setEditing(false);
            }}
          />
        )}
      </EvidenceCard>
      {chance && (
        <Tile className="gap-2" aria-labelledby="groesste-chance">
          <span className="font-semibold text-muted-foreground text-sm">{text.chanceTitle}</span>
          <h2
            id="groesste-chance"
            className="font-display font-semibold text-section tracking-section"
          >
            {t.opportunities.templates[chance.templateKey] ?? chance.templateKey}
          </h2>
          <p className="tabular-nums">
            {text.chanceValue(
              amount(chance.low, data.currency),
              amount(chance.high, data.currency),
              t.opportunities.impact[chance.impactType] ?? '',
              t.opportunities.confidence[chance.confidence] ?? '',
            )}
          </p>
          {routerLink({
            href: `/lieferanten/${relationshipId}/wirkung/wertpotenziale#potenzial-${chance.opportunityId}`,
            className:
              'self-start font-semibold text-primary text-sm underline-offset-4 hover:underline',
            children: text.chanceLink,
          })}
        </Tile>
      )}
    </>
  );
}
