import type { MailCommitment, MailCommitmentsView, MailReplyVariant } from '@reziproq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { BackLink } from '@/components/ui/back-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { PageTitle } from '@/components/ui/page-title';
import { PrivateNote } from '@/components/ui/private-note';
import { Row, RowGroup } from '@/components/ui/row-group';
import { SoWhat } from '@/components/ui/so-what';
import { StatusLine } from '@/components/ui/status-line';
import { StepRing } from '@/components/ui/step-ring';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { shortDate } from '@/features/start/next-action';
import {
  ApiError,
  discardMailDraft,
  mailDraftQueryOptions,
  mailDraftVariant,
  updateMailDraft,
} from '@/lib/api';
import { appNow } from '@/lib/clock';
import { useLocale, useMessages } from '@/lib/i18n';
import { localeTags } from '@/lib/money';
import { mailDraftMessages } from './mail-draft-messages';

/**
 * PO-01 (K2-d.3b): Entwurf „Zusagen aus Mail“ nach der Vorlage K2-Mail-Zusage. Die Seite öffnet aus
 * Heute (E-K0-27); deshalb nennt der Titel die Aufgabe und der Kopf führt nach Heute zurück, nicht
 * „Kurz prüfen“ wie in der Vorlage. Freigeben und senden kommt mit K2-d.4.
 */
export function MailDraftPage({ draftId }: { draftId: string }) {
  const text = useMessages(mailDraftMessages);
  const accessToken = useToken();
  const query = useQuery({
    ...mailDraftQueryOptions(accessToken, draftId),
    enabled: accessToken !== '',
  });
  const back = <BackLink label={text.back} href="/heute" renderLink={routerLink} />;
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex flex-col gap-5.5">
        <PageTitle title={text.back} back={back} />
        <ErrorState
          title={missing ? text.missing : text.failed}
          action={
            missing ? undefined : (
              <Button variant="secondary" onClick={() => query.refetch()}>
                {text.retry}
              </Button>
            )
          }
        />
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="flex flex-col gap-5.5">
        <PageTitle title={text.back} back={back} />
        <LoadingState label={text.loading} />
      </div>
    );
  }
  return <Draft data={query.data} back={back} />;
}

