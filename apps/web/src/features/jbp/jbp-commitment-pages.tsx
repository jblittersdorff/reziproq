import type { Commitment, CommitmentStatus, Commitments, MeetingSide } from '@reziproq/shared';
import { commitmentStatuses } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { apiBase, type MeetingPlace } from '@/features/meetings/meeting-pages';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import {
  commitmentsQueryOptions,
  createCommitment,
  setCommitmentStatus,
  updateCommitment,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { JbpFrame, useToken } from './jbp-pages';

// JBP-05: Zusagen unter Gemeinsamer Plan › Zusagen, für beide Seiten gleich.

export const commitmentsPath = ({ side, relationshipId }: MeetingPlace) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/plan/zusagen`
    : `/kunden/${relationshipId}/plan/zusagen`;

function useDate() {
  const { locale } = useLocale();
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return (iso: string) => format.format(new Date(`${iso}T00:00:00`));
}

function useCommitments(place: MeetingPlace) {
  const accessToken = useToken();
  const query = useQuery({
    ...commitmentsQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

const statusVariant: Record<CommitmentStatus, 'neutral' | 'success' | 'warning'> = {
  open: 'neutral',
  kept: 'success',
  missed: 'warning',
};

/** Zwei Spalten: Käufer sagt zu, Lieferant sagt zu; überfällige oben und markiert. */
export function JbpCommitmentsPage({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.commitments;
  return (
    <JbpFrame
      place={place}
      trail={[]}
      current={text.title}
      header={<PageHeader title={text.title} purpose={text.purpose} />}
    >
      <CommitmentsContent place={place} />
    </JbpFrame>
  );
}

function CommitmentsContent({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.commitments;
  const query = useCommitments(place);
  const [message, hideMessage] = useFlash();
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const data = query.data;
  if (!data.hasPlan) {
    return (
      <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
        {text.noPlan}
      </p>
    );
  }
  return (
    <>
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {data.canEdit &&
        routerLink({
          href: `${commitmentsPath(place)}/neu`,
          className: cn(buttonVariants(), 'self-start'),
          children: (
            <>
              <PlusIcon />
              {text.new}
            </>
          ),
        })}
      <div className="grid gap-6 md:grid-cols-2">
        {(['buyer', 'supplier'] as MeetingSide[]).map((side) => (
          <CommitmentColumn
            key={side}
            place={place}
            side={side}
            data={data}
            accessToken={query.accessToken}
          />
        ))}
      </div>
    </>
  );
}

function CommitmentColumn({
  place,
  side,
  data,
  accessToken,
}: {
  place: MeetingPlace;
  side: MeetingSide;
  data: Commitments;
  accessToken: string;
}) {
  const text = useT().jbp.commitments;
  const commitments = data[side];
  return (
    <section aria-labelledby={`zusagen-${side}`} className="flex flex-col gap-3">
      <h2 id={`zusagen-${side}`} className="font-bold text-xl tracking-title">
        {text.column[side]}
      </h2>
      {commitments.length === 0 ? (
        <p className="text-muted-foreground">{text.empty}</p>
      ) : (
        <ol className="overflow-hidden rounded-xl bg-card">
          {commitments.map((commitment) => (
            <CommitmentRow
              key={commitment.id}
              place={place}
              commitment={commitment}
              editable={commitment.own && data.canEdit}
              accessToken={accessToken}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function CommitmentRow({
  place,
  commitment,
  editable,
  accessToken,
}: {
  place: MeetingPlace;
  commitment: Commitment;
  editable: boolean;
  accessToken: string;
}) {
  const text = useT().jbp.commitments;
  const date = useDate();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const change = async (status: CommitmentStatus) => {
    setFailed(false);
    try {
      await setCommitmentStatus(accessToken, apiBase(place), commitment.id, status);
      await queryClient.invalidateQueries({ queryKey: ['jbp'] });
    } catch {
      setFailed(true);
    }
  };
  return (
    <li
      id={commitment.id}
      data-commitment={commitment.id}
      data-overdue={commitment.overdue || undefined}
      className={cn(
        'flex scroll-mt-32 flex-col gap-2 border-border border-b px-5 py-4 last:border-b-0',
        commitment.overdue && 'border-l-4 border-l-destructive',
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-semibold">{commitment.title}</span>
          <span className="text-muted-foreground text-sm">
            {commitment.ownerName} · {text.due(date(commitment.dueOn))}
            {commitment.initiative && ` · ${commitment.initiative.title}`}
          </span>
        </div>
        {commitment.overdue ? (
          <Badge variant="danger">
            <TriangleAlertIcon aria-hidden />
            {text.statuses.overdue}
          </Badge>
        ) : (
          <Badge variant={statusVariant[commitment.status]}>
            {text.statuses[commitment.status]}
          </Badge>
        )}
      </div>
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <NativeSelect
              aria-label={text.statusLabel(commitment.title)}
              value={commitment.status}
              onChange={(event) => void change(event.target.value as CommitmentStatus)}
            >
              {commitmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {text.statuses[status]}
                </option>
              ))}
            </NativeSelect>
          </div>
          {routerLink({
            href: `${commitmentsPath(place)}/${commitment.id}`,
            className: buttonVariants({ variant: 'outline', size: 'sm' }),
            'aria-label': `${commitment.title}: ${text.edit}`,
            children: text.edit,
          })}
        </div>
      )}
      {failed && <p className="text-destructive text-sm">{text.saveFailed}</p>}
    </li>
  );
}

/** Neue oder geänderte Zusage der eigenen Seite, auf eigener Seite. */
export function JbpCommitmentFormPage({
  place,
  commitmentId,
}: {
  place: MeetingPlace;
  commitmentId?: string;
}) {
  const text = useT().jbp.commitments;
  const query = useCommitments(place);
  const title = commitmentId ? text.editTitle : text.new;
  const existing = commitmentId
    ? [...(query.data?.buyer ?? []), ...(query.data?.supplier ?? [])].find(
        (entry) => entry.id === commitmentId && entry.own,
      )
    : undefined;
  return (
    <JbpFrame
      place={place}
      trail={[{ label: text.title, href: commitmentsPath(place) }]}
      current={title}
      header={<PageHeader title={title} />}
    >
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : commitmentId && !existing ? (
        <ErrorState title={text.notFound} />
      ) : !query.data.canEdit ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.noPermission}
        </p>
      ) : (
        <CommitmentForm
          place={place}
          accessToken={query.accessToken}
          data={query.data}
          existing={existing}
        />
      )}
    </JbpFrame>
  );
}

function CommitmentForm({
  place,
  accessToken,
  data,
  existing,
}: {
  place: MeetingPlace;
  accessToken: string;
  data: Commitments;
  existing?: Commitment | undefined;
}) {
  const text = useT().jbp.commitments;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    title: existing?.title ?? '',
    ownerUserId: existing?.ownerUserId ?? '',
    dueOn: existing?.dueOn ?? '',
    initiativeId: existing?.initiative?.id ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const next: Record<string, string> = {};
    for (const key of ['title', 'ownerUserId', 'dueOn'] as const) {
      if (!values[key].trim()) next[key] = text.required;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const request = {
      title: values.title.trim(),
      ownerUserId: values.ownerUserId,
      dueOn: values.dueOn,
      initiativeId: values.initiativeId || null,
    };
    setSaving(true);
    try {
      if (existing) await updateCommitment(accessToken, apiBase(place), existing.id, request);
      else await createCommitment(accessToken, apiBase(place), request);
      await queryClient.invalidateQueries({ queryKey: ['jbp'] });
      flash.set(text.saved);
      await navigate({ to: commitmentsPath(place) });
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
      <FormField label={text.titleLabel} hint={text.titleHint} error={errors.title}>
        {(field) => (
          <Input
            {...field}
            maxLength={200}
            value={values.title}
            onChange={(event) => set('title')(event.target.value)}
          />
        )}
      </FormField>
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label={text.owner} error={errors.ownerUserId}>
          {(field) => (
            <NativeSelect
              {...field}
              value={values.ownerUserId}
              onChange={(event) => set('ownerUserId')(event.target.value)}
            >
              <option value="">{text.owner}</option>
              {data.people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.dueOn} error={errors.dueOn}>
          {(field) => (
            <Input
              {...field}
              type="date"
              value={values.dueOn}
              onChange={(event) => set('dueOn')(event.target.value)}
            />
          )}
        </FormField>
      </div>
      {data.initiatives.length > 0 && (
        <FormField label={text.initiative}>
          {(field) => (
            <NativeSelect
              {...field}
              value={values.initiativeId}
              onChange={(event) => set('initiativeId')(event.target.value)}
            >
              <option value="">{text.noInitiative}</option>
              {data.initiatives.map((initiative) => (
                <option key={initiative.id} value={initiative.id}>
                  {initiative.title}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      )}
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
        </p>
      )}
      <FormActions>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void navigate({ to: commitmentsPath(place) })}
        >
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {existing ? text.save : text.create}
        </Button>
      </FormActions>
    </form>
  );
}
