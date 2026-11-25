import type {
  ColumnMap,
  DecideImportRows,
  ImportBatch,
  ImportBatchKind,
  ImportRowView,
} from '@reziproq/shared';
import { importFields, requiredImportFields } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useId, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { NextStep } from '@/components/ui/next-step';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import { type StepItem, Steps } from '@/components/ui/steps';
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import {
  ApiError,
  decideImportRows,
  downloadImportErrors,
  importBatchAction,
  importBatchesQueryOptions,
  importBatchQueryOptions,
  saveImportColumns,
  uploadImportBatch,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

function useAccessToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

const settingsTrail = (t: ReturnType<typeof useT>) => [
  { label: t.profile.title, href: '/profil' },
  { label: t.settings.title, href: '/einstellungen' },
];

/**
 * KI-15 Import (Einstellungen › Daten › Import): neuer Import mit Art und Datei, rechts die letzten
 * Importe mit Stand. Admins legen an; Commodity Manager sehen die Importe, die sie prüfen.
 */
export function ImportsPage() {
  const t = useT();
  const text = t.importBatches;
  const format = useFormat();
  const accessToken = useAccessToken();
  const navigate = useNavigate();
  const canManage = useCan('einstellungen.verwalten');
  const query = useQuery({
    ...importBatchesQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const [kind, setKind] = useState<ImportBatchKind>('spend');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const batch = await uploadImportBatch(accessToken, kind, file);
      await navigate({ to: '/einstellungen/daten/import/$batchId', params: { batchId: batch.id } });
    } catch (failure) {
      const code =
        failure instanceof ApiError ? (failure.body as { code?: string } | null)?.code : undefined;
      setError((code && text.errors[code]) || text.failed);
      setBusy(false);
    }
  };

  return (
    <>
      <PagePath trail={settingsTrail(t)} current={text.navTitle} />
      <PageHeader title={text.title} purpose={text.purpose} />
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 shrink grow-2 basis-120 flex-col gap-5">
          {canManage ? (
            <form
              onSubmit={(event) => void submit(event)}
              aria-labelledby="import-neu"
              className="flex flex-col gap-4 rounded-lg bg-card p-6 shadow-card"
            >
              <h2
                id="import-neu"
                className="font-display font-semibold text-section tracking-section"
              >
                {text.newTitle}
              </h2>
              {error && <StatusLine message={error} tone="warning" />}
              <SegmentedControl
                label={text.kindLabel}
                value={kind}
                options={[
                  { value: 'spend' as const, label: text.kinds.spend ?? 'Spend' },
                  {
                    value: 'supplier_master' as const,
                    label: text.kinds.supplier_master ?? 'Lieferantenstamm',
                  },
                ]}
                onChange={setKind}
                className="self-start"
              />
              <label htmlFor={fileId} className="font-semibold text-sm">
                {text.fileLabel}
              </label>
              <input
                id={fileId}
                type="file"
                accept=".csv,.xlsx"
                className="min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-line-soft file:px-4 file:font-semibold"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <Button type="submit" className="self-start" disabled={!file} loading={busy}>
                {text.upload}
              </Button>
            </form>
          ) : (
            <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
              {text.adminOnly}
            </p>
          )}
        </div>
        <aside
          aria-labelledby="import-letzte"
          className="flex min-w-0 shrink grow basis-75 flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
        >
          <h2
            id="import-letzte"
            className="font-display font-semibold text-section tracking-section"
          >
            {text.recent}
          </h2>
          {query.isError ? (
            <ErrorState title={text.failed} />
          ) : !query.data ? (
            <LoadingState label={text.loading} />
          ) : query.data.batches.length === 0 ? (
            <p className="text-muted-foreground text-sm">{text.recentEmpty}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {query.data.batches.map((batch) => (
                <li key={batch.id}>
                  {routerLink({
                    href: `/einstellungen/daten/import/${batch.id}`,
                    className:
                      'flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 text-sm no-underline hover:text-ink',
                    children: (
                      <>
                        <span className="flex min-w-0 flex-col">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-semibold">{batch.fileName}</span>
                            {/* IN-07: Lieferung über die Import-API statt Datei */}
                            {batch.source === 'api' && (
                              <Badge variant="neutral">{text.sourceApi}</Badge>
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            {`${text.kinds[batch.kind]} · ${text.rows(batch.rowsTotal)} · ${format.date(batch.createdAt)}`}
                          </span>
                        </span>
                        <Badge variant={batch.status === 'committed' ? 'success' : 'neutral'}>
                          {text.statuses[batch.status]}
                        </Badge>
                      </>
                    ),
                  })}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}

/**
 * Ein Import (nach Import-Pruefen.dc.html): Schrittfolge Datei, Spalten, Prüfen, Übernehmen.
 * Spalten mit Vorschau; Prüfen mit drei Zahlen, nächstem Schritt und Warteschlange nach Spend;
 * rechts was beim Übernehmen passiert, was Reziproq lernt und die Fehler.
 */
export function ImportBatchPage({ batchId }: { batchId: string }) {
  const t = useT();
  const text = t.importBatches;
  const accessToken = useAccessToken();
  const client = useQueryClient();
  const options = importBatchQueryOptions(accessToken, batchId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const batch = query.data;

  const act = async (key: string, work: () => Promise<ImportBatch>, note: string) => {
    setBusy(key);
    setMessage(null);
    try {
      client.setQueryData(options.queryKey, await work());
      await client.invalidateQueries({ queryKey: ['importe'], exact: true });
      setMessage({ text: note, tone: 'success' });
      return true;
    } catch (failure) {
      const code =
        failure instanceof ApiError ? (failure.body as { code?: string } | null)?.code : undefined;
      setMessage({ text: (code && text.errors[code]) || text.failed, tone: 'warning' });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const trail = [
    ...settingsTrail(t),
    { label: text.navTitle, href: '/einstellungen/daten/import' },
  ];
  if (query.isError) {
    return (
      <>
        <PagePath trail={trail} current={text.detailTitle} />
        <PageHeader title={text.detailTitle} />
        <ErrorState title={text.failed} />
      </>
    );
  }
  if (!batch) {
    return (
      <>
        <PagePath trail={trail} current={text.detailTitle} />
        <PageHeader title={text.detailTitle} />
        <LoadingState label={text.loading} />
      </>
    );
  }

  const stage =
    batch.status === 'uploaded' || batch.status === 'mapped'
      ? 1
      : batch.status === 'review' || batch.status === 'processing'
        ? 2
        : 3;
  const steps: StepItem[] = [
    { key: 'file', title: text.steps.file, state: 'done' },
    { key: 'columns', title: text.steps.columns, state: stage > 1 ? 'done' : 'current' },
    {
      key: 'review',
      title: text.steps.review,
      state: stage > 2 ? 'done' : stage === 2 ? 'current' : 'open',
    },
    {
      key: 'commit',
      title: text.steps.commit,
      state: batch.status === 'committed' ? 'done' : stage === 3 ? 'current' : 'open',
    },
  ];

  return (
    <>
      <PagePath trail={trail} current={text.detailTitle} />
      <PageHeader
        title={text.detailTitle}
        purpose={text.meta(
          text.kinds[batch.kind] ?? batch.kind,
          batch.fileName,
          text.rows(batch.rowsTotal),
          batch.createdByName,
        )}
        badge={<Badge>{text.statuses[batch.status]}</Badge>}
      />
      <Steps variant="inline" label={text.stepsLabel} doneLabel={text.done} items={steps} />
      {message && (
        <StatusLine message={message.text} tone={message.tone} onHidden={() => setMessage(null)} />
      )}
      {stage === 1 && (
        <ColumnStep
          batch={batch}
          busy={busy}
          onContinue={async (map) => {
            const saved = await act(
              'map',
              () => saveImportColumns(accessToken, batch.id, map),
              text.processed,
            );
            if (saved)
              await act(
                'process',
                () => importBatchAction(accessToken, batch.id, 'verarbeiten'),
                text.processed,
              );
          }}
        />
      )}
      {stage >= 2 && (
        <ReviewStep
          batch={batch}
          busy={busy}
          onDecide={(request) =>
            act(
              `decide-${request.rowIds.join(',')}-${request.action}`,
              () => decideImportRows(accessToken, batch.id, request),
              text.decided,
            )
          }
          onAction={(action, note) =>
            act(action, () => importBatchAction(accessToken, batch.id, action), note)
          }
          onDownload={() => void downloadImportErrors(accessToken, batch.id).catch(() => undefined)}
        />
      )}
    </>
  );
}

function ColumnStep({
  batch,
  busy,
  onContinue,
}: {
  batch: ImportBatch;
  busy: string | null;
  onContinue: (map: ColumnMap) => Promise<void>;
}) {
  const t = useT();
  const text = t.importBatches;
  const [map, setMap] = useState<ColumnMap>(batch.columnMap);
  const fields = importFields[batch.kind];
  const required = new Set<string>(requiredImportFields[batch.kind]);
  const base = useId();
  return (
    <section
      aria-labelledby="import-spalten"
      className="flex flex-col gap-4 rounded-lg bg-card p-6 shadow-card"
    >
      <h2 id="import-spalten" className="font-display font-semibold text-section tracking-section">
        {text.columnsTitle}
      </h2>
      <p className="text-muted-foreground text-sm">{text.columnsHint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field} className="flex flex-col gap-1">
            <label htmlFor={`${base}-${field}`} className="flex items-center gap-2 text-sm">
              <span className="font-semibold">{text.fields[field] ?? field}</span>
              {required.has(field) && <Badge variant="warning">{text.required}</Badge>}
            </label>
            <NativeSelect
              id={`${base}-${field}`}
              value={map[field] ?? ''}
              onChange={(event) => setMap({ ...map, [field]: event.target.value || null })}
            >
              <option value="">{text.noColumn}</option>
              {batch.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </NativeSelect>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-sm">{text.preview}</h3>
      {/* Breite Tabellen scrollen in ihrem Rahmen; die Seite selbst scrollt nie seitwärts. */}
      <div className="max-w-full overflow-x-auto rounded-md border border-line-soft">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {batch.headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 text-left font-semibold text-chip text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batch.sample.map((row) => (
              <tr key={JSON.stringify(row)} className="border-line-soft border-t">
                {batch.headers.map((header) => (
                  <td key={header} className="whitespace-nowrap px-3 py-2">
                    {row[header] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {batch.canManage && (
        <Button
          className="self-start"
          loading={busy === 'map' || busy === 'process'}
          onClick={() => void onContinue(map)}
        >
          {text.continue}
        </Button>
      )}
    </section>
  );
}

function ReviewStep({
  batch,
  busy,
  onDecide,
  onAction,
  onDownload,
}: {
  batch: ImportBatch;
  busy: string | null;
  onDecide: (request: DecideImportRows) => Promise<boolean>;
  onAction: (
    action: 'uebernehmen' | 'rueckgaengig' | 'verwerfen',
    note: string,
  ) => Promise<boolean>;
  onDownload: () => void;
}) {
  const t = useT();
  const text = t.importBatches;
  const { locale } = useLocale();
  const format = useFormat();
  const [selected, setSelected] = useState<string[]>([]);
  const euro = (cents: number) =>
    formatMoney({ amountCents: cents, currency: 'EUR' }, locale, { compact: true });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const total = batch.spend.okCents + batch.spend.reviewCents + batch.spend.errorCents;
  const queue = batch.rows.filter((row) => row.status === 'review');
  const review = batch.status === 'review';
  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 shrink grow-2 basis-130 flex-col gap-5">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-lg bg-card p-5 shadow-card">
            <dt className="text-muted-foreground text-sm">{text.safe}</dt>
            <dd className="font-display font-semibold text-figure tabular-nums">
              {text.rows(batch.rowsOk)}
            </dd>
            <dd className="text-muted-foreground text-sm">
              {text.safeDetail(
                percent.format(total > 0 ? batch.spend.okCents / total : 0),
                percent.format(batch.learnedShare),
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-card p-5 shadow-card">
            <dt className="text-muted-foreground text-sm">{text.review}</dt>
            <dd className="font-display font-semibold text-figure tabular-nums">
              {text.rows(batch.rowsReview)}
            </dd>
            <dd className="text-muted-foreground text-sm">
              {text.reviewDetail(euro(batch.spend.reviewCents))}
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-card p-5 shadow-card">
            <dt className="text-muted-foreground text-sm">{text.errorsTile}</dt>
            <dd className="font-display font-semibold text-figure tabular-nums">
              {text.rows(batch.rowsError)}
            </dd>
            <dd className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              {text.errorsDetail(euro(batch.spend.errorCents))}
              {batch.rowsError > 0 && (
                <Button size="sm" variant="ghost" onClick={onDownload}>
                  {text.downloadErrors}
                </Button>
              )}
            </dd>
          </div>
        </dl>
        {review && batch.canManage && (
          <NextStep
            eyebrow={text.nextEyebrow}
            title={queue.length > 0 ? text.nextReview(batch.rowsReview) : text.nextCommit}
            text={queue.length > 0 ? text.nextReviewText : text.nextCommitText}
            {...(queue.length === 0 && {
              action: (
                <Button
                  variant="mint"
                  size="hero"
                  loading={busy === 'uebernehmen'}
                  onClick={() => void onAction('uebernehmen', text.committed)}
                >
                  {text.commit}
                </Button>
              ),
            })}
          />
        )}
        {review && (
          <section
            aria-labelledby="import-pruefen"
            className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="import-pruefen"
                className="font-display font-semibold text-section tracking-section"
              >
                {text.queueTitle}
              </h2>
              {selected.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy?.startsWith('decide-') ?? false}
                  onClick={() =>
                    void onDecide({ rowIds: selected, action: 'accept' }).then(
                      (ok) => ok && setSelected([]),
                    )
                  }
                >
                  {text.acceptSelected(selected.length)}
                </Button>
              )}
            </div>
            {queue.length === 0 ? (
              <p className="text-muted-foreground text-sm">{text.queueEmpty}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line-soft">
                {queue.map((row) => (
                  <QueueRow
                    key={row.id}
                    row={row}
                    batch={batch}
                    busy={busy}
                    euro={euro}
                    checked={selected.includes(row.id)}
                    onCheck={(checked) =>
                      setSelected((current) =>
                        checked ? [...current, row.id] : current.filter((id) => id !== row.id),
                      )
                    }
                    onDecide={onDecide}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
        {batch.quality && (
          <section
            aria-labelledby="import-qualitaet"
            className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
          >
            <h2
              id="import-qualitaet"
              className="font-display font-semibold text-section tracking-section"
            >
              {text.qualityTitle}
            </h2>
            <dl className="flex flex-col divide-y divide-line-soft text-sm">
              <div className="flex justify-between gap-3 py-2">
                <dt>{text.qualityAssigned}</dt>
                <dd className="font-semibold tabular-nums">
                  {percent.format(batch.quality.assignedShare)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt>{text.qualityWithout}</dt>
                <dd className="font-semibold tabular-nums">
                  {batch.quality.suppliersWithoutGroup}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt>{text.qualityGroups}</dt>
                <dd className="font-semibold tabular-nums">{batch.quality.proposedGroups}</dd>
              </div>
            </dl>
            {batch.canRevert && batch.revertUntil && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  loading={busy === 'rueckgaengig'}
                  onClick={() => void onAction('rueckgaengig', text.reverted)}
                >
                  {text.revert}
                </Button>
                <span className="text-muted-foreground text-sm">
                  {text.revertUntil(format.date(batch.revertUntil))}
                </span>
              </div>
            )}
          </section>
        )}
      </div>
      <aside className="flex min-w-0 shrink grow basis-75 flex-col gap-5">
        {review && (
          <section
            aria-labelledby="import-plan"
            className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
          >
            <h2
              id="import-plan"
              className="font-display font-semibold text-section tracking-section"
            >
              {text.planTitle}
            </h2>
            <dl className="flex flex-col divide-y divide-line-soft text-sm">
              <div className="flex justify-between gap-3 py-2">
                <dt>{text.planNew}</dt>
                <dd className="font-semibold tabular-nums">{batch.plan.newSuppliers}</dd>
              </div>
              {batch.kind === 'spend' && (
                <div className="flex justify-between gap-3 py-2">
                  <dt>{text.planGroups}</dt>
                  <dd className="font-semibold tabular-nums">{batch.plan.materialGroups}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 py-2">
                <dt>{text.planOpen}</dt>
                <dd className="font-semibold tabular-nums">{batch.plan.openRows}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt>{text.planRevert}</dt>
                <dd className="font-semibold">{text.planRevertValue}</dd>
              </div>
            </dl>
            {batch.canManage && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  loading={busy === 'uebernehmen'}
                  onClick={() => void onAction('uebernehmen', text.committed)}
                >
                  {text.commit}
                </Button>
                <Button
                  variant="ghost"
                  loading={busy === 'verwerfen'}
                  onClick={() => void onAction('verwerfen', text.discarded)}
                >
                  {text.discard}
                </Button>
              </div>
            )}
          </section>
        )}
        <section
          aria-labelledby="import-lernen"
          className="flex flex-col gap-2 rounded-lg bg-mint-soft p-6"
        >
          <h2
            id="import-lernen"
            className="font-display font-semibold text-section tracking-section"
          >
            {text.learnTitle}
          </h2>
          <p className="text-sm">{text.learnText(batch.plan.aliases, batch.plan.rules)}</p>
        </section>
        {batch.errors.length > 0 && (
          <section
            aria-labelledby="import-fehler"
            className="flex flex-col gap-2 rounded-lg bg-card p-6 shadow-card"
          >
            <h2
              id="import-fehler"
              className="font-display font-semibold text-section tracking-section"
            >
              {text.errorsTitle}
            </h2>
            <dl className="flex flex-col divide-y divide-line-soft text-sm">
              {batch.errors.map((entry) => (
                <div key={entry.reason} className="flex justify-between gap-3 py-2">
                  <dt>{entry.reason}</dt>
                  <dd className="font-semibold tabular-nums">{entry.count}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground text-sm">{text.errorsNote}</p>
          </section>
        )}
      </aside>
    </div>
  );
}

function QueueRow({
  row,
  batch,
  busy,
  euro,
  checked,
  onCheck,
  onDecide,
}: {
  row: ImportRowView;
  batch: ImportBatch;
  busy: string | null;
  euro: (cents: number) => string;
  checked: boolean;
  onCheck: (checked: boolean) => void;
  onDecide: (request: DecideImportRows) => Promise<boolean>;
}) {
  const t = useT();
  const text = t.importBatches;
  const n = row.normalized;
  const supplierOpen = row.needs.includes('supplier');
  const categoryOpen = row.needs.includes('category');
  const [otherSupplier, setOtherSupplier] = useState('');
  const [otherGroup, setOtherGroup] = useState('');
  const supplierId = useId();
  const groupId = useId();
  const decide = (request: Omit<DecideImportRows, 'rowIds'>) =>
    void onDecide({ rowIds: [row.id], ...request });
  const pending = busy?.startsWith(`decide-${row.id}`) ?? false;
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-start gap-3">
        {batch.canManage && (
          <Checkbox
            aria-label={text.selectRow(row.rowNo)}
            checked={checked}
            onCheckedChange={(value) => onCheck(value === true)}
            className="mt-1"
          />
        )}
        <span className="flex min-w-0 grow basis-64 flex-col gap-1 text-sm">
          <span className="font-semibold text-chip text-muted-foreground">
            {supplierOpen ? text.supplier : text.category}
          </span>
          <span className="font-semibold text-base">
            {supplierOpen
              ? [n.name, n.city, n.country].filter(Boolean).join(' · ')
              : n.description || n.erpMaterialGroup || n.name}
          </span>
          <span className="text-muted-foreground">
            {[
              supplierOpen && n.externalNumber ? text.numberIsNew(n.externalNumber) : null,
              !supplierOpen && row.supplier ? row.supplier.name : null,
              n.erpMaterialGroup && !supplierOpen ? n.erpMaterialGroup : null,
              n.amountCents !== null ? euro(n.amountCents) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </div>
      {supplierOpen && (
        <div className="flex flex-col gap-2 rounded-md bg-paper p-4 text-sm">
          <p className="font-semibold text-petrol-dark">{text.suggestion}</p>
          <p className="font-semibold">
            {row.suggestion?.name ??
              (row.suggestion?.parentName
                ? text.createInGroup(row.suggestion.parentName)
                : text.suggestNew)}
          </p>
          {row.suggestion?.reason && (
            <p className="text-muted-foreground">{row.suggestion.reason}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {row.suggestion?.relationshipId && (
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() => decide({ action: 'accept' })}
              >
                {text.accept}
              </Button>
            )}
            {row.suggestion?.parentRelationshipId && row.suggestion.parentName && (
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() =>
                  decide({
                    action: 'new_in_group',
                    relationshipId: row.suggestion?.parentRelationshipId ?? undefined,
                  })
                }
              >
                {text.createInGroup(row.suggestion.parentName)}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              loading={pending}
              onClick={() => decide({ action: 'new' })}
            >
              {text.createNew}
            </Button>
            {row.candidates.length > 0 && (
              <span className="flex flex-wrap items-center gap-2">
                <label htmlFor={supplierId} className="sr-only">
                  {text.otherSupplier}
                </label>
                <span className="w-56">
                  <NativeSelect
                    id={supplierId}
                    value={otherSupplier}
                    className="h-11 rounded-full pl-4 text-sm"
                    onChange={(event) => setOtherSupplier(event.target.value)}
                  >
                    <option value="">{text.otherSupplier}</option>
                    {row.candidates.map((candidate) => (
                      <option key={candidate.relationshipId} value={candidate.relationshipId}>
                        {`${candidate.name} (${candidate.score.toFixed(2)})`}
                      </option>
                    ))}
                  </NativeSelect>
                </span>
                {otherSupplier && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => decide({ action: 'supplier', relationshipId: otherSupplier })}
                  >
                    {text.accept}
                  </Button>
                )}
              </span>
            )}
          </div>
        </div>
      )}
      {categoryOpen && (
        <div className="flex flex-col gap-2 rounded-md bg-paper p-4 text-sm">
          <p className="font-semibold text-petrol-dark">{`${text.suggestion} · ${text.category}`}</p>
          <p className="font-semibold">{row.categorySuggestion?.name ?? text.noneFits}</p>
          {row.categorySuggestion?.reason && (
            <p className="text-muted-foreground">{row.categorySuggestion.reason}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {row.categorySuggestion?.id && (
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() =>
                  decide({
                    action: 'category',
                    materialGroupId: row.categorySuggestion?.id ?? null,
                  })
                }
              >
                {text.acceptRule}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              loading={pending}
              onClick={() => decide({ action: 'category', materialGroupId: null })}
            >
              {text.noCategory}
            </Button>
            <label htmlFor={groupId} className="sr-only">
              {text.otherCategory}
            </label>
            <span className="w-56">
              <NativeSelect
                id={groupId}
                value={otherGroup}
                className="h-11 rounded-full pl-4 text-sm"
                onChange={(event) => setOtherGroup(event.target.value)}
              >
                <option value="">{text.otherCategory}</option>
                {batch.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </NativeSelect>
            </span>
            {otherGroup && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => decide({ action: 'category', materialGroupId: otherGroup })}
              >
                {text.acceptRule}
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