function Draft({ data, back }: { data: MailCommitmentsView; back: React.ReactNode }) {
  const text = useMessages(mailDraftMessages);
  const { locale } = useLocale();
  const accessToken = useToken();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [owners, setOwners] = useState<Record<number, string>>({});
  const [dues, setDues] = useState<Record<number, string>>({});
  const [reply, setReply] = useState(data.reply.text);
  const time = (iso: string) =>
    new Intl.DateTimeFormat(localeTags[locale], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Berlin',
    }).format(new Date(iso));
  const sender = data.mail.fromName;
  const counterpart = data.relationship.name;
  const title = text.title(sender);
  useDocumentTitle(title);
  const today = appNow().toISOString().slice(0, 10);
  const own = data.commitments.find((entry) => entry.side === 'buyer') ?? null;
  // E-K2-13: Wer eine Zusage des Lieferanten trägt, und die Absenderin bekommen einen Link
  const linked = [
    ...new Set([
      ...data.commitments.filter((entry) => entry.side === 'supplier').map((e) => e.ownerName),
      sender,
    ]),
  ];
  const listed =
    linked.length <= 1
      ? (linked[0] ?? sender)
      : `${linked.slice(0, -1).join(', ')} ${locale === 'de' ? 'und' : 'and'} ${linked.at(-1)}`;
  const overdue = data.commitments.filter(
    (entry) => entry.replaces && entry.replaces.dueOn < today && entry.dueOn,
  );
  const done = (view: MailCommitmentsView, note: string | null) => {
    client.setQueryData(mailDraftQueryOptions(accessToken, data.draftId).queryKey, view);
    void client.invalidateQueries({ queryKey: ['heute'] });
    setMessage(note);
  };
  const save = useMutation({
    mutationFn: () =>
      updateMailDraft(accessToken, data.draftId, {
        commitments: data.commitments.flatMap((entry, index) => {
          const ownerName = owners[index]?.trim();
          const dueOn = dues[index];
          const changed = {
            ...(ownerName && ownerName !== entry.ownerName ? { ownerName } : {}),
            ...(dueOn && dueOn !== entry.dueOn ? { dueOn } : {}),
          };
          return Object.keys(changed).length > 0 ? [{ index, ...changed }] : [];
        }),
        ...(reply.trim() && reply !== data.reply.text ? { replyText: reply.trim() } : {}),
      }),
    onSuccess: (view) => {
      setEditing(false);
      done(view, text.saved);
    },
  });
  const variant = useMutation({
    mutationFn: (value: MailReplyVariant) => mailDraftVariant(accessToken, data.draftId, value),
    onSuccess: (view) => {
      setReply(view.reply.text);
      done(view, null);
    },
  });
  const discard = useMutation({
    mutationFn: () => discardMailDraft(accessToken, data.draftId, reason.trim()),
    onSuccess: (view) => {
      setDiscarding(false);
      done(view, text.discarded(reason.trim()));
    },
  });
  const open = data.status === 'draft' && data.canDecide;

  const row = (entry: MailCommitment) => {
    const supplier = entry.side === 'supplier';
    const due = entry.dueOn ? shortDate(locale, entry.dueOn) : null;
    const replaced = entry.replaces;
    const detail = [
      supplier ? counterpart : text.ownSide,
      entry.ownerName,
      replaced
        ? text.replaces(shortDate(locale, replaced.dueOn), replaced.dueOn < today)
        : supplier
          ? null
          : text.fresh,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <Row
        key={entry.quote || entry.title}
        lead={
          <Monogram
            name={supplier ? counterpart : data.ownOrganization}
            tone={supplier ? 'petrol' : 'ink'}
          />
        }
        title={text.commitmentTitle(entry.title, due)}
        detail={detail}
        value={
          // Auf dem Telefon steht die Seite schon in der Unterzeile; der Chip nähme dem Titel Platz
          <span className="hidden shell:inline-flex">
            {supplier ? (
              <Badge variant="shared">{counterpart}</Badge>
            ) : (
              <Badge variant="warning">{text.ownSide}</Badge>
            )}
          </span>
        }
        wrap
      />
    );
  };

  return (
    <div className="flex flex-col gap-5.5">
      <PageTitle
        title={title}
        where={text.where(counterpart, time(data.mail.sentAt))}
        back={back}
      />
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
          <AiDraft
            heading={text.heading(time(data.createdAt))}
            sourcesLabel={text.sources}
            sources={[
              { key: 'mail', label: text.sourceMail },
              { key: 'zusagen', label: text.sourceCommitments },
            ]}
            className="gap-4 p-5"
          >
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                {text.context(counterpart, data.mail.assignedBy === 'reziproq')}
              </p>
              <h2 className="text-balance font-display font-semibold text-section tracking-section">
                {text.task(data.commitments.length, sender)}
              </h2>
              <PrivateNote
                title={text.mailTitle(sender, time(data.mail.sentAt))}
                chip={text.mailOnly}
              >
                {data.mail.summary ?? text.noSummary}
              </PrivateNote>
              <RowGroup tone="shared" label={text.middle}>
                {data.commitments.map(row)}
              </RowGroup>
              {editing && (
                <div className="flex flex-col gap-3">
                  {data.commitments.map((entry, index) => (
                    <div
                      key={`edit-${entry.quote || entry.title}`}
                      className="grid gap-3 shell:grid-cols-2"
                    >
                      <FormField label={`${text.owner}: ${entry.title}`}>
                        {(field) => (
                          <Input
                            {...field}
                            value={owners[index] ?? entry.ownerName}
                            onChange={(event) =>
                              setOwners({ ...owners, [index]: event.target.value })
                            }
                          />
                        )}
                      </FormField>
                      <FormField label={`${text.due}: ${entry.title}`}>
                        {(field) => (
                          <Input
                            {...field}
                            type="date"
                            value={dues[index] ?? entry.dueOn ?? ''}
                            onChange={(event) => setDues({ ...dues, [index]: event.target.value })}
                          />
                        )}
                      </FormField>
                    </div>
                  ))}
                </div>
              )}
              <AiDraft
                heading={text.reply(data.ownOrganization)}
                sourcesLabel={text.sources}
                sources={[]}
              >
                {editing ? (
                  <FormField label={text.replyLabel}>
                    {(field) => (
                      <Textarea
                        {...field}
                        rows={9}
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                      />
                    )}
                  </FormField>
                ) : (
                  <p className="whitespace-pre-line text-base">{data.reply.text}</p>
                )}
                {open && !editing && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      [
                        ['kuerzer', text.shorter],
                        ['foermlicher', text.formal],
                        ['englisch', text.english],
                      ] as const
                    ).map(([key, label]) => (
                      <Button
                        key={key}
                        variant="secondary"
                        size="sm"
                        loading={variant.isPending && variant.variables === key}
                        onClick={() => variant.mutate(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                )}
              </AiDraft>
              {open && !discarding && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2.5">
                    <Button disabled aria-describedby="freigabe-folgt">
                      {text.approve}
                    </Button>
                    {editing ? (
                      <>
                        <Button
                          variant="secondary"
                          loading={save.isPending}
                          onClick={() => save.mutate()}
                        >
                          {text.save}
                        </Button>
                        <Button variant="secondary" onClick={() => setEditing(false)}>
                          {text.cancel}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => setEditing(true)}>
                          {text.adjust}
                        </Button>
                        <Button variant="secondary" onClick={() => setDiscarding(true)}>
                          {text.discard}
                        </Button>
                      </>
                    )}
                  </div>
                  <p id="freigabe-folgt" className="text-muted-foreground text-sm">
                    {text.approveLater}
                  </p>
                </div>
              )}
              {open && discarding && (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (reason.trim()) discard.mutate();
                  }}
                >
                  <FormField label={text.reason}>
                    {(field) => (
                      <Textarea
                        {...field}
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    )}
                  </FormField>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={!reason.trim()}
                      loading={discard.isPending}
                    >
                      {text.discardYes}
                    </Button>
                    <Button variant="secondary" onClick={() => setDiscarding(false)}>
                      {text.cancel}
                    </Button>
                  </div>
                </form>
              )}
              {data.status === 'draft' && !data.canDecide && (
                <p className="text-muted-foreground text-sm">{text.readOnly}</p>
              )}
            </div>
          </AiDraft>
        </div>
        <aside className="flex min-w-0 flex-col gap-5.5">
          <RowGroup label={text.next}>
            <Row
              lead={<StepRing state="done" number={1} doneLabel={text.stepAssigned} size="sm" />}
              title={text.stepAssigned}
              detail={text.stepAssignedDetail(time(data.mail.sentAt), counterpart)}
              wrap
            />
            <Row
              lead={
                <StepRing
                  state={data.status === 'draft' ? 'current' : 'done'}
                  number={2}
                  doneLabel={text.stepApprove}
                  size="sm"
                />
              }
              title={text.stepApprove}
              detail={text.stepApproveDetail(own?.ownerName ?? null)}
              wrap
            />
            <Row
              lead={<StepRing state="open" number={3} doneLabel="" size="sm" />}
              title={text.stepConfirm(counterpart)}
              detail={text.stepConfirmDetail(listed)}
              wrap
            />
            <Row
              lead={<StepRing state="open" number={4} doneLabel="" size="sm" />}
              title={text.stepCount}
              detail={text.stepCountDetail}
              wrap
            />
          </RowGroup>
          <SoWhat
            heading={text.today}
            statement={overdue[0] ? text.todayOverdue(overdue[0].title) : text.todayNone}
          >
            {overdue[0]?.dueOn && (
              <p className="text-muted-foreground text-sm">
                {text.todayOverdueDetail(shortDate(locale, overdue[0].dueOn))}
              </p>
            )}
          </SoWhat>
          <PrivateNote title={text.guardrail} chip={text.guardrailChip}>
            {text.guardrailText(own?.ownerName ?? null)}
          </PrivateNote>
        </aside>
      </div>
    </div>
  );
}
