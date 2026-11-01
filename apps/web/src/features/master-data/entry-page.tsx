import {
  businessUnitRequestSchema,
  type MasterDataError,
  masterDataErrors,
  materialGroupRequestSchema,
} from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { SearchXIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { useCan } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath, useGoBack } from '@/features/shell/page-path';
import { ApiError, createEntry, deleteEntry, type MasterDataKind, updateEntry } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import type { Messages } from '@/locales/de';
import { type Entry, kinds } from './kinds';
import { useEntries } from './use-entries';

/**
 * Neue Business Unit oder Warengruppe bzw. Bearbeiten als eigene Seite (PLT-06). Speichern und
 * Abbrechen führen zur Liste zurück; Deaktivieren und Löschen mit Bestätigung auf der Seite.
 */
export function MasterDataEntryPage({ kind, id }: { kind: MasterDataKind; id?: string }) {
  const t = useT();
  const config = kinds[kind];
  const { entries, isError, accessToken } = useEntries(kind);
  // Ändern dürfen nur Admins; entschieden wird per can() im Backend.
  const manage = useCan('stammdaten.verwalten');
  const trail = [
    { label: t.profile.title, href: '/profil' },
    { label: t.settings.title, href: '/einstellungen' },
    { label: config.title(t), href: config.path },
  ];

  if (isError) return <ErrorState title={t.masterData.failed} />;
  if (!entries) return <LoadingState label={t.masterData.loading} />;
  const entry = id ? entries.find((candidate) => candidate.id === id) : undefined;
  if (id && !entry) {
    return (
      <>
        <PagePath trail={trail} current={t.masterData.notFound} />
        <EmptyState
          size="lg"
          icon={<SearchXIcon aria-hidden />}
          title={t.masterData.notFound}
          description={t.notFound.description}
        />
      </>
    );
  }
  const title = entry ? entry.name : config.newTitle(t);
  return (
    <>
      <PagePath trail={trail} current={title} />
      <PageHeader
        title={title}
        purpose={entry ? t.masterData.editPurpose : t.masterData.newPurpose}
      />
      {manage ? (
        <EntryForm kind={kind} entry={entry} entries={entries} accessToken={accessToken} />
      ) : (
        <p role="status" className="rounded-lg bg-muted px-4 py-3 text-muted-foreground">
          {t.masterData.readOnly}
        </p>
      )}
    </>
  );
}

const errorText = (t: Messages, code: unknown) =>
  masterDataErrors.includes(code as MasterDataError)
    ? t.masterData.errors[code as MasterDataError]
    : t.masterData.errors.saveFailed;

function EntryForm({
  kind,
  entry,
  entries,
  accessToken,
}: {
  kind: MasterDataKind;
  entry: Entry | undefined;
  entries: Entry[];
  accessToken: string;
}) {
  const t = useT();
  const config = kinds[kind];
  const queryClient = useQueryClient();
  const goBack = useGoBack(config.path);
  const [form, setForm] = useState({
    name: entry?.name ?? '',
    code: entry?.code ?? '',
    parentId: entry?.parentId ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Oberebene: nur aktive Gruppen der obersten Ebene, nicht der Eintrag selbst.
  const parents = entries.filter(
    (candidate) =>
      candidate.parentId === null &&
      candidate.id !== entry?.id &&
      (candidate.active || candidate.id === entry?.parentId),
  );
  // Eine Gruppe mit Untergruppen bleibt oben, sonst entstünden drei Ebenen.
  const parentLocked = (entry?.childCount ?? 0) > 0;
  const used = (entry?.supplierCount ?? 0) > 0 || (entry?.childCount ?? 0) > 0;

  const done = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['master-data'] });
    void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    flash.set(message);
    goBack();
  };

  const send = async (request: { active?: boolean }, message: string) => {
    setFailure(null);
    const schema = config.hasParent ? materialGroupRequestSchema : businessUnitRequestSchema;
    const parsed = schema.safeParse({
      name: form.name,
      code: form.code,
      ...(config.hasParent ? { parentId: form.parentId || null } : {}),
      ...request,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), errorText(t, issue.message)]),
        ),
      );
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (entry) await updateEntry(accessToken, kind, entry.id, parsed.data);
      else await createEntry(accessToken, kind, parsed.data);
      done(message);
    } catch (caught) {
      const body =
        caught instanceof ApiError ? (caught.body as Record<string, unknown> | null) : null;
      const fieldErrors = body?.errors as Record<string, string[]> | undefined;
      if (fieldErrors) {
        setErrors(
          Object.fromEntries(
            Object.entries(fieldErrors).map(([field, codes]) => [field, errorText(t, codes[0])]),
          ),
        );
      } else if (body?.code === 'code_taken') setErrors({ code: errorText(t, body.code) });
      else if (body?.code === 'too_deep') setErrors({ parentId: errorText(t, body.code) });
      else setFailure(errorText(t, body?.code));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    setFailure(null);
    try {
      await deleteEntry(accessToken, kind, entry.id);
      done(t.masterData.deleted);
    } catch (caught) {
      setFailure(
        errorText(
          t,
          caught instanceof ApiError ? (caught.body as { code?: string } | null)?.code : null,
        ),
      );
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void send({}, t.masterData.saved);
      }}
      className="flex max-w-xl flex-col gap-6"
    >
      <FormField label={t.masterData.name} error={errors.name}>
        {(field) => (
          <Input
            {...field}
            name="name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        )}
      </FormField>
      <FormField label={t.masterData.code} hint={t.masterData.codeHint} error={errors.code}>
        {(field) => (
          <Input
            {...field}
            name="code"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
        )}
      </FormField>
      {config.hasParent && (
        <FormField
          label={t.masterData.parent}
          hint={parentLocked ? t.masterData.hasChildren : t.masterData.parentHint}
          error={errors.parentId}
        >
          {(field) => (
            <NativeSelect
              {...field}
              name="parentId"
              value={form.parentId}
              disabled={parentLocked}
              onChange={(event) => setForm({ ...form, parentId: event.target.value })}
            >
              <option value="">{t.masterData.noParent}</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      )}

      {failure && (
        <p role="alert" className="text-destructive">
          {failure}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={goBack}>
          {t.masterData.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.masterData.saving : t.masterData.save}
        </Button>
      </FormActions>

      {entry && (
        <div className="flex flex-col items-start gap-3 pt-6">
          {entry.active ? (
            <ConfirmButton
              question={t.masterData.deactivateQuestion}
              confirmLabel={t.masterData.deactivate}
              cancelLabel={t.masterData.cancel}
              onConfirm={() => void send({ active: false }, t.masterData.deactivated)}
            >
              {t.masterData.deactivate}
            </ConfirmButton>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void send({ active: true }, t.masterData.activated)}
            >
              {t.masterData.activate}
            </Button>
          )}
          {used ? (
            <p className="text-muted-foreground text-sm">
              {(entry.childCount ?? 0) > 0
                ? t.masterData.hasChildren
                : t.masterData.inUse(entry.supplierCount)}
            </p>
          ) : (
            <ConfirmButton
              question={t.masterData.deleteQuestion}
              confirmLabel={t.masterData.delete}
              cancelLabel={t.masterData.cancel}
              onConfirm={() => void remove()}
            >
              {t.masterData.delete}
            </ConfirmButton>
          )}
        </div>
      )}
    </form>
  );
}
