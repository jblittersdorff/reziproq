import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { FactoryIcon, FileUpIcon, LockIcon, PlusIcon } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SearchInput } from '@/components/ui/search-input';
import { Switch } from '@/components/ui/switch';
import { useCan } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { ApiError } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { activeFilters, type SortKey, type SupplierSearch, visibleSuppliers } from './search';
import { SupplierCard } from './supplier-card';
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
  const sortId = useId();
  const endedId = useId();
  const unitId = useId();
  const groupId = useId();
  const typeId = useId();
  const focusId = useId();
  const mineId = useId();

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
  const addButton = canEdit && (
    <Button asChild>
      <Link to="/lieferanten/neu">
        <PlusIcon />
        {t.suppliers.add}
      </Link>
    </Button>
  );
  const importButton = (
    <Button asChild variant={canEdit ? 'secondary' : 'default'}>
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
  const typeName = new Map(filters?.targetTypes.map((type) => [type.key, type.name]) ?? []);
  const filteredGroup = filters?.materialGroups.find((group) => group.id === search.wg);
  const segmentOf = (supplier: (typeof visible)[number]) => {
    if (filteredGroup) {
      const own = supplier.categorySegments?.find((entry) => entry.materialGroupId === search.wg);
      const name = own && typeName.get(own.type);
      return name ? t.suppliers.segmentIn(filteredGroup.name, name) : null;
    }
    const name = supplier.segmentType && typeName.get(supplier.segmentType);
    return name ? t.suppliers.segment(name) : null;
  };

  return (
    <>
      {header}

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
          <div className="flex min-h-12 items-center gap-3">
            <Switch
              id={focusId}
              checked={search.fokus === 1}
              onCheckedChange={(checked) => update({ fokus: checked ? 1 : undefined })}
            />
            <label htmlFor={focusId} className="text-base">
              {t.suppliers.filters.focusOnly}
            </label>
          </div>
          <div className="flex min-h-12 items-center gap-3">
            <Switch
              id={mineId}
              checked={search.meine === 1}
              onCheckedChange={(checked) => update({ meine: checked ? 1 : undefined })}
            />
            <label htmlFor={mineId} className="text-base">
              {t.suppliers.filters.mineOnly}
            </label>
          </div>
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
        <div className="@container">
          <ul aria-label={title} className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
            {visible.map((supplier) => (
              <SupplierCard
                key={supplier.relationshipId}
                supplier={supplier}
                segment={segmentOf(supplier)}
                spendYear={data.spendYear}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
