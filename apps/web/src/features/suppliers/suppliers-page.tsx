import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { FactoryIcon, LockIcon, PlusIcon } from 'lucide-react';
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
import { type SortKey, type SupplierSearch, visibleSuppliers } from './search';
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

  const title = t.suppliers.title;

  // Ohne Organisation steht der Hinweis schon über jeder Seite (App-Rahmen).
  if (me.data && !me.data.organization) return <PageHeader title={title} purpose="" />;

  const denied =
    (me.data && !allowed) || (error instanceof ApiError && error.code === 'keine_berechtigung');
  if (denied) {
    return (
      <>
        <PageHeader title={title} purpose={t.suppliers.purpose} />
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
        <PageHeader title={title} purpose={t.suppliers.purpose} />
        <ErrorState title={t.suppliers.failed} />
      </>
    );
  }

  if (isPending || !data) {
    return (
      <>
        <PageHeader title={title} purpose={t.suppliers.purpose} />
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
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <PageHeader title={title} purpose={supplierSummary(data, t, format)} />
      {addButton}
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

  const visible = visibleSuppliers(data.suppliers, search);
  const query = search.suche ?? '';

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
            className="h-12 rounded-lg"
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

      {visible.length === 0 ? (
        <p role="status" className="text-muted-foreground">
          {t.suppliers.noResults(query.trim())}
        </p>
      ) : (
        <div className="@container">
          <ul
            aria-label={title}
            className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4"
          >
            {visible.map((supplier) => (
              <SupplierCard
                key={supplier.relationshipId}
                supplier={supplier}
                spendYear={data.spendYear}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
