import type { AnyHintRuleKey, Supplier } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { FactoryIcon, FileUpIcon, LockIcon, PlusIcon } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SearchInput } from '@/components/ui/search-input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Switch } from '@/components/ui/switch';
import { useCan } from '@/features/auth/use-permissions';
import { useToken } from '@/features/ratings/use-rating';
import { PageHeader } from '@/features/shell/page-header';
import { shortDate } from '@/features/start/next-action';
import { supplierMessages } from '@/features/workspace/supplier-messages';
import { ApiError, needsYouQueryOptions, timelineQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { activeFilters, type SortKey, type SupplierSearch, visibleSuppliers } from './search';
import { SupplierList, type SupplierRowStatus } from './supplier-list';
import { supplierSummary, useSuppliers } from './use-suppliers';

/**
 * Lieferantenliste der eigenen Organisation als Karten (PLT-02, PLT-03). Suche, Sortierung und
 * „Beendete zeigen“ stehen in der Adresse; so führen Zurück und Lesezeichen zur selben Ansicht.
 */
export function SuppliersPage() {
  const t = useT();
  const format = useFormat();
  const { me, allowed, data, isPending, isError, error } = useSuppliers();
  const search = useSearch({ from: '/_app/lieferanten/' });
  const navigate = useNavigate({ from: '/lieferanten/' });
  // Tippen ersetzt den Eintrag im Verlauf, statt für jeden Buchstaben einen neuen anzulegen.
  const update = (next: Partial<SupplierSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  const canEdit = useCan('lieferanten.bearbeiten');
  const text = useMessages(supplierMessages).list;
  const { locale } = useLocale();
  const accessToken = useToken();
  const signedIn = accessToken !== '' && allowed;
  // NAV-10 1.1 (F-UX-06): „Brauchen dich“ mit Grund; „Laufen gut“ nennt den nächsten Termin.
  const needsYou = useQuery({ ...needsYouQueryOptions(accessToken), enabled: signedIn });
  const timeline = useQuery({ ...timelineQueryOptions(accessToken, 60), enabled: signedIn });
  const sortId = useId();
  const endedId = useId();
  const unitId = useId();
  const groupId = useId();
  const typeId = useId();

  const title = t.suppliers.title;

  // Ohne Organisation steht der Hinweis schon über jeder Seite (App-Rahmen).
  if (me.data && !me.data.organization) return <PageHeader size="list" title={title} purpose="" />;

  const denied =
    (me.data && !allowed) || (error instanceof ApiError && error.code === 'keine_berechtigung');
  if (denied) {
    return (
      <>
        <PageHeader size="list" title={title} purpose={t.suppliers.purpose} />
        <EmptyState
          size="lg"
          icon={<LockIcon aria-hidden />}
          title={t.suppliers.noPermissionTitle}
          description={t.suppliers.noPermissionDescription}
        />
      </>
    );
  }

  // Scheitert schon /me, bleibt die Liste ausgeschaltet; dann den Fehler zeigen statt „lädt …“.
  if (isError || me.isError) {
    return (
      <>
        <PageHeader size="list" title={title} purpose={t.suppliers.purpose} />
        <ErrorState title={t.suppliers.failed} />
      </>
    );
  }

  if (isPending || !data) {
    return (
      <>
        <PageHeader size="list" title={title} purpose={t.suppliers.purpose} />
        <LoadingState label={t.suppliers.loading} />
      </>
    );
  }

  // Anlegen nur mit Recht aus der API (can() im Backend, PLT-03b).
  // NAV-10: Außerhalb der Karte „Als Nächstes“ gibt es nur Zweitknöpfe.
  const addButton = canEdit && (
    <Button asChild variant="secondary">
      <Link to="/lieferanten/neu">
        <PlusIcon />
        {t.suppliers.add}
      </Link>
    </Button>
  );
  const importButton = (
    <Button asChild variant="secondary">
      <Link to="/lieferanten/importieren">
        <FileUpIcon />
        {t.suppliers.importPage.title}
      </Link>
    </Button>
  );
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <PageHeader size="list" title={title} purpose={supplierSummary(data, t, format)} />
      <div className="flex flex-wrap gap-3">
        {importButton}
        {addButton}
      </div>
    </div>
  );

  if (data.suppliers.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          size="lg"
          icon={<FactoryIcon aria-hidden />}
          title={t.suppliers.emptyTitle}
          description={t.suppliers.emptyDescription}
        />
      </>
    );
  }

  const filters = data.filters;
  const visible = visibleSuppliers(data.suppliers, search, filters?.materialGroups);
  const filterCount = activeFilters(search);
  const query = search.suche ?? '';
  // WG-18: Gesamtsegment; mit gefilterter Warengruppe das Segment dort, mit ihrem Namen.
  const filteredGroup = filters?.materialGroups.find((group) => group.id === search.wg);
  const segmentTypeOf = (supplier: (typeof visible)[number]) =>
    filteredGroup
      ? (supplier.categorySegments?.find((entry) => entry.materialGroupId === search.wg)?.type ??
        null)
      : (supplier.segmentType ?? null);

  const reasons = new Map(
    (needsYou.data?.items ?? []).map((item) => [item.relationshipId, item] as const),
  );
  const meetings = new Map<string, string>();
  for (const item of timeline.data?.items ?? []) {
    if (item.relationshipId && item.kind === 'meeting' && !meetings.has(item.relationshipId)) {
      meetings.set(item.relationshipId, text.meeting(item.title, shortDate(locale, item.date)));
    }
  }
  const rowStatus = (supplier: Supplier): SupplierRowStatus => {
    if (supplier.status === 'ended') {
      return { group: 'ended', status: t.suppliers.statusEnded, tone: 'neutral', reason: null };
    }
    const need = reasons.get(supplier.relationshipId);
    if (need) {
      return {
        group: 'needs',
        status: text.status[need.reason],
        tone: need.reason === 'commitment' || need.reason === 'due' ? 'danger' : 'warning',
        // Ein Hinweis ohne Titel trägt den Schlüssel seiner Regel.
        reason:
          need.reason === 'hint'
            ? (t.hints.rules[need.title as AnyHintRuleKey] ?? need.title)
            : need.title,
      };
    }
    return {
      group: 'good',
      status: text.status.good,
      tone: 'success',
      reason: meetings.get(supplier.relationshipId) ?? null,
    };
  };
  // Umschalter Meine, Strategisch (Fokuslieferanten, SEG-02), Alle; steht in der Adresse.
  const view = search.meine ? 'mine' : search.fokus ? 'strategic' : 'all';

  return (
    <>
      {header}

      <SegmentedControl<'mine' | 'strategic' | 'all'>
        className="self-start"
        label={text.views}
        value={view}
        options={[
          { value: 'mine', label: text.mine },
          { value: 'strategic', label: text.strategic },
          { value: 'all', label: text.all },
        ]}
        onChange={(value) =>
          update({
            meine: value === 'mine' ? 1 : undefined,
            fokus: value === 'strategic' ? 1 : undefined,
          })
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchInput
          aria-label={t.suppliers.search}
          placeholder={t.suppliers.searchPlaceholder}
          value={query}
          onChange={(event) => update({ suche: event.target.value || undefined })}
        />
        <div className="flex flex-col gap-1 sm:w-56">
          <label htmlFor={sortId} className="text-muted-foreground text-sm">
            {t.suppliers.sort}
          </label>
          <NativeSelect
            id={sortId}
            value={search.sortierung ?? 'spend'}
            onChange={(event) => {
              const value = event.target.value as SortKey;
              update({ sortierung: value === 'spend' ? undefined : value });
            }}
            className="h-11 rounded-full pl-4"
          >
            <option value="spend">{t.suppliers.sortSpend}</option>
            <option value="name">{t.suppliers.sortName}</option>
          </NativeSelect>
        </div>
        <div className="flex min-h-12 items-center gap-3 sm:pb-0">
          <Switch
            id={endedId}
            checked={search.beendet === 1}
            onCheckedChange={(checked) => update({ beendet: checked ? 1 : undefined })}
          />
          <label htmlFor={endedId} className="text-base">
            {t.suppliers.showEnded}
          </label>
        </div>
      </div>

      {filters && (
        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0 sm:flex-row sm:flex-wrap sm:items-end">
          <legend className="sr-only">{t.suppliers.filters.label}</legend>
          {(
            [
              [unitId, t.suppliers.filters.businessUnit, 'bu', filters.businessUnits],
              [
                groupId,
                t.suppliers.filters.materialGroup,
                'wg',
                filters.materialGroups.map((g) => ({
                  id: g.id,
                  name: g.parentId ? `– ${g.name}` : g.name,
                })),
              ],
              [
                typeId,
                t.suppliers.filters.targetType,
                'typ',
                filters.targetTypes.map((type) => ({ id: type.key, name: type.name })),
              ],
            ] as const
          ).map(([id, label, key, options]) => (
            <div key={key} className="flex flex-col gap-1 sm:w-56">
              <label htmlFor={id} className="text-muted-foreground text-sm">
                {label}
              </label>
              <NativeSelect
                id={id}
                value={search[key] ?? ''}
                onChange={(event) => update({ [key]: event.target.value || undefined })}
                className="h-11 rounded-full pl-4"
              >
                <option value="">{t.suppliers.filters.all}</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ))}
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-muted-foreground text-sm">{t.suppliers.filters.hits(visible.length)}</p>
        {filterCount > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update({
                bu: undefined,
                wg: undefined,
                typ: undefined,
                fokus: undefined,
                meine: undefined,
              })
            }
          >
            {t.suppliers.filters.reset}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <p role="status" className="text-muted-foreground">
          {query.trim() ? t.suppliers.noResults(query.trim()) : t.suppliers.filters.noMatch}
        </p>
      ) : (
        <SupplierList
          rowStatus={rowStatus}
          groupLabels={{
            needs: text.needsYou,
            good: text.runningWell,
            ended: t.suppliers.statusEnded,
          }}
          suppliers={visible}
          spendYear={data.spendYear}
          segmentOf={segmentTypeOf}
          segmentHeading={
            filteredGroup ? t.suppliers.list.columnSegmentIn(filteredGroup.name) : undefined
          }
          selectedId={search.lieferant}
          onSelect={(id) =>
            void navigate({ search: (prev) => ({ ...prev, lieferant: id }), replace: false })
          }
        />
      )}
    </>
  );
}
