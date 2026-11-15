import type { ImportPreview, ImportPreviewRow, ImportSummary, ImportType } from '@reziproq/shared';
import { Link } from '@tanstack/react-router';
import { DownloadIcon, FileSpreadsheetIcon, FileUpIcon, LockKeyholeIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tile } from '@/components/ui/tile';
import { useMe } from '@/features/auth/use-me';
import { usePermissions } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { ApiError, applyImport, downloadImportTemplate, previewImport } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';

type ImportableType = ImportType;
type ImportTypeLabel = {
  title: string;
  description: string;
  enabled: boolean;
};

function summaryText(summary: ImportSummary, t: ReturnType<typeof useT>) {
  return t.suppliers.importPage.summary(
    summary.new,
    summary.changed,
    summary.unchanged,
    summary.invalid,
  );
}

function rowDetails(row: ImportPreviewRow, t: ReturnType<typeof useT>) {
  const copy = t.suppliers.importPage;
  return [
    ...row.changes.map((change) => ({
      key: `change-${change.field}`,
      message: copy.issue(change.field, copy.change(change.before, change.after)),
    })),
    ...row.issues.map((issue) => ({
      key: `issue-${issue.field}-${issue.code}-${issue.value ?? ''}`,
      message: copy.issue(issue.field, copy.issues[issue.code]),
    })),
  ];
}

function errorMessage(error: unknown, fallback: string, t: ReturnType<typeof useT>): string {
  const copy = t.suppliers.importPage;
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 413) return copy.fileTooLarge;
  const code =
    error.body !== null && typeof error.body === 'object' && 'code' in error.body
      ? error.body.code
      : undefined;
  switch (code) {
    case 'invalid_file_type':
      return copy.invalidFileType;
    case 'invalid_encoding':
      return copy.invalidEncoding;
    case 'file_too_large':
      return copy.fileTooLarge;
    case 'too_many_rows':
      return copy.tooManyRows;
    case 'missing_column':
      return copy.missingColumns;
    case 'empty_file':
      return copy.emptyFile;
    default:
      return fallback;
  }
}

function statusBadge(row: ImportPreviewRow, t: ReturnType<typeof useT>) {
  const copy = t.suppliers.importPage;
  const variants = {
    new: 'neutral',
    changed: 'selected',
    unchanged: 'success',
    invalid: 'danger',
  } as const;
  const labels = {
    new: copy.statusNew,
    changed: copy.statusChanged,
    unchanged: copy.statusUnchanged,
    invalid: copy.statusInvalid,
  } as const;
  return <Badge variant={variants[row.status]}>{labels[row.status]}</Badge>;
}

