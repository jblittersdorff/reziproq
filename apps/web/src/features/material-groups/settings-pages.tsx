import type { MaterialGroupImportPreview } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCan } from '@/features/auth/use-permissions';
import { useToken } from '@/features/ratings/use-rating';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath, useGoBack } from '@/features/shell/page-path';
import {
  ApiError,
  categoryLabelQueryOptions,
  materialGroupDetailQueryOptions,
  materialGroupOverviewQueryOptions,
  mergeMaterialGroup,
  parseMaterialGroupImport,
  parseMaterialGroupPreview,
  saveCategoryLabel,
  splitMaterialGroup,
  uploadMaterialGroups,
} from '@/lib/api';
import { flash } from '@/lib/flash';
import { useLocale, useT } from '@/lib/i18n';

const listPath = '/einstellungen/warengruppen';

function useTrail(current: string) {
  const t = useT();
  return (
    <PagePath
      trail={[
        { label: t.profile.title, href: '/profil' },
        { label: t.settings.title, href: '/einstellungen' },
        { label: t.masterData.materialGroups, href: listPath },
      ]}
      current={current}
    />
  );
}

function AdminOnly() {
  const t = useT();
  return (
    <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
      {t.masterData.readOnly}
    </p>
  );
}

/** Einstellungen › Warengruppen › Importieren: Vorschau, nur ohne Fehler übernehmen (WG-01). */
export function MaterialGroupImportPage() {
  const text = useT().materialGroupsPage;
  const accessToken = useToken();
  const manage = useCan('stammdaten.verwalten');
  const queryClient = useQueryClient();
  const goBack = useGoBack(listPath);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MaterialGroupImportPreview | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trail = useTrail(text.importTitle);

  const check = async () => {
    if (!file) return;
    setBusy(true);
    setFailure(null);
    try {
      setPreview(parseMaterialGroupPreview(await uploadMaterialGroups(accessToken, file, false)));
    } catch (error) {
      const code =
        error instanceof ApiError ? (error.body as { code?: string } | null)?.code : null;
      setFailure(code === 'missing_columns' ? text.missingColumns : text.failedSave);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setFailure(null);
    try {
      const result = parseMaterialGroupImport(await uploadMaterialGroups(accessToken, file, true));
      await queryClient.invalidateQueries({ queryKey: ['master-data'] });
      await queryClient.invalidateQueries({ queryKey: ['warengruppen'] });
      flash.set(text.imported(result.created));
      goBack();
    } catch {
      setFailure(text.failedSave);
    } finally {
      setBusy(false);
    }
  };
  const errorRows = preview?.rows.filter((row) => row.errors.length > 0).length ?? 0;

  return (
    <>
      {trail}
      <PageHeader title={text.importTitle} purpose={text.importPurpose} />
      {!manage ? (
        <AdminOnly />
      ) : (
        <div className="flex max-w-4xl flex-col gap-6">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void check();
            }}
          >
            <FormField label={text.file} className="min-w-0 flex-1 basis-64">
              {(field) => (
                <Input
                  {...field}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setPreview(null);
                  }}
                />
              )}
            </FormField>
            <Button type="submit" variant="secondary" disabled={!file} loading={busy && !preview}>
              {text.preview}
            </Button>
          </form>
          {failure && <StatusLine message={failure} tone="warning" />}
          {preview && (
            <>
              <p
                role="status"
                className={errorRows > 0 ? 'text-destructive' : 'text-muted-foreground'}
              >
                {errorRows > 0 ? text.previewErrors(errorRows) : text.previewOk}
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <caption className="sr-only">{text.importTitle}</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{text.columns.row}</TableHead>
                      <TableHead>{text.columns.code}</TableHead>
                      <TableHead>{text.columns.name}</TableHead>
                      <TableHead>{text.columns.parent}</TableHead>
                      <TableHead>{text.columns.lead}</TableHead>
                      <TableHead>{text.columns.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.row}>
                        <TableCell className="tabular-nums">{row.row}</TableCell>
                        <TableCell>{row.code}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.parentCode ?? '–'}</TableCell>
                        <TableCell className="break-all">{row.leadEmail ?? '–'}</TableCell>
                        <TableCell>
                          {row.errors.length === 0 ? (
                            <Badge variant="success">{text.ok}</Badge>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {row.errors.map((error) => (
                                <Badge key={error} variant="warning">
                                  {text.importErrors[error] ?? error}
                                </Badge>
                              ))}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <FormActions>
                <Button type="button" variant="secondary" onClick={goBack}>
                  {text.cancel}
                </Button>
                <Button
                  type="button"
                  disabled={!preview.valid}
                  loading={busy}
                  onClick={() => void apply()}
                >
                  {text.apply(preview.rows.length)}
                </Button>
              </FormActions>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Einstellungen › Warengruppen › Bezeichnung: eigenes Wort statt „Warengruppe“ (WG-01). */
export function CategoryLabelPage() {
  const text = useT().materialGroupsPage;
  const accessToken = useToken();
  const manage = useCan('stammdaten.verwalten');
  const queryClient = useQueryClient();
  const { setCategoryLabel } = useLocale();
  const options = categoryLabelQueryOptions(accessToken);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [draft, setDraft] = useState<{ singular: string; plural: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const trail = useTrail(text.labelTitle);
  const value = draft ?? query.data ?? { singular: '', plural: '' };

  return (
    <>
      {trail}
      <PageHeader title={text.labelTitle} purpose={text.labelPurpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : !manage ? (
        <AdminOnly />
      ) : (
        <form
          className="flex max-w-xl flex-col gap-5"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault();
            setMessage(null);
            setFailure(null);
            try {
              const saved = await saveCategoryLabel(accessToken, value);
              queryClient.setQueryData(options.queryKey, saved);
              await queryClient.invalidateQueries({ queryKey: ['me'] });
              setCategoryLabel(saved);
              setDraft(null);
              setMessage(text.labelSaved);
            } catch {
              setFailure(text.failedSave);
            }
          }}
        >
          {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
          {failure && <StatusLine message={failure} tone="warning" />}
          <FormField label={text.singular}>
            {(field) => (
              <Input
                {...field}
                value={value.singular}
                minLength={2}
                maxLength={40}
                required
                onChange={(event) => setDraft({ ...value, singular: event.target.value })}
              />
            )}
          </FormField>
          <FormField label={text.plural}>
            {(field) => (
              <Input
                {...field}
                value={value.plural}
                minLength={2}
                maxLength={40}
                required
                onChange={(event) => setDraft({ ...value, plural: event.target.value })}
              />
            )}
          </FormField>
          <Button type="submit" className="self-start">
            {text.save}
          </Button>
        </form>
      )}
    </>
  );
}

function useGroups() {
  const accessToken = useToken();
  return useQuery({
    ...materialGroupOverviewQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
}

/** Zusammenlegen mit Rückfrage zum Spend; die Antwort steht im Verlauf (WG-01). */
export function MergeMaterialGroupPage({ id }: { id: string }) {
  const text = useT().materialGroupsPage;
  const accessToken = useToken();
  const manage = useCan('stammdaten.verwalten');
  const queryClient = useQueryClient();
  const goBack = useGoBack(listPath);
  const groups = useGroups();
  const [target, setTarget] = useState('');
  const [spend, setSpend] = useState<'move' | 'unassign'>('move');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const source = groups.data?.groups.find((group) => group.id === id);
  const trail = useTrail(text.mergeTitle);
  const targets =
    groups.data?.groups.filter(
      (group) => group.id !== id && group.active && group.parentId !== id,
    ) ?? [];

  return (
    <>
      {trail}
      <PageHeader
        title={text.mergeTitle}
        {...(source && { purpose: text.mergePurpose(source.name) })}
      />
      {groups.isError ? (
        <ErrorState title={text.failed} />
      ) : !groups.data ? (
        <LoadingState label={text.loading} />
      ) : !manage ? (
        <AdminOnly />
      ) : (
        <form
          className="flex max-w-xl flex-col gap-5"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault();
            if (!target) return;
            setBusy(true);
            setFailure(null);
            try {
              await mergeMaterialGroup(accessToken, id, { targetId: target, spend });
              await queryClient.invalidateQueries({ queryKey: ['master-data'] });
              await queryClient.invalidateQueries({ queryKey: ['warengruppen'] });
              flash.set(text.merged);
              goBack();
            } catch (error) {
              const code =
                error instanceof ApiError
                  ? (error.body as { message?: string } | null)?.message
                  : null;
              setFailure(code ?? text.failedSave);
            } finally {
              setBusy(false);
            }
          }}
        >
          {failure && <StatusLine message={failure} tone="warning" />}
          <FormField label={text.mergeTarget}>
            {(field) => (
              <NativeSelect
                {...field}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="">{text.chooseTarget}</option>
                {targets.map((group) => (
                  <option key={group.id} value={group.id}>
                    {`${group.name} · ${group.code}`}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">{text.spendQuestion}</legend>
            {(
              [
                ['move', text.spendMove],
                ['unassign', text.spendUnassign],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex min-h-11 items-center gap-3">
                <input
                  type="radio"
                  name="spend"
                  value={value}
                  checked={spend === value}
                  onChange={() => setSpend(value)}
                  className="size-5 accent-petrol"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <p className="text-muted-foreground text-sm">{text.mergeLaterHint}</p>
          <FormActions>
            <Button type="button" variant="secondary" onClick={goBack}>
              {text.cancel}
            </Button>
            <Button type="submit" disabled={!target} loading={busy}>
              {text.merge}
            </Button>
          </FormActions>
        </form>
      )}
    </>
  );
}

/** Teilen: neue Warengruppen auf derselben Ebene; Produktgruppen und ggf. ihr Spend ziehen mit. */
export function SplitMaterialGroupPage({ id }: { id: string }) {
  const text = useT().materialGroupsPage;
  const accessToken = useToken();
  const manage = useCan('stammdaten.verwalten');
  const queryClient = useQueryClient();
  const goBack = useGoBack(listPath);
  const detail = useQuery({
    ...materialGroupDetailQueryOptions(accessToken, id),
    enabled: accessToken !== '',
  });
  const [groups, setGroups] = useState([{ name: '', code: '', productGroupIds: [] as string[] }]);
  const [spend, setSpend] = useState<'keep' | 'by_product_group'>('by_product_group');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trail = useTrail(text.splitTitle);
  const data = detail.data;
  const update = (index: number, change: Partial<(typeof groups)[number]>) =>
    setGroups((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...change } : entry)),
    );
  const takenElsewhere = (index: number, productGroupId: string) =>
    groups.some((entry, i) => i !== index && entry.productGroupIds.includes(productGroupId));
  const valid = groups.every((entry) => entry.name.trim() && entry.code.trim());

  return (
    <>
      {trail}
      <PageHeader
        title={text.splitTitle}
        {...(data && { purpose: text.splitPurpose(data.group.name) })}
      />
      {detail.isError ? (
        <ErrorState title={text.failed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : !manage ? (
        <AdminOnly />
      ) : (
        <form
          className="flex max-w-3xl flex-col gap-5"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault();
            if (!valid) return;
            setBusy(true);
            setFailure(null);
            try {
              await splitMaterialGroup(accessToken, id, { groups, spend });
              await queryClient.invalidateQueries({ queryKey: ['master-data'] });
              await queryClient.invalidateQueries({ queryKey: ['warengruppen'] });
              flash.set(text.splitDone);
              goBack();
            } catch (error) {
              const message =
                error instanceof ApiError
                  ? (error.body as { message?: string } | null)?.message
                  : null;
              setFailure(message ?? text.failedSave);
            } finally {
              setBusy(false);
            }
          }}
        >
          {failure && <StatusLine message={failure} tone="warning" />}
          {groups.map((entry, index) => (
            <fieldset
              // biome-ignore lint/suspicious/noArrayIndexKey: Entwurfszeilen haben keine eigene ID
              key={index}
              className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-card"
            >
              <legend className="font-semibold">{text.newGroup(index + 1)}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={text.name}>
                  {(field) => (
                    <Input
                      {...field}
                      value={entry.name}
                      maxLength={100}
                      onChange={(event) => update(index, { name: event.target.value })}
                    />
                  )}
                </FormField>
                <FormField label={text.code}>
                  {(field) => (
                    <Input
                      {...field}
                      value={entry.code}
                      maxLength={20}
                      onChange={(event) => update(index, { code: event.target.value })}
                    />
                  )}
                </FormField>
              </div>
              {data.productGroups.length > 0 && (
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-muted-foreground text-sm">
                    {text.takeProductGroups}
                  </legend>
                  {data.productGroups.map((group) => (
                    <label key={group.id} className="flex min-h-11 items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-5 accent-petrol"
                        checked={entry.productGroupIds.includes(group.id)}
                        disabled={takenElsewhere(index, group.id)}
                        onChange={(event) =>
                          update(index, {
                            productGroupIds: event.target.checked
                              ? [...entry.productGroupIds, group.id]
                              : entry.productGroupIds.filter((pg) => pg !== group.id),
                          })
                        }
                      />
                      {group.name}
                    </label>
                  ))}
                </fieldset>
              )}
            </fieldset>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() =>
              setGroups((current) => [...current, { name: '', code: '', productGroupIds: [] }])
            }
          >
            <PlusIcon aria-hidden />
            {text.addGroup}
          </Button>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">{text.splitSpendQuestion}</legend>
            {(
              [
                ['by_product_group', text.spendByProductGroup],
                ['keep', text.spendKeep(data.group.name)],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex min-h-11 items-center gap-3">
                <input
                  type="radio"
                  name="split-spend"
                  value={value}
                  checked={spend === value}
                  onChange={() => setSpend(value)}
                  className="size-5 accent-petrol"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <FormActions>
            <Button type="button" variant="secondary" onClick={goBack}>
              {text.cancel}
            </Button>
            <Button type="submit" disabled={!valid} loading={busy}>
              {text.split}
            </Button>
          </FormActions>
        </form>
      )}
    </>
  );
}
