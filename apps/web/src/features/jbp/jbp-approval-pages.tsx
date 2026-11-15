import type { JbpApprovalView, JbpContent, JbpDecision, MeetingSide } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Tile } from '@/components/ui/tile';
import { apiBase, type MeetingPlace } from '@/features/meetings/meeting-pages';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import {
  decideJbp,
  jbpApprovalQueryOptions,
  jbpVersionsQueryOptions,
  startJbpVersion,
  submitJbp,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { JbpFrame, useToken } from './jbp-pages';

// JBP-06: Freigabe und Versionen des Gemeinsamen Plans unter Gemeinsamer Plan › Freigabe.

export const approvalPath = ({ side, relationshipId }: MeetingPlace) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/plan/freigabe`
    : `/kunden/${relationshipId}/plan/freigabe`;

export const versionsPath = (place: MeetingPlace) =>
  approvalPath(place).replace(/\/freigabe$/, '/versionen');

/** Freigabe: Status, Stand beider Seiten, ein Knopf für die nächste Aktion, Entscheidungen. */
export function JbpApprovalPage({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.approval;
  return (
    <JbpFrame
      place={place}
      trail={[]}
      current={text.title}
      header={<PageHeader title={text.title} purpose={text.purpose} />}
    >
      <ApprovalContent place={place} />
    </JbpFrame>
  );
}

function ApprovalContent({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.approval;
  const format = useFormat();
  const accessToken = useToken();
  const query = useQuery({
    ...jbpApprovalQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
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
  // Entscheidungen sind neueste zuerst. Die des Lieferanten gilt nur, wenn sie nach der letzten
  // Einreichung des Käufers kam; eine Rückgabe aus der Runde davor ist erledigt.
  const buyerLatest = data.decisions.find((entry) => entry.side === 'buyer');
  const supplierLatest = data.decisions.find((entry) => entry.side === 'supplier');
  const latest = (side: MeetingSide) =>
    side === 'buyer'
      ? buyerLatest
      : supplierLatest && (!buyerLatest || supplierLatest.decidedAt > buyerLatest.decidedAt)
        ? supplierLatest
        : undefined;
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <Tile
        tone={data.status === 'approved' ? 'shared' : 'card'}
        size="lg"
        data-slot="approval-status"
        className="gap-2"
      >
        <p className="font-semibold text-primary text-sm">{text.version(data.version)}</p>
        <p className="font-display font-semibold text-2xl tracking-title">{text.statuses[data.status]}</p>
        {data.approvedAt && (
          <p className="text-muted-foreground">{text.approvedBoth(format.date(data.approvedAt))}</p>
        )}
      </Tile>

      <div className="grid gap-4 sm:grid-cols-2">
        {(['buyer', 'supplier'] as MeetingSide[]).map((side) => (
          <SideState key={side} side={side} decision={latest(side)} />
        ))}
      </div>

      <NextAction place={place} accessToken={accessToken} data={data} />

      {data.decisions.length > 0 && (
        <section aria-labelledby="freigabe-entscheidungen" className="flex flex-col gap-3">
          <h2 id="freigabe-entscheidungen" className="font-display font-semibold text-xl tracking-title">
            {text.history}
          </h2>
          <ol className="overflow-hidden rounded-lg bg-card shadow-card">
            {data.decisions.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 border-line-soft border-b px-5 py-3 last:border-b-0"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant={entry.decision === 'approved' ? 'success' : 'warning'}>
                    {text.decisions[entry.decision]}
                  </Badge>
                  <span className="font-semibold">{text.sides[entry.side]}</span>
                  <span className="text-muted-foreground text-sm">
                    {text.decisionBy(entry.userName, format.dateTime(entry.decidedAt))}
                  </span>
                </span>
                {entry.comment && <span className="whitespace-pre-line">{entry.comment}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {routerLink({
        href: versionsPath(place),
        className: cn(buttonVariants({ variant: 'link' }), 'self-start px-0 has-[>svg]:px-0'),
        children: (
          <>
            {text.toVersions}
            <ChevronRightIcon aria-hidden />
          </>
        ),
      })}
    </div>
  );
}

function SideState({ side, decision }: { side: MeetingSide; decision: JbpDecision | undefined }) {
  const text = useT().jbp.approval;
  const format = useFormat();
  return (
    <Tile data-side={side} className="gap-2">
      <p className="font-semibold">{text.sides[side]}</p>
      {decision ? (
        <>
          <Badge variant={decision.decision === 'approved' ? 'success' : 'warning'}>
            {text.decisions[decision.decision]}
          </Badge>
          <p className="text-muted-foreground text-sm">
            {text.decisionBy(decision.userName, format.dateTime(decision.decidedAt))}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">{text.sideOpen}</p>
      )}
    </Tile>
  );
}

/** Genau eine Hauptaktion je Stand und Seite; sonst ein Satz, worauf gewartet wird. */
function NextAction({
  place,
  accessToken,
  data,
}: {
  place: MeetingPlace;
  accessToken: string;
  data: JbpApprovalView;
}) {
  const text = useT().jbp.approval;
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    setFailed(false);
    setBusy(true);
    try {
      await work();
      await queryClient.invalidateQueries({ queryKey: ['jbp'] });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const base = apiBase(place);
  let content: React.ReactNode;
  if (data.canSubmit) {
    content = (
      <>
        <p className="text-muted-foreground">{text.submitHint}</p>
        <Button
          className="self-start"
          loading={busy}
          onClick={() => void run(() => submitJbp(accessToken, base))}
        >
          {text.submit}
        </Button>
      </>
    );
  } else if (data.canDecide) {
    content = (
      <>
        <p className="text-muted-foreground">{text.decideHint}</p>
        <Button
          className="self-start"
          loading={busy}
          onClick={() =>
            void run(() => decideJbp(accessToken, base, { decision: 'approved', comment: null }))
          }
        >
          {text.approve}
        </Button>
        <div className="flex flex-col gap-3 border-line-soft border-t pt-4">
          <FormField
            label={text.returnReason}
            hint={text.returnHint}
            error={reasonError ?? undefined}
          >
            {(field) => (
              <Textarea
                {...field}
                rows={3}
                maxLength={2000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </FormField>
          <Button
            variant="outline"
            className="self-start"
            onClick={() => {
              if (!reason.trim()) {
                setReasonError(text.required);
                return;
              }
              setReasonError(null);
              void run(() =>
                decideJbp(accessToken, base, { decision: 'returned', comment: reason.trim() }),
              );
            }}
          >
            {text.returnLabel}
          </Button>
        </div>
      </>
    );
  } else if (data.canNewVersion) {
    content = (
      <>
        <p className="text-muted-foreground">{text.newVersionHint}</p>
        <div>
          <ConfirmButton
            question={text.newVersionQuestion}
            confirmLabel={text.newVersion}
            cancelLabel={text.cancel}
            variant="default"
            onConfirm={() => void run(() => startJbpVersion(accessToken, base))}
          >
            {text.newVersion}
          </ConfirmButton>
        </div>
      </>
    );
  } else if (data.status === 'in_review') {
    content = <p className="text-muted-foreground">{text.waitingSupplier}</p>;
  } else if (data.status === 'draft') {
    content = <p className="text-muted-foreground">{text.waitingBuyer}</p>;
  } else {
    return null;
  }
  return (
    <section data-slot="next-action" className="flex flex-col gap-3 rounded-lg bg-card shadow-card p-5">
      {content}
      {failed && (
        <p role="alert" className="text-destructive">
          {text.actionFailed}
        </p>
      )}
    </section>
  );
}

type Section = keyof JbpContent;
type Entry = Record<string, string>;

/** Unterschiede zweier Versionen je Abschnitt, nach Titel (und Seite) zugeordnet. */
export function compareContent(older: JbpContent, newer: JbpContent) {
  const key = (entry: Entry) => `${entry.side ?? ''}|${entry.title}`;
  return (['topics', 'initiatives', 'commitments'] as Section[]).map((section) => {
    const before = new Map((older[section] as Entry[]).map((entry) => [key(entry), entry]));
    const after = new Map((newer[section] as Entry[]).map((entry) => [key(entry), entry]));
    const added = [...after.values()].filter((entry) => !before.has(key(entry)));
    const removed = [...before.values()].filter((entry) => !after.has(key(entry)));
    const changed = [...after.values()].flatMap((entry) => {
      const previous = before.get(key(entry));
      if (!previous) return [];
      const fields = Object.keys(entry).filter((field) => entry[field] !== previous[field]);
      return fields.length > 0 ? [{ title: entry.title as string, fields, previous, entry }] : [];
    });
    return { section, added, removed, changed };
  });
}

/** Versionen: Liste der freigegebenen Versionen und Vergleich zweier Versionen. */
export function JbpVersionsPage({
  place,
  from,
  to,
}: {
  place: MeetingPlace;
  from?: number | undefined;
  to?: number | undefined;
}) {
  const text = useT().jbp.approval;
  const accessToken = useToken();
  const navigate = useNavigate();
  const format = useFormat();
  const { locale } = useLocale();
  const query = useQuery({
    ...jbpVersionsQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
  const versions = query.data?.versions ?? [];
  const newer = versions.find((entry) => entry.version === to) ?? versions[0];
  const older =
    versions.find((entry) => entry.version === from) ??
    versions.find((entry) => newer && entry.version < newer.version);
  const differences = older && newer ? compareContent(older.content, newer.content) : [];
  const pick = (which: 'von' | 'bis', value: string) =>
    void navigate({
      to: versionsPath(place),
      search: {
        von: which === 'von' ? Number(value) : older?.version,
        bis: which === 'bis' ? Number(value) : newer?.version,
      },
    });
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${iso}T00:00:00`));
  const value = (field: string, raw: string) =>
    field === 'startsOn' || field === 'endsOn' || field === 'dueOn' ? day(raw) : raw;
  return (
    <JbpFrame
      place={place}
      trail={[{ label: text.title, href: approvalPath(place) }]}
      current={text.versions}
      header={<PageHeader title={text.versions} purpose={text.versionsPurpose} />}
    >
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : versions.length === 0 ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.versionsEmpty}
        </p>
      ) : (
        <div className="flex max-w-4xl flex-col gap-8">
          <ol aria-label={text.versions} className="overflow-hidden rounded-lg bg-card shadow-card">
            {versions.map((entry) => (
              <li
                key={entry.version}
                data-version={entry.version}
                className="flex flex-wrap items-baseline gap-x-3 border-line-soft border-b px-5 py-3 last:border-b-0"
              >
                <span className="font-semibold">{text.version(entry.version)}</span>
                <span className="text-muted-foreground text-sm">
                  {text.approvedOn(format.date(entry.approvedAt))} · {text.sections.initiatives}:{' '}
                  {entry.content.initiatives.length} · {text.sections.commitments}:{' '}
                  {entry.content.commitments.length}
                </span>
              </li>
            ))}
          </ol>
          {older && newer && (
            <section aria-labelledby="versionen-vergleich" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-4">
                <h2 id="versionen-vergleich" className="grow font-display font-semibold text-xl tracking-title">
                  {text.compareTitle(older.version, newer.version)}
                </h2>
                <div className="w-40">
                  <NativeSelect
                    aria-label={text.compareFrom}
                    value={older.version}
                    onChange={(event) => pick('von', event.target.value)}
                  >
                    {versions.map((entry) => (
                      <option key={entry.version} value={entry.version}>
                        {text.version(entry.version)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="w-40">
                  <NativeSelect
                    aria-label={text.compareTo}
                    value={newer.version}
                    onChange={(event) => pick('bis', event.target.value)}
                  >
                    {versions.map((entry) => (
                      <option key={entry.version} value={entry.version}>
                        {text.version(entry.version)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              {differences.map(({ section, added, removed, changed }) => (
                <div key={section} data-section={section} className="flex flex-col gap-2">
                  <h3 className="font-semibold">{text.sections[section]}</h3>
                  {added.length + removed.length + changed.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{text.unchanged}</p>
                  ) : (
                    <ul className="overflow-hidden rounded-lg bg-card shadow-card">
                      {added.map((entry) => (
                        <li
                          key={`+${entry.title}`}
                          className="flex gap-3 border-line-soft border-b px-5 py-3 last:border-b-0"
                        >
                          <Badge variant="success">{text.added}</Badge>
                          <span>{entry.title}</span>
                        </li>
                      ))}
                      {removed.map((entry) => (
                        <li
                          key={`-${entry.title}`}
                          className="flex gap-3 border-line-soft border-b px-5 py-3 last:border-b-0"
                        >
                          <Badge variant="warning">{text.removed}</Badge>
                          <span className="text-muted-foreground line-through">{entry.title}</span>
                        </li>
                      ))}
                      {changed.map((entry) => (
                        <li
                          key={`~${entry.title}`}
                          className="flex flex-col gap-1 border-line-soft border-b px-5 py-3 last:border-b-0"
                        >
                          <span className="flex gap-3">
                            <Badge variant="selected">{text.changed}</Badge>
                            <span>{entry.title}</span>
                          </span>
                          {entry.fields.map((field) => (
                            <span key={field} className="text-muted-foreground text-sm">
                              {text.fields[field] ?? field}:{' '}
                              {value(field, entry.previous[field] ?? '')} →{' '}
                              {value(field, entry.entry[field] ?? '')}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </JbpFrame>
  );
}