function downloadErrorFile(preview: ImportPreview, t: ReturnType<typeof useT>) {
  const rows = preview.rows.filter((row) => row.status === 'invalid');
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]?.values ?? {});
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = [
    [...headers, t.suppliers.importPage.errorColumn].map(quote).join(';'),
    ...rows.map((row) =>
      [
        ...headers.map((header) => row.values[header] ?? ''),
        row.issues
          .map((issue) =>
            t.suppliers.importPage.issue(issue.field, t.suppliers.importPage.issues[issue.code]),
          )
          .join(' · '),
      ]
        .map(quote)
        .join(';'),
    ),
  ];
  const blob = new Blob([`${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = t.suppliers.importPage.errorFilename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function SupplierImportPage() {
  const t = useT();
  const { locale } = useLocale();
  const auth = useAuth();
  const me = useMe();
  const permissions = usePermissions();
  const canEdit = permissions.data?.actions.includes('lieferanten.bearbeiten') ?? false;
  const canManageMasterData = permissions.data?.actions.includes('stammdaten.verwalten') ?? false;
  const [type, setType] = useState<ImportableType>('suppliers');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [finished, setFinished] = useState<ImportSummary | null>(null);
  const [pending, setPending] = useState<'preview' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = t.suppliers.importPage;

  const pageHead = <PageHeader size="list" title={copy.title} purpose={copy.purpose} />;
  const pagePath = (
    <PagePath trail={[{ label: t.suppliers.title, href: '/lieferanten' }]} current={copy.title} />
  );

  if (me.isError || permissions.isError) {
    return (
      <>
        {pagePath}
        {pageHead}
        <ErrorState title={copy.failed} />
      </>
    );
  }
  if (me.isPending || permissions.isPending) {
    return (
      <>
        {pagePath}
        {pageHead}
        <LoadingState label={copy.loading} />
      </>
    );
  }
  if (!me.data.permissions.viewSuppliers) {
    return (
      <>
        {pagePath}
        {pageHead}
        <EmptyState
          size="lg"
          icon={<LockKeyholeIcon aria-hidden />}
          title={copy.noPermissionTitle}
          description={copy.noPermissionDescription}
        />
      </>
    );
  }

  const token = auth.user?.access_token ?? '';
  const labels: Record<ImportType, ImportTypeLabel> = {
    suppliers: {
      title: copy.suppliers,
      description: copy.suppliersDescription,
      enabled: true,
    },
    spend: { title: copy.spend, description: copy.spendDescription, enabled: true },
    'business-units': {
      title: copy.businessUnits,
      description: copy.businessUnitsDescription,
      enabled: canManageMasterData,
    },
    contacts: {
      title: copy.contacts,
      description: copy.contactsDescription,
      enabled: true,
    },
  };

  const chooseFile = (next: File | undefined) => {
    setFile(next ?? null);
    setPreview(null);
    setFinished(null);
    setError(null);
  };

  const runPreview = async () => {
    if (!file) {
      setError(copy.chooseFileFirst);
      return;
    }
    setPending('preview');
    setError(null);
    setFinished(null);
    try {
      setPreview(await previewImport(token, type, file));
    } catch (reason) {
      setPreview(null);
      setError(errorMessage(reason, copy.previewFailed, t));
    } finally {
      setPending(null);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setPending('import');
    setError(null);
    try {
      const result = await applyImport(token, type, file);
      setFinished(result.summary);
      setPreview(null);
    } catch (reason) {
      setError(errorMessage(reason, copy.importFailed, t));
    } finally {
      setPending(null);
    }
  };

  const getTemplate = async (templateType: ImportType, format: 'csv' | 'xlsx') => {
    setError(null);
    try {
      await downloadImportTemplate(token, templateType, format, locale);
    } catch {
      setError(copy.downloadFailed);
    }
  };

  if (finished) {
    return (
      <>
        {pagePath}
        {pageHead}
        <section className="flex flex-col gap-5">
          <div className="rounded-lg bg-success-soft px-5 py-5 text-success-soft-foreground">
            <h2 className="font-semibold text-lg">{copy.completed}</h2>
            <p className="mt-1">{summaryText(finished, t)}</p>
          </div>
          <Button asChild className="w-fit">
            <Link to="/lieferanten">{copy.goToSuppliers}</Link>
          </Button>
        </section>
      </>
    );
  }

  return (
    <>
      {pagePath}
      {pageHead}

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-lg">{copy.chooseType}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(labels) as ImportType[]).map((kind) => {
            const option = labels[kind];
            const selected = kind === type;
            return (
              <Tile
                key={kind}
                className={selected ? 'bg-primary-soft' : undefined}
                aria-current={selected ? 'true' : undefined}
              >
                <div className="flex items-start gap-3">
                  <FileSpreadsheetIcon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {option.enabled ? (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto justify-start whitespace-normal p-0 text-left text-base font-semibold"
                        aria-pressed={selected}
                        onClick={() => {
                          setType(kind);
                          chooseFile(undefined);
                        }}
                      >
                        {option.title}
                      </Button>
                    ) : (
                      <h3 className="font-semibold text-base">{option.title}</h3>
                    )}
                    <p className="text-muted-foreground text-sm">{option.description}</p>
                    {!option.enabled && (
                      <p className="text-muted-foreground text-sm">
                        {kind === 'business-units' ? copy.businessUnitsAdminOnly : copy.unavailable}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void getTemplate(kind, 'csv')}
                  >
                    <DownloadIcon aria-hidden />
                    {copy.downloadCsv}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void getTemplate(kind, 'xlsx')}
                  >
                    <DownloadIcon aria-hidden />
                    {copy.downloadExcel}
                  </Button>
                </div>
              </Tile>
            );
          })}
        </div>
      </section>

      {!canEdit ? (
        <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">{copy.readerOnly}</p>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="font-semibold text-lg">{copy.selectFile}</h2>
            <label
              htmlFor="supplier-import-file"
              className="flex flex-col gap-3 rounded-lg bg-card shadow-card p-5 sm:p-7"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                chooseFile(event.dataTransfer.files[0]);
              }}
            >
              <span className="font-medium">{copy.dropFile}</span>
              <Input
                id="supplier-import-file"
                type="file"
                accept=".csv,.xlsx"
                aria-label={copy.selectFile}
                className="peer sr-only !h-px !w-px !p-0 !border-0"
                onChange={(event) => chooseFile(event.currentTarget.files?.[0])}
              />
              <span className="inline-flex min-h-10 w-fit items-center rounded-full bg-card shadow-inset-line px-3 text-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                {copy.selectFile}
              </span>
              <p className="text-muted-foreground text-sm">{copy.fileLimit}</p>
              {file && <p role="status">{file.name}</p>}
            </label>
            <Button
              type="button"
              className="w-fit"
              loading={pending === 'preview'}
              disabled={!file || pending !== null}
              onClick={() => void runPreview()}
            >
              <FileUpIcon aria-hidden />
              {pending === 'preview' ? copy.previewing : copy.preview}
            </Button>
          </section>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {preview && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-lg">{copy.preview}</h2>
                  <p className="text-muted-foreground">{summaryText(preview.summary, t)}</p>
                </div>
                {preview.summary.invalid > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadErrorFile(preview, t)}
                  >
                    {copy.errorFile}
                  </Button>
                )}
              </div>
              <ImportPreviewTable preview={preview} t={t} />
              <Button
                type="button"
                className="w-fit"
                loading={pending === 'import'}
                disabled={pending !== null}
                onClick={() => void runImport()}
              >
                {pending === 'import' ? copy.importing : copy.import}
              </Button>
            </section>
          )}
        </>
      )}
      {error && !canEdit && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

function ImportPreviewTable({
  preview,
  t,
}: {
  preview: ImportPreview;
  t: ReturnType<typeof useT>;
}) {
  const copy = t.suppliers.importPage;
  const headers = Object.keys(preview.rows[0]?.values ?? {});
  return (
    <Table aria-label={copy.preview}>
      <TableHeader>
        <TableRow>
          <TableHead>{copy.row}</TableHead>
          <TableHead>{copy.status}</TableHead>
          {headers.map((header) => (
            <TableHead key={header}>{header}</TableHead>
          ))}
          <TableHead>{copy.details}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {preview.rows.map((row) => (
          <TableRow key={row.row}>
            <TableCell>{row.row}</TableCell>
            <TableCell>{statusBadge(row, t)}</TableCell>
            {headers.map((header) => {
              const invalid = row.issues.some((issue) => issue.field === header);
              return (
                <TableCell
                  key={header}
                  className={invalid ? 'bg-destructive-soft text-destructive-soft-foreground' : ''}
                >
                  {row.values[header]}
                </TableCell>
              );
            })}
            <TableCell className="min-w-56 whitespace-normal">
              <ul className="flex flex-col gap-1">
                {rowDetails(row, t).map(({ key, message }) => (
                  <li
                    key={key}
                    className={
                      row.status === 'invalid' ? 'text-destructive' : 'text-muted-foreground'
                    }
                  >
                    {message}
                  </li>
                ))}
              </ul>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
