import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormActions, FormField } from '@/components/ui/form-field';
import { GoalRings } from '@/components/ui/goal-rings';
import { Input } from '@/components/ui/input';
import { EvidenceCard } from '@/components/ui/insight';
import { Tile } from '@/components/ui/tile';
import { SeverityBadge, useHintWhy } from '@/features/hints/hint-panel';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { approveSupplierTarget, proposeSupplierTarget, supplierRingsQueryOptions } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { Statement } from './statement';

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
export function AmountForm({
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
 * Lieferant · Überblick (AW-01): Ringpaar außen gesichertes EBIT gegen das freigegebene Ziel,
 * innen Zusagen, die im Geschäftsjahr fällig waren und rechtzeitig eingehalten wurden.
 */
export function SupplierRingsCard({ relationshipId }: { relationshipId: string }) {
  const hintWhy = useHintWhy();
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
  const risk = data.risk ?? null;
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
      {(chance || risk) && (
        <div className="flex flex-wrap items-stretch gap-3">
          {chance && (
            <Tile className="min-w-0 grow basis-64 gap-2" aria-labelledby="groesste-chance">
              <span className="font-semibold text-muted-foreground text-sm">
                {text.chanceTitle}
              </span>
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
          {/* AW-01, KI-16: Größtes Risiko, der offene Hinweis mit dem höchsten score */}
          {risk && (
            <Tile className="min-w-0 grow basis-64 gap-2" aria-labelledby="groesstes-risiko">
              <span className="font-semibold text-muted-foreground text-sm">{text.riskTitle}</span>
              <h2
                id="groesstes-risiko"
                className="font-display font-semibold text-section tracking-section"
              >
                {hintWhy({ ruleKey: risk.ruleKey, detail: risk.detail })}
              </h2>
              <SeverityBadge hint={risk} />
              {routerLink({
                href: `/hinweise?hinweis=${risk.hintId}`,
                className:
                  'self-start font-semibold text-primary text-sm underline-offset-4 hover:underline',
                children: text.riskLink,
              })}
            </Tile>
          )}
        </div>
      )}
    </>
  );
}
