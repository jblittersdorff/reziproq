import {
  type FormatCadence,
  type FormatLevel,
  formatCadences,
  formatLevels,
  type SaveTouchpoint,
  saveTouchpointSchema,
  type Touchpoint,
  type TouchpointList,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, PlusIcon, Share2Icon, Trash2Icon, UsersIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { useGoBack } from '@/features/shell/page-path';
import { TeamFrame } from '@/features/suppliers/team-page';
import {
  ApiError,
  deleteTouchpoint,
  reviewTouchpoints,
  saveTouchpoint,
  shareTouchpoint,
  type TeamSide,
  touchpointsQueryOptions,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { sortTouchpoints, TouchpointPicture } from './touchpoint-picture';

/** Adresse der Kontaktpunkte je Seite (PLB-06). */
export const touchpointsPath = (side: TeamSide, relationshipId: string) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/beziehung/kontaktpunkte`
    : `/kunden/${relationshipId}/beziehung/kontaktpunkte`;

function useTouchpoints(relationshipId: string, side: TeamSide) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...touchpointsQueryOptions(accessToken, relationshipId, side),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

/**
 * Beziehung › Kontaktpunkte (PLB-06): Lücken zu den Spielregeln oben, dann Bild und Liste.
 * Beim Lieferanten nur die geteilten, ohne Bearbeiten.
 */
export function TouchpointsPage({
  relationshipId,
  side = 'buyer',
}: {
  relationshipId: string;
  side?: TeamSide;
}) {
  const t = useT();
  const text = t.touchpoints;
  const query = useTouchpoints(relationshipId, side);
  const [message, hideMessage] = useFlash();
  return (
    <TeamFrame side={side} relationshipId={relationshipId} current={text.title}>
      <PageHeader
        title={text.title}
        purpose={side === 'buyer' ? text.purpose : text.supplierPurpose}
      />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <TouchpointsContent
          list={query.data}
          side={side}
          relationshipId={relationshipId}
          accessToken={query.accessToken}
        />
      )}
    </TeamFrame>
  );
}

function TouchpointsContent({
  list,
  side,
  relationshipId,
  accessToken,
}: {
  list: TouchpointList;
  side: TeamSide;
  relationshipId: string;
  accessToken: string;
}) {
  const t = useT();
  const text = t.touchpoints;
  const { locale } = useLocale();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const base = touchpointsPath(side, relationshipId);
  const key = touchpointsQueryOptions(accessToken, relationshipId, side).queryKey;

  const run = async (work: () => Promise<TouchpointList | null>, done: string) => {
    setFailed(false);
    setStatus(null);
    try {
      const next = await work();
      if (next) queryClient.setQueryData(key, next);
      else await queryClient.invalidateQueries({ queryKey: key });
      // Der Zyklus-Schritt Kontaktpunkte steht im Überblick.
      void queryClient.invalidateQueries({ queryKey: ['suppliers', relationshipId] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      setStatus(done);
    } catch {
      setFailed(true);
    }
  };

  const newLink = list.canEdit
    ? routerLink({
        href: `${base}/neu`,
        className: buttonVariants(),
        children: (
          <>
            <PlusIcon />
            {text.new}
          </>
        ),
      })
    : null;

  return (
    <>
      {status && <StatusLine message={status} onHidden={() => setStatus(null)} />}
      {failed && <StatusLine message={text.saveFailed} tone="warning" />}
      {list.gaps.length > 0 && (
        <section
          aria-labelledby="kontaktpunkte-luecken"
          className="flex flex-col gap-2 rounded-lg bg-warning-soft px-4 py-3 text-warning-soft-foreground"
        >
          <h2 id="kontaktpunkte-luecken" className="font-semibold">
            {text.gapsTitle}
          </h2>
          <ul className="flex list-disc flex-col gap-1 ps-5">
            {list.gaps.map((gap) => (
              <li key={gap.title.de}>{text.gap(gap.title[locale])}</li>
            ))}
          </ul>
        </section>
      )}
      {(newLink || list.canReview || list.review) && (
        <div className="flex flex-wrap items-center gap-3">
          {newLink}
          {list.canReview && (
            <Button
              variant="secondary"
              onClick={() =>
                void run(() => reviewTouchpoints(accessToken, relationshipId), text.review)
              }
            >
              <CheckIcon />
              {text.review}
            </Button>
          )}
          {list.review ? (
            <span className="text-muted-foreground text-sm">
              {text.reviewed(list.review.reviewedByName, format.date(list.review.reviewedAt))}
            </span>
          ) : (
            list.canReview && (
              <span className="text-muted-foreground text-sm">{text.reviewHint}</span>
            )
          )}
        </div>
      )}
      {list.touchpoints.length === 0 ? (
        <EmptyState
          size="lg"
          icon={<UsersIcon aria-hidden />}
          title={side === 'buyer' ? text.emptyTitle : text.supplierEmptyTitle}
          description={side === 'buyer' ? text.emptyDescription : text.supplierEmptyDescription}
        />
      ) : (
        <>
          <TouchpointPicture touchpoints={list.touchpoints} side={side} />
          <ul aria-label={text.list} className="flex flex-col gap-3">
            {sortTouchpoints(list.touchpoints).map((touchpoint) => (
              <TouchpointRow
                key={touchpoint.id}
                touchpoint={touchpoint}
                canEdit={list.canEdit}
                editHref={`${base}/${touchpoint.id}`}
                onShare={() =>
                  void run(async () => {
                    await shareTouchpoint(accessToken, relationshipId, touchpoint.id);
                    return null;
                  }, text.shared)
                }
                onRemove={() =>
                  void run(
                    () => deleteTouchpoint(accessToken, relationshipId, touchpoint.id),
                    text.removed,
                  )
                }
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function TouchpointRow({
  touchpoint,
  canEdit,
  editHref,
  onShare,
  onRemove,
}: {
  touchpoint: Touchpoint;
  canEdit: boolean;
  editHref: string;
  onShare: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const text = t.touchpoints;
  return (
    <li className="flex flex-col gap-3 rounded-lg bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium">
          {touchpoint.buyerName} ↔ {touchpoint.supplierName}
        </p>
        <p className="text-muted-foreground text-sm">
          {text.levels[touchpoint.buyerLevel]} ↔ {text.levels[touchpoint.supplierLevel]} ·{' '}
          {touchpoint.format} · {text.cadences[touchpoint.cadence]}
        </p>
        {touchpoint.notes && <p className="text-sm">{touchpoint.notes}</p>}
      </div>
      <VisibilityBadge
        visibility={touchpoint.visibility}
        label={t.team.visibilities[touchpoint.visibility] ?? ''}
      />
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {routerLink({
            href: editHref,
            className: buttonVariants({ variant: 'outline' }),
            'aria-label': text.editLabel(touchpoint.supplierName),
            children: text.edit,
          })}
          {touchpoint.visibility === 'internal' && (
            <ConfirmButton
              variant="default"
              question={text.shareQuestion}
              confirmLabel={text.shareConfirm}
              cancelLabel={text.cancel}
              onConfirm={onShare}
            >
              <Share2Icon />
              {text.share}
              <span className="sr-only">: {touchpoint.supplierName}</span>
            </ConfirmButton>
          )}
          <ConfirmButton
            question={text.removeQuestion}
            confirmLabel={text.removeConfirm}
            cancelLabel={text.cancel}
            onConfirm={onRemove}
          >
            <Trash2Icon />
            {text.remove}
            <span className="sr-only">: {touchpoint.supplierName}</span>
          </ConfirmButton>
        </div>
      )}
    </li>
  );
}

/** Kontaktpunkt anlegen oder bearbeiten, auf eigener Seite (PLB-06). */
export function TouchpointFormPage({
  relationshipId,
  touchpointId,
}: {
  relationshipId: string;
  touchpointId?: string;
}) {
  const text = useT().touchpoints;
  const query = useTouchpoints(relationshipId, 'buyer');
  const base = touchpointsPath('buyer', relationshipId);
  const title = touchpointId ? text.editTitle : text.new;
  const existing = touchpointId
    ? query.data?.touchpoints.find((entry) => entry.id === touchpointId)
    : undefined;
  return (
    <TeamFrame
      side="buyer"
      relationshipId={relationshipId}
      trail={[{ label: text.title, href: base }]}
      current={title}
    >
      <PageHeader title={title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : touchpointId && !existing ? (
        <ErrorState title={text.notFound} />
      ) : !query.data.canEdit ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.noPermission}
        </p>
      ) : (
        <TouchpointForm
          list={query.data}
          existing={existing}
          relationshipId={relationshipId}
          accessToken={query.accessToken}
          base={base}
        />
      )}
    </TeamFrame>
  );
}

const other = '__andere';

function TouchpointForm({
  list,
  existing,
  relationshipId,
  accessToken,
  base,
}: {
  list: TouchpointList;
  existing: Touchpoint | undefined;
  relationshipId: string;
  accessToken: string;
  base: string;
}) {
  const t = useT();
  const text = t.touchpoints;
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const goBack = useGoBack(base);
  const [buyerChoice, setBuyerChoice] = useState(existing ? (existing.buyerUserId ?? other) : '');
  const [buyerName, setBuyerName] = useState(
    existing && !existing.buyerUserId ? existing.buyerName : '',
  );
  const [buyerLevel, setBuyerLevel] = useState<FormatLevel>(existing?.buyerLevel ?? 'management');
  const [supplierChoice, setSupplierChoice] = useState(
    existing ? (existing.supplierContactId ?? other) : '',
  );
  const [supplierName, setSupplierName] = useState(
    existing && !existing.supplierContactId ? existing.supplierName : '',
  );
  const [supplierLevel, setSupplierLevel] = useState<FormatLevel>(
    existing?.supplierLevel ?? 'management',
  );
  const [formatName, setFormatName] = useState(existing?.format ?? '');
  const [cadence, setCadence] = useState<FormatCadence>(existing?.cadence ?? 'quarterly');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [visibility, setVisibility] = useState<'internal' | 'shared'>(
    existing?.visibility ?? 'internal',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ein Format aus den Spielregeln übernimmt Ebene und Takt als Vorschlag.
  const chooseFormat = (title: string) => {
    setFormatName(title);
    const agreed = list.formats.find((entry) => entry.title[locale] === title);
    if (agreed) {
      setCadence(agreed.cadence);
      if (agreed.level) {
        setBuyerLevel(agreed.level);
        setSupplierLevel(agreed.level);
      }
    }
  };
  const agreedTitles = list.formats.map((entry) => entry.title[locale]);
  const formatChoice = agreedTitles.includes(formatName) ? formatName : formatName ? other : '';
  const [customFormat, setCustomFormat] = useState(formatChoice === other);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const request: SaveTouchpoint = {
      visibility,
      buyerUserId: buyerChoice && buyerChoice !== other ? buyerChoice : null,
      buyerName: buyerChoice === other ? buyerName.trim() || null : null,
      buyerLevel,
      supplierContactId: supplierChoice && supplierChoice !== other ? supplierChoice : null,
      supplierName: supplierChoice === other ? supplierName.trim() || null : null,
      supplierLevel,
      format: formatName.trim(),
      cadence,
      notes: notes.trim() || null,
    };
    const parsed = saveTouchpointSchema.safeParse(request);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        next[field] = text.errors[issue.message] ?? text.required;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    setFailed(false);
    try {
      await saveTouchpoint(accessToken, relationshipId, existing?.id ?? null, parsed.data);
      void queryClient.invalidateQueries({ queryKey: ['kontaktpunkte'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      flash.set(text.saved);
      goBack();
    } catch (caught) {
      const code =
        caught instanceof ApiError ? (caught.body as { code?: string } | null)?.code : undefined;
      if (code && text.errors[code]) setErrors({ supplierContactId: text.errors[code] });
      else setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-3xl flex-col gap-6"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <FormField label={text.buyerPerson} error={errors.buyerName}>
            {(field) => (
              <NativeSelect
                {...field}
                value={buyerChoice}
                onChange={(event) => setBuyerChoice(event.target.value)}
              >
                <option value="">{text.choose}</option>
                {list.people.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.name}
                  </option>
                ))}
                <option value={other}>{text.otherPerson}</option>
              </NativeSelect>
            )}
          </FormField>
          {buyerChoice === other && (
            <FormField label={`${text.name} (${text.buyerPerson})`}>
              {(field) => (
                <Input
                  {...field}
                  value={buyerName}
                  onChange={(event) => setBuyerName(event.target.value)}
                />
              )}
            </FormField>
          )}
          <FormField label={text.buyerLevel}>
            {(field) => <LevelSelect field={field} value={buyerLevel} onChange={setBuyerLevel} />}
          </FormField>
        </div>
        <div className="flex flex-col gap-4">
          <FormField
            label={text.supplierPerson}
            error={errors.supplierName ?? errors.supplierContactId}
          >
            {(field) => (
              <NativeSelect
                {...field}
                value={supplierChoice}
                onChange={(event) => setSupplierChoice(event.target.value)}
              >
                <option value="">{text.choose}</option>
                {list.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
                <option value={other}>{text.otherPerson}</option>
              </NativeSelect>
            )}
          </FormField>
          {supplierChoice === other && (
            <FormField label={`${text.name} (${text.supplierPerson})`}>
              {(field) => (
                <Input
                  {...field}
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                />
              )}
            </FormField>
          )}
          <FormField label={text.supplierLevel}>
            {(field) => (
              <LevelSelect field={field} value={supplierLevel} onChange={setSupplierLevel} />
            )}
          </FormField>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <FormField label={text.format} hint={text.formatHint} error={errors.format}>
            {(field) => (
              <NativeSelect
                {...field}
                value={customFormat ? other : formatChoice}
                onChange={(event) => {
                  if (event.target.value === other) {
                    setCustomFormat(true);
                    setFormatName('');
                  } else {
                    setCustomFormat(false);
                    chooseFormat(event.target.value);
                  }
                }}
              >
                <option value="">{text.choose}</option>
                {agreedTitles.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
                <option value={other}>{text.otherFormat}</option>
              </NativeSelect>
            )}
          </FormField>
          {customFormat && (
            <FormField label={text.formatName}>
              {(field) => (
                <Input
                  {...field}
                  value={formatName}
                  onChange={(event) => setFormatName(event.target.value)}
                />
              )}
            </FormField>
          )}
        </div>
        <FormField label={text.cadence}>
          {(field) => (
            <NativeSelect
              {...field}
              value={cadence}
              onChange={(event) => setCadence(event.target.value as FormatCadence)}
            >
              {formatCadences.map((entry) => (
                <option key={entry} value={entry}>
                  {text.cadences[entry]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      <FormField label={text.notes}>
        {(field) => (
          <Textarea {...field} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </FormField>
      <FormField label={text.visibility} hint={text.visibilityHint}>
        {(field) => (
          <NativeSelect
            {...field}
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'internal' | 'shared')}
          >
            <option value="internal">{t.team.visibilities.internal}</option>
            <option value="shared">{t.team.visibilities.shared}</option>
          </NativeSelect>
        )}
      </FormField>
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={goBack}>
          {text.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? text.saving : text.save}
        </Button>
      </FormActions>
    </form>
  );
}

function LevelSelect({
  field,
  value,
  onChange,
}: {
  field: {
    id: string;
    'aria-invalid': boolean | undefined;
    'aria-describedby': string | undefined;
  };
  value: FormatLevel;
  onChange: (level: FormatLevel) => void;
}) {
  const text = useT().touchpoints;
  return (
    <NativeSelect
      {...field}
      value={value}
      onChange={(event) => onChange(event.target.value as FormatLevel)}
    >
      {formatLevels.map((level) => (
        <option key={level} value={level}>
          {text.levels[level]}
        </option>
      ))}
    </NativeSelect>
  );
}
