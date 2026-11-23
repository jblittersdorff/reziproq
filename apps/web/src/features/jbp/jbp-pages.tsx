import type { JbpPreparation, MeetingSide } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { HandshakeIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useCustomerWorkspace } from '@/features/customers/customer-workspace';
import { apiBase, type MeetingPlace, SideBadge } from '@/features/meetings/meeting-pages';
import { PdfButton } from '@/features/print/pdf-button';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { createJbp, jbpQueryOptions, saveBusinessUpdate } from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';

// JBP-01: Vorbereitung des Joint Business Planning. Der Käufer arbeitet unter
// /lieferanten/<id>/plan/vorbereitung, der Lieferant unter /kunden/<beziehung>/plan/vorbereitung.

export const preparationPath = ({ side, relationshipId }: MeetingPlace) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/plan/vorbereitung`
    : `/kunden/${relationshipId}/plan/vorbereitung`;

const meetingsPath = ({ side, relationshipId }: MeetingPlace) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/umsetzung/termine`
    : `/kunden/${relationshipId}/umsetzung/termine`;

export function useToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

function usePreparation(place: MeetingPlace) {
  const accessToken = useToken();
  const query = useQuery({
    ...jbpQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

/** Rahmen je Seite: beim Käufer Bereich Gemeinsamer Plan, beim Lieferanten der Kunde. */
export function JbpFrame({
  place,
  trail,
  current,
  header,
  children,
}: {
  place: MeetingPlace;
  trail: { label: string; href: string }[];
  current: string;
  header: ReactNode;
  children: ReactNode;
}) {
  if (place.side === 'buyer') {
    return (
      <SupplierFrame
        relationshipId={place.relationshipId}
        area="plan"
        trail={() => trail}
        current={current}
        header={header}
      >
        {() => children}
      </SupplierFrame>
    );
  }
  return (
    <CustomerPlanFrame place={place} trail={trail} current={current}>
      {header}
      {children}
    </CustomerPlanFrame>
  );
}

function CustomerPlanFrame({
  place,
  trail,
  current,
  children,
}: {
  place: MeetingPlace;
  trail: { label: string; href: string }[];
  current: string;
  children: ReactNode;
}) {
  const text = useT().customers;
  const workspace = useCustomerWorkspace(place.relationshipId);
  if (!workspace.data) return null;
  return (
    <>
      <PagePath
        trail={[
          { label: text.title, href: '/kunden' },
          { label: workspace.data.name, href: `/kunden/${place.relationshipId}` },
          { label: text.areas.plan, href: `/kunden/${place.relationshipId}/plan` },
          ...trail,
        ]}
        current={current}
      />
      {children}
    </>
  );
}

/** Gemeinsamer Plan › Vorbereitung: Termin, Agenda mit Stand je Punkt, beide Geschäftsupdates. */
export function JbpPreparationPage({ place }: { place: MeetingPlace }) {
  const text = useT().jbp;
  return (
    <JbpFrame
      place={place}
      trail={[]}
      current={text.title}
      header={<PageHeader title={text.pageTitle} purpose={text.purpose} />}
    >
      <PreparationContent place={place} />
    </JbpFrame>
  );
}

function PreparationContent({ place }: { place: MeetingPlace }) {
  const t = useT();
  const text = t.jbp;
  const format = useFormat();
  const query = usePreparation(place);
  const [message, hideMessage] = useFlash();
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const data = query.data;
  if (!data.jbp) {
    return data.canCreate ? (
      <CreateJbpForm place={place} preparation={data} accessToken={query.accessToken} />
    ) : (
      <EmptyState
        size="lg"
        icon={<HandshakeIcon aria-hidden />}
        title={text.emptyTitle}
        description={text.emptyText}
      />
    );
  }

  return (
    <>
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {/* QS-03, LIF-06: der ganze Gemeinsame Plan als PDF, auf beiden Seiten */}
      <PdfButton path={`${apiBase(place)}/jbp/pdf`} fileName="Gemeinsamer-Plan.pdf" />
      {data.buyerHint && !data.buyerHint.supplierPlanApproved && (
        <div
          role="status"
          data-slot="plan-hint"
          className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft px-4 py-3 text-warning-soft-foreground"
        >
          <p className="flex-1">{text.planHint}</p>
          {routerLink({
            href: `/lieferanten/${place.relationshipId}/strategie/lieferantenplan`,
            className: buttonVariants({ variant: 'outline', size: 'sm' }),
            children: text.toPlan,
          })}
        </div>
      )}

      {/* WG-20: warnt bei fehlender Warengruppenstrategie oder offenem Widerspruch, blockiert nicht */}
      {data.categories &&
        (data.categories.withoutStrategy.length > 0 || data.categories.openConflicts > 0) && (
          <div
            role="status"
            data-slot="category-hint"
            className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft px-4 py-3 text-warning-soft-foreground"
          >
            <p className="flex-1">
              {[
                data.categories.withoutStrategy.length > 0
                  ? text.categoriesMissing(data.categories.withoutStrategy.join(', '))
                  : null,
                data.categories.openConflicts > 0
                  ? text.categoriesConflicts(data.categories.openConflicts)
                  : null,
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
            {routerLink({
              href: `/lieferanten/${place.relationshipId}/strategie/warengruppen`,
              className: buttonVariants({ variant: 'outline', size: 'sm' }),
              children: text.toCategories,
            })}
          </div>
        )}

      {data.meeting && (
        <section aria-labelledby="jbp-termin" className="flex flex-col gap-3">
          <h2 id="jbp-termin" className="font-display font-semibold text-section tracking-section">
            {text.meeting}
          </h2>
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-card shadow-card px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-semibold">{data.meeting.title}</span>
              <span className="text-muted-foreground text-sm">
                {format.date(data.meeting.startsAt)}
                {data.meeting.location ? ` · ${data.meeting.location}` : ''}
              </span>
              <span className="text-muted-foreground text-sm">
                {data.meeting.participants.length > 0
                  ? `${text.participants}: ${data.meeting.participants.join(', ')}`
                  : text.noParticipants}
              </span>
            </div>
            {routerLink({
              href: `${meetingsPath(place)}/${data.meeting.id}`,
              className: buttonVariants({ variant: 'outline' }),
              children: text.toMeeting,
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="jbp-agenda" className="flex flex-col gap-3">
        <h2 id="jbp-agenda" className="font-display font-semibold text-section tracking-section">
          {text.agenda}
        </h2>
        <ol className="overflow-hidden rounded-lg bg-card shadow-card">
          {data.agenda.map((item, index) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 border-line-soft border-b px-5 py-3 last:border-b-0"
            >
              <span className="w-6 text-muted-foreground tabular-nums">{index + 1}</span>
              <span className="flex-1">{item.title}</span>
              <SideBadge place={place} side={item.side} />
              {item.ready !== null && (
                <Badge variant={item.ready ? 'success' : 'neutral'}>
                  {item.ready ? text.ready : text.missing}
                </Badge>
              )}
            </li>
          ))}
          {data.live.feedback && (
            <li className="flex flex-wrap items-center gap-3 border-line-soft border-b px-5 py-3">
              <span className="w-6" />
              <span className="flex-1">
                {data.live.feedback.topGap
                  ? t.feedback.biggestGap(
                      t.settings.survey.dimensions[data.live.feedback.topGap.dimension] ?? '',
                      format.number(Math.abs(data.live.feedback.topGap.delta)),
                    )
                  : t.feedback.kinds[data.live.feedback.kind]}
              </span>
              <Badge variant="selected">{text.live}</Badge>
            </li>
          )}
          {data.live.rules && (
            <li className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="w-6" />
              <span className="flex-1">{text.rules(data.live.rules.typeName)}</span>
              <Badge variant="selected">{text.live}</Badge>
            </li>
          )}
        </ol>
      </section>

      <section aria-labelledby="jbp-updates" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="jbp-updates" className="font-display font-semibold text-section tracking-section">
            {text.updates}
          </h2>
          {data.canEditOwnUpdate &&
            routerLink({
              href: `${preparationPath(place)}/geschaeftsupdate`,
              className: buttonVariants({ variant: 'outline' }),
              children: text.editUpdate,
            })}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(['buyer', 'supplier'] as MeetingSide[]).map((side) => {
            const update = data.updates[side];
            return (
              <article
                key={side}
                aria-label={text.updateOf[side]}
                className="flex flex-col gap-2 rounded-lg bg-card shadow-card p-5"
              >
                <h3 className="font-semibold">{text.updateOf[side]}</h3>
                {update?.text ? (
                  <p className="whitespace-pre-wrap">{update.text}</p>
                ) : (
                  <p className="text-muted-foreground">{text.updateEmpty}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

/** Anlegen mit dem Termin aus dem Zyklus als Vorschlag; Plan, Termin und Agenda in einem Schritt. */
function CreateJbpForm({
  place,
  preparation,
  accessToken,
}: {
  place: MeetingPlace;
  preparation: JbpPreparation;
  accessToken: string;
}) {
  const text = useT().jbp;
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(preparation.suggestedDate ?? '');
  const [time, setTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    if (date === '') {
      setError(text.required);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createJbp(accessToken, apiBase(place), {
        startsAt: new Date(`${date}T${time || '09:00'}`).toISOString(),
        location: location.trim() || null,
        locale,
      });
      await queryClient.invalidateQueries({ queryKey: ['jbp'] });
      await queryClient.invalidateQueries({ queryKey: ['meetings'] });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6 rounded-lg bg-card shadow-card p-6"
    >
      <p className="text-muted-foreground">{text.emptyBuyer}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={text.date} hint={text.dateHint} error={error ?? undefined}>
          {(field) => (
            <Input
              {...field}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          )}
        </FormField>
        <FormField label={text.time}>
          {(field) => (
            <Input
              {...field}
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          )}
        </FormField>
      </div>
      <FormField label={text.location}>
        {(field) => (
          <Input
            {...field}
            maxLength={300}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        )}
      </FormField>
      {failed && (
        <p role="alert" className="text-destructive">
          {text.failedSave}
        </p>
      )}
      <FormActions>
        <Button type="submit" loading={saving}>
          {text.create}
        </Button>
      </FormActions>
    </form>
  );
}

/** Eigenes Geschäftsupdate schreiben, auf eigener Seite; Speichern führt zur Vorbereitung. */
export function BusinessUpdatePage({ place }: { place: MeetingPlace }) {
  const text = useT().jbp;
  return (
    <JbpFrame
      place={place}
      trail={[{ label: text.title, href: preparationPath(place) }]}
      current={text.updateTitle}
      header={<PageHeader title={text.updateTitle} purpose={text.updatePurpose} />}
    >
      <BusinessUpdateForm place={place} />
    </JbpFrame>
  );
}

function BusinessUpdateForm({ place }: { place: MeetingPlace }) {
  const text = useT().jbp;
  const query = usePreparation(place);
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  if (!query.data.jbp || !query.data.canEditOwnUpdate) {
    return (
      <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
        {text.noPermission}
      </p>
    );
  }
  return (
    <BusinessUpdateEditor
      place={place}
      initial={query.data.updates[query.data.ownSide]?.text ?? ''}
      accessToken={query.accessToken}
    />
  );
}

function BusinessUpdateEditor({
  place,
  initial,
  accessToken,
}: {
  place: MeetingPlace;
  initial: string;
  accessToken: string;
}) {
  const text = useT().jbp;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    setSaving(true);
    try {
      await saveBusinessUpdate(accessToken, apiBase(place), value.trim());
      await queryClient.invalidateQueries({ queryKey: ['jbp'] });
      flash.set(text.saved);
      await navigate({ to: preparationPath(place) });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
    >
      <FormField label={text.updateLabel}>
        {(field) => (
          <Textarea
            {...field}
            rows={10}
            maxLength={10_000}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </FormField>
      {failed && (
        <p role="alert" className="text-destructive">
          {text.failedSave}
        </p>
      )}
      <FormActions>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void navigate({ to: preparationPath(place) })}
        >
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {text.save}
        </Button>
      </FormActions>
    </form>
  );
}
