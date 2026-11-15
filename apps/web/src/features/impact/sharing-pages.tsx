import {
  type CustomerImpact,
  type EffectTotal,
  type ImpactList,
  parseEuroToCents,
  saveShareSchema,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { CustomerFrame } from '@/features/customers/customer-frame';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { useGoBack } from '@/features/shell/page-path';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import {
  confirmImpactShare,
  customerImpactQueryOptions,
  impactListQueryOptions,
  saveImpactShare,
  saveSavingsReference,
  saveSupplierBenefit,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { BridgeSection, type ImpactSearch } from './portfolio-pages';

// PNL-07: Teilung, Summen je Wirkungsart und Savings-Verweis beim Käufer; Wirkung und eigener
// Nutzen beim Lieferanten.

const impactBase = (relationshipId: string) => `/lieferanten/${relationshipId}/wirkung/initiativen`;
const customerBase = (relationshipId: string) => `/kunden/${relationshipId}/wirkung`;

function useToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

function useMoney() {
  const format = useFormat();
  return (cents: number) => format.money({ amountCents: cents, currency: 'EUR' });
}

/** Je Wirkungsart eine eigene Kachel; es gibt bewusst keine Gesamtsumme. */
export function EffectTotals({
  totals,
  side = 'buyer',
}: {
  totals: EffectTotal[];
  side?: 'buyer' | 'supplier';
}) {
  const t = useT();
  const text = t.impact.sharing;
  const money = useMoney();
  if (totals.length === 0) return null;
  return (
    <section aria-labelledby="wirkung-summen" className="flex flex-col gap-3">
      <h2 id="wirkung-summen" className="font-semibold text-lg">
        {text.totalsTitle}
      </h2>
      <ul aria-label={text.totalsTitle} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((total) => (
          <li
            key={total.effectType}
            data-effect={total.effectType}
            className="flex flex-col gap-1 rounded-lg bg-card p-4"
          >
            <span className="text-muted-foreground text-sm">
              {t.impact.effects[total.effectType]}
            </span>
            <span className="break-words font-display font-semibold text-figure tabular-nums tracking-section">
              {money(total.actual)}
            </span>
            <span className="text-muted-foreground text-sm tabular-nums">
              {text.actual} · {text.plan} {money(total.plan)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-sm">
        {side === 'buyer' ? text.totalsHint : text.totalsHintSupplier}
      </p>
    </section>
  );
}

/** Teilung und Savings-Verweis einer Initiative als kurze Kennzeichen in der Liste. */
export function SharingFlags({ entry }: { entry: ImpactList['initiatives'][number] }) {
  const text = useT().impact.sharing;
  return (
    <span className="flex flex-wrap gap-2">
      {entry.share ? (
        <Badge variant={entry.share.agreedAt ? 'success' : 'warning'}>
          {entry.share.agreedAt
            ? text.shareAgreed(entry.share.buyerSharePct, entry.share.supplierSharePct)
            : text.shareProposed(entry.share.buyerSharePct, entry.share.supplierSharePct)}
        </Badge>
      ) : null}
      {entry.savingsReference && <Badge variant="neutral">{text.savingsMarker}</Badge>}
    </span>
  );
}

function useImpactList(relationshipId: string) {
  const accessToken = useToken();
  const query = useQuery({
    ...impactListQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

/** Abschnitte Teilung und Savings-Tracking auf der Wirkungs-Seite einer Initiative. */
export function SharingSection({
  relationshipId,
  initiativeId,
}: {
  relationshipId: string;
  initiativeId: string;
}) {
  const text = useT().impact.sharing;
  const query = useImpactList(relationshipId);
  const entry = query.data?.initiatives.find((item) => item.id === initiativeId);
  if (!query.data || !entry) return null;
  const base = `${impactBase(relationshipId)}/${initiativeId}`;
  const link = (href: string, label: string) =>
    query.data.canLead
      ? routerLink({ href, className: buttonVariants({ variant: 'outline' }), children: label })
      : null;
  return (
    <>
      <section aria-labelledby="wirkung-teilung" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="wirkung-teilung" className="font-semibold text-lg">
            {text.share}
          </h2>
          {link(`${base}/teilung`, entry.share ? text.shareEdit : text.sharePropose)}
        </div>
        <div className="flex flex-col gap-1 rounded-lg bg-card px-4 py-3">
          {entry.share ? (
            <>
              <span className="font-medium">
                {entry.share.agreedAt
                  ? text.shareAgreed(entry.share.buyerSharePct, entry.share.supplierSharePct)
                  : text.shareProposed(entry.share.buyerSharePct, entry.share.supplierSharePct)}
              </span>
              {entry.share.ruleText && <span>{entry.share.ruleText}</span>}
              <span className="text-muted-foreground text-sm">
                {text.proposedBy(entry.share.proposedByName)}
                {entry.share.supplierConfirmedByName
                  ? ` · ${text.confirmedBy(entry.share.supplierConfirmedByName)}`
                  : ''}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">{text.shareNone}</span>
          )}
        </div>
      </section>
      <section aria-labelledby="wirkung-savings" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="wirkung-savings" className="font-semibold text-lg">
            {text.savings}
          </h2>
          {link(`${base}/savings`, text.savingsEdit)}
        </div>
        <p className="rounded-lg bg-card px-4 py-3">
          {entry.savingsReference
            ? text.savingsSet(entry.savingsReference.system, entry.savingsReference.reference)
            : text.savingsNone}
        </p>
      </section>
    </>
  );
}

/** Bearbeiten-Seite beim Käufer: Pfad Wirkung › Initiative › Seite. */
function BuyerEditFrame({
  relationshipId,
  initiativeId,
  title,
  purpose,
  children,
}: {
  relationshipId: string;
  initiativeId: string;
  title: string;
  purpose: string;
  children: (entry: ImpactList['initiatives'][number], accessToken: string) => ReactNode;
}) {
  const t = useT();
  const query = useImpactList(relationshipId);
  const entry = query.data?.initiatives.find((item) => item.id === initiativeId);
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="impact"
      trail={() => [
        { label: t.impact.list.title, href: impactBase(relationshipId) },
        {
          label: entry?.title ?? t.impact.list.title,
          href: `${impactBase(relationshipId)}/${initiativeId}`,
        },
      ]}
      current={title}
      header={<PageHeader title={title} purpose={purpose} />}
    >
      {() =>
        query.isError ? (
          <ErrorState title={t.impact.list.failed} />
        ) : !query.data ? (
          <LoadingState label={t.impact.list.loading} />
        ) : !entry ? (
          <ErrorState title={t.impact.notFound} />
        ) : !query.data.canLead ? (
          <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
            {t.impact.sharing.onlyLead}
          </p>
        ) : (
          children(entry, query.accessToken)
        )
      }
    </SupplierFrame>
  );
}

function useSaveList(relationshipId: string, back: string) {
  const t = useT();
  const queryClient = useQueryClient();
  const goBack = useGoBack(back);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async (work: () => Promise<ImpactList>) => {
    setSaving(true);
    setFailed(false);
    try {
      queryClient.setQueryData(['impact', relationshipId], await work());
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      flash.set(t.suppliers.saved);
      goBack();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return { run, saving, failed, goBack };
}

function Actions({
  saving,
  failed,
  onCancel,
  extra,
}: {
  saving: boolean;
  failed: boolean;
  onCancel: () => void;
  extra?: ReactNode;
}) {
  const t = useT();
  return (
    <>
      {failed && (
        <p role="alert" className="text-destructive">
          {t.suppliers.saveFailed}
        </p>
      )}
      <FormActions>
        {extra}
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t.suppliers.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.suppliers.saving : t.suppliers.save}
        </Button>
      </FormActions>
    </>
  );
}

export function SharePage({
  relationshipId,
  initiativeId,
}: {
  relationshipId: string;
  initiativeId: string;
}) {
  const text = useT().impact.sharing;
  return (
    <BuyerEditFrame
      relationshipId={relationshipId}
      initiativeId={initiativeId}
      title={text.shareEdit}
      purpose={text.sharePurpose}
    >
      {(entry, accessToken) => (
        <ShareForm
          entry={entry}
          accessToken={accessToken}
          relationshipId={relationshipId}
          initiativeId={initiativeId}
        />
      )}
    </BuyerEditFrame>
  );
}

function ShareForm({
  entry,
  accessToken,
  relationshipId,
  initiativeId,
}: {
  entry: ImpactList['initiatives'][number];
  accessToken: string;
  relationshipId: string;
  initiativeId: string;
}) {
  const text = useT().impact.sharing;
  const { run, saving, failed, goBack } = useSaveList(
    relationshipId,
    `${impactBase(relationshipId)}/${initiativeId}`,
  );
  const [form, setForm] = useState({
    buyer: String(entry.share?.buyerSharePct ?? 50),
    supplier: String(entry.share?.supplierSharePct ?? 50),
    rule: entry.share?.ruleText ?? '',
  });
  const [sumError, setSumError] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = saveShareSchema.safeParse({
      buyerSharePct: Number(form.buyer),
      supplierSharePct: Number(form.supplier),
      ruleText: form.rule.trim() || null,
    });
    setSumError(!parsed.success);
    if (!parsed.success) return;
    void run(() => saveImpactShare(accessToken, relationshipId, initiativeId, parsed.data));
  };
  return (
    <form noValidate onSubmit={submit} className="flex max-w-xl flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label={text.buyerShare} error={sumError ? text.shareSum : undefined}>
          {(field) => (
            <Input
              {...field}
              inputMode="numeric"
              value={form.buyer}
              onChange={(event) => setForm({ ...form, buyer: event.target.value })}
            />
          )}
        </FormField>
        <FormField label={text.supplierShare}>
          {(field) => (
            <Input
              {...field}
              inputMode="numeric"
              value={form.supplier}
              onChange={(event) => setForm({ ...form, supplier: event.target.value })}
            />
          )}
        </FormField>
      </div>
      <FormField label={text.ruleText} hint={text.ruleTextHint}>
        {(field) => (
          <Textarea
            {...field}
            rows={3}
            value={form.rule}
            onChange={(event) => setForm({ ...form, rule: event.target.value })}
          />
        )}
      </FormField>
      <Actions saving={saving} failed={failed} onCancel={goBack} />
    </form>
  );
}

export function SavingsReferencePage({
  relationshipId,
  initiativeId,
}: {
  relationshipId: string;
  initiativeId: string;
}) {
  const text = useT().impact.sharing;
  return (
    <BuyerEditFrame
      relationshipId={relationshipId}
      initiativeId={initiativeId}
      title={text.savingsEdit}
      purpose={text.savingsPurpose}
    >
      {(entry, accessToken) => (
        <ReferenceForm
          entry={entry}
          accessToken={accessToken}
          relationshipId={relationshipId}
          initiativeId={initiativeId}
        />
      )}
    </BuyerEditFrame>
  );
}

function ReferenceForm({
  entry,
  accessToken,
  relationshipId,
  initiativeId,
}: {
  entry: ImpactList['initiatives'][number];
  accessToken: string;
  relationshipId: string;
  initiativeId: string;
}) {
  const t = useT();
  const text = t.impact.sharing;
  const { run, saving, failed, goBack } = useSaveList(
    relationshipId,
    `${impactBase(relationshipId)}/${initiativeId}`,
  );
  const [form, setForm] = useState({
    system: entry.savingsReference?.system ?? '',
    reference: entry.savingsReference?.reference ?? '',
  });
  const [missing, setMissing] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.system.trim() || !form.reference.trim()) {
      setMissing(true);
      return;
    }
    setMissing(false);
    void run(() =>
      saveSavingsReference(accessToken, relationshipId, initiativeId, {
        system: form.system.trim(),
        reference: form.reference.trim(),
      }),
    );
  };
  return (
    <form noValidate onSubmit={submit} className="flex max-w-xl flex-col gap-6">
      <FormField
        label={text.system}
        error={missing && !form.system.trim() ? t.suppliers.errors.required : undefined}
      >
        {(field) => (
          <Input
            {...field}
            value={form.system}
            onChange={(event) => setForm({ ...form, system: event.target.value })}
          />
        )}
      </FormField>
      <FormField
        label={text.reference}
        error={missing && !form.reference.trim() ? t.suppliers.errors.required : undefined}
      >
        {(field) => (
          <Input
            {...field}
            value={form.reference}
            onChange={(event) => setForm({ ...form, reference: event.target.value })}
          />
        )}
      </FormField>
      <Actions
        saving={saving}
        failed={failed}
        onCancel={goBack}
        extra={
          entry.savingsReference ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                void run(() =>
                  saveSavingsReference(accessToken, relationshipId, initiativeId, null),
                )
              }
            >
              <Trash2Icon />
              {text.removeReference}
            </Button>
          ) : null
        }
      />
    </form>
  );
}

// Lieferantenseite: /kunden/<beziehung>/wirkung

function useCustomerImpact(relationshipId: string) {
  const accessToken = useToken();
  const query = useQuery({
    ...customerImpactQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

export function CustomerImpactPage({
  relationshipId,
  search = {},
}: {
  relationshipId: string;
  search?: ImpactSearch;
}) {
  const t = useT();
  const text = t.impact.sharing;
  const query = useCustomerImpact(relationshipId);
  const [message, hideMessage] = useFlash();
  return (
    <CustomerFrame relationshipId={relationshipId} area="impact" current={text.customerTitle}>
      <PageHeader title={text.customerTitle} purpose={text.customerPurpose} />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {/* PNL-10: Brücke mit den geteilten Werten. */}
      <BridgeSection
        relationshipId={relationshipId}
        side="supplier"
        path={customerBase(relationshipId)}
        search={search}
      />
      {query.isError ? (
        <ErrorState title={text.customerFailed} />
      ) : !query.data ? (
        <LoadingState label={text.customerLoading} />
      ) : (
        <CustomerImpactContent
          data={query.data}
          relationshipId={relationshipId}
          accessToken={query.accessToken}
        />
      )}
    </CustomerFrame>
  );
}

function CustomerImpactContent({
  data,
  relationshipId,
  accessToken,
}: {
  data: CustomerImpact;
  relationshipId: string;
  accessToken: string;
}) {
  const t = useT();
  const text = t.impact.sharing;
  const format = useFormat();
  const money = useMoney();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const run = async (work: () => Promise<CustomerImpact>, done: string) => {
    setFailed(false);
    try {
      queryClient.setQueryData(['kunden', relationshipId, 'wirkung'], await work());
      setStatus(done);
    } catch {
      setFailed(true);
    }
  };
  const monthLabel = (month: string) =>
    new Intl.DateTimeFormat(format.locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${month}T00:00:00Z`));
  if (data.initiatives.length === 0) {
    return (
      <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">{text.customerEmpty}</p>
    );
  }
  return (
    <>
      {status && <StatusLine message={status} onHidden={() => setStatus(null)} />}
      {failed && <StatusLine message={t.suppliers.saveFailed} tone="warning" />}
      <EffectTotals totals={data.totals} side="supplier" />
      <ul aria-label={text.customerTitle} className="flex flex-col gap-4">
        {data.initiatives.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-4 rounded-lg bg-card p-4">
            <h2 className="font-semibold text-lg">{entry.title}</h2>
            <div className="flex flex-col gap-1">
              <span className="font-medium">{text.share}</span>
              {entry.share ? (
                <>
                  <span>
                    {entry.share.agreedAt
                      ? text.shareAgreed(entry.share.buyerSharePct, entry.share.supplierSharePct)
                      : text.shareProposed(entry.share.buyerSharePct, entry.share.supplierSharePct)}
                  </span>
                  {entry.share.ruleText && (
                    <span className="text-muted-foreground">{entry.share.ruleText}</span>
                  )}
                  {!entry.share.agreedAt && data.canConfirm && (
                    <div>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          void run(
                            () => confirmImpactShare(accessToken, relationshipId, entry.id),
                            text.confirmed,
                          )
                        }
                      >
                        <CheckIcon />
                        {text.confirm}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">{text.shareNone}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {entry.value ? (
                <span className="tabular-nums">
                  {t.impact.effects[entry.value.effectType]}: {text.actual}{' '}
                  {money(entry.value.actual)} · {text.plan} {money(entry.value.plan)}
                </span>
              ) : (
                <span className="text-muted-foreground">{text.notAgreed}</span>
              )}
            </div>
            <section
              aria-label={`${text.benefit}: ${entry.title}`}
              className="flex flex-col gap-2 rounded-lg border border-border border-dashed p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{text.benefit}</span>
                <VisibilityBadge visibility="internal" label={t.ownView.onlyYou} />
                {data.canEditBenefit &&
                  routerLink({
                    href: `${customerBase(relationshipId)}/initiativen/${entry.id}/nutzen`,
                    className: buttonVariants({ variant: 'outline' }),
                    children: (
                      <>
                        <PlusIcon />
                        {text.benefitAdd}
                      </>
                    ),
                  })}
              </div>
              {entry.benefits.length === 0 ? (
                <span className="text-muted-foreground text-sm">{text.benefitEmpty}</span>
              ) : (
                <ul className="flex flex-col text-sm">
                  {entry.benefits.map((benefit) => (
                    <li key={benefit.id} className="flex min-h-11 flex-wrap items-center gap-x-3">
                      <span>{monthLabel(benefit.month)}</span>
                      <span className="font-medium tabular-nums">
                        {format.money({
                          amountCents: benefit.amountCents,
                          currency: benefit.currency,
                        })}
                      </span>
                      {benefit.note && (
                        <span className="flex-1 text-muted-foreground">{benefit.note}</span>
                      )}
                      {data.canEditBenefit && (
                        <Button
                          variant="ghost"
                          aria-label={text.removeBenefit(monthLabel(benefit.month))}
                          onClick={() =>
                            void run(
                              () =>
                                saveSupplierBenefit(
                                  accessToken,
                                  relationshipId,
                                  entry.id,
                                  benefit.id,
                                  null,
                                ),
                              t.suppliers.saved,
                            )
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </li>
        ))}
      </ul>
      {data.benefitTotals.length > 0 && (
        <section aria-labelledby="nutzen-gesamt" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="nutzen-gesamt" className="font-semibold text-lg">
              {text.benefitTotal}
            </h2>
            <VisibilityBadge visibility="internal" label={t.ownView.onlyYou} />
          </div>
          <ul className="flex flex-wrap gap-4">
            {data.benefitTotals.map((total) => (
              <li
                key={total.currency}
                className="rounded-lg bg-card p-4 font-display font-semibold text-figure tabular-nums tracking-section"
              >
                {format.money(total)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function BenefitPage({
  relationshipId,
  initiativeId,
}: {
  relationshipId: string;
  initiativeId: string;
}) {
  const t = useT();
  const text = t.impact.sharing;
  const query = useCustomerImpact(relationshipId);
  const entry = query.data?.initiatives.find((item) => item.id === initiativeId);
  return (
    <CustomerFrame
      relationshipId={relationshipId}
      area="impact"
      trail={[{ label: text.customerTitle, href: customerBase(relationshipId) }]}
      current={text.benefitTitle}
    >
      <PageHeader
        title={text.benefitTitle}
        purpose={text.benefitPurpose}
        badge={<VisibilityBadge visibility="internal" label={t.ownView.onlyYou} />}
      />
      {query.isError ? (
        <ErrorState title={text.customerFailed} />
      ) : !query.data ? (
        <LoadingState label={text.customerLoading} />
      ) : !entry ? (
        <ErrorState title={t.impact.notFound} />
      ) : (
        <BenefitForm
          accessToken={query.accessToken}
          relationshipId={relationshipId}
          initiativeId={initiativeId}
          title={entry.title}
        />
      )}
    </CustomerFrame>
  );
}

function BenefitForm({
  accessToken,
  relationshipId,
  initiativeId,
  title,
}: {
  accessToken: string;
  relationshipId: string;
  initiativeId: string;
  title: string;
}) {
  const t = useT();
  const text = t.impact.sharing;
  const format = useFormat();
  const queryClient = useQueryClient();
  const goBack = useGoBack(customerBase(relationshipId));
  const [form, setForm] = useState({ month: '', amount: '', note: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const negative = form.amount.trim().startsWith('-');
    const cents = parseEuroToCents(
      negative ? form.amount.trim().slice(1) : form.amount,
      format.locale,
    );
    if (!/^\d{4}-\d{2}$/.test(form.month)) next.month = t.suppliers.errors.required;
    if (cents === null) next.amount = t.suppliers.errors.invalid_amount;
    setErrors(next);
    if (Object.keys(next).length > 0 || cents === null) return;
    setSaving(true);
    setFailed(false);
    try {
      queryClient.setQueryData(
        ['kunden', relationshipId, 'wirkung'],
        await saveSupplierBenefit(accessToken, relationshipId, initiativeId, null, {
          month: `${form.month}-01`,
          amountCents: negative ? -cents : cents,
          currency: 'EUR',
          note: form.note.trim() || null,
        }),
      );
      flash.set(t.suppliers.saved);
      goBack();
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code;
      if (code === 'duplicate_month') setErrors({ month: text.duplicateMonth });
      else setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-xl flex-col gap-6"
    >
      <p className="font-medium">{title}</p>
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label={text.month} error={errors.month}>
          {(field) => (
            <Input
              {...field}
              type="month"
              value={form.month}
              onChange={(event) => setForm({ ...form, month: event.target.value })}
            />
          )}
        </FormField>
        <FormField label={text.amount} error={errors.amount}>
          {(field) => (
            <Input
              {...field}
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          )}
        </FormField>
      </div>
      <FormField label={text.note}>
        {(field) => (
          <Input
            {...field}
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        )}
      </FormField>
      <Actions saving={saving} failed={failed} onCancel={goBack} />
    </form>
  );
}
