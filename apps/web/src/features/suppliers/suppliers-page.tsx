import type { Supplier } from '@reziproq/shared';
import { IconAlertTriangle, IconBuildingFactory2, IconLock, IconSearch } from '@tabler/icons-react';
import { useId, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/features/shell/page-header';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { supplierSummary, useSuppliers } from './use-suppliers';

type SortKey = 'spend' | 'name';

const countryNames = new Intl.DisplayNames(['de'], { type: 'region' });

/** Filtert beim Tippen nach Name und Warengruppe, ohne Groß- und Kleinschreibung. */
export function filterSuppliers(suppliers: Supplier[], query: string): Supplier[] {
  const needle = query.trim().toLocaleLowerCase('de');
  if (!needle) return suppliers;
  return suppliers.filter((supplier) =>
    [supplier.name, supplier.category].some((value) =>
      value.toLocaleLowerCase('de').includes(needle),
    ),
  );
}

export function sortSuppliers(suppliers: Supplier[], key: SortKey): Supplier[] {
  return [...suppliers].sort((a, b) =>
    key === 'name'
      ? a.name.localeCompare(b.name, 'de')
      : b.annualSpend.amountCents - a.annualSpend.amountCents,
  );
}

/** Lieferantenliste der eigenen Organisation als Karten (PLT-02). */
export function SuppliersPage() {
  const t = useT();
  const { me, allowed, data, isPending, isError, error } = useSuppliers();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('spend');
  const sortId = useId();

  const title = t.areas.suppliers.title;

  // Ohne Organisation steht der Hinweis schon über jeder Seite (App-Rahmen).
  if (me.data && !me.data.organization) return <PageHeader title={title} purpose="" />;

  const denied =
    (me.data && !allowed) || (error instanceof ApiError && error.code === 'keine_berechtigung');
  if (denied) {
    return (
      <>
        <PageHeader title={title} purpose={t.areas.suppliers.sentence} />
        <EmptyState
          size="lg"
          icon={<IconLock aria-hidden />}
          title={t.suppliers.noPermissionTitle}
          description={t.suppliers.noPermissionDescription}
        />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title={title} purpose={t.areas.suppliers.sentence} />
        <EmptyState
          icon={<IconAlertTriangle aria-hidden />}
          title={t.suppliers.failed}
          description=""
        />
      </>
    );
  }

  if (isPending || !data) {
    return (
      <>
        <PageHeader title={title} purpose={t.areas.suppliers.sentence} />
        <p role="status" className="text-muted-foreground">
          {t.suppliers.loading}
        </p>
      </>
    );
  }

  if (data.count === 0) {
    return (
      <>
        <PageHeader title={title} purpose={supplierSummary(data, t)} />
        <EmptyState
          size="lg"
          icon={<IconBuildingFactory2 aria-hidden />}
          title={t.suppliers.emptyTitle}
          description={t.suppliers.emptyDescription}
        />
      </>
    );
  }

  const visible = sortSuppliers(filterSuppliers(data.suppliers, query), sort);

  return (
    <>
      <PageHeader title={title} purpose={supplierSummary(data, t)} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <IconSearch
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label={t.suppliers.search}
            placeholder={t.suppliers.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 rounded-lg pl-12 text-lg"
          />
        </div>
        <div className="flex flex-col gap-1 sm:w-56">
          <label htmlFor={sortId} className="text-muted-foreground text-sm">
            {t.suppliers.sort}
          </label>
          <NativeSelect
            id={sortId}
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-12 rounded-lg"
          >
            <option value="spend">{t.suppliers.sortSpend}</option>
            <option value="name">{t.suppliers.sortName}</option>
          </NativeSelect>
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
              <SupplierCard key={supplier.relationshipId} supplier={supplier} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function SupplierCard({ supplier }: { supplier: Supplier }) {
  const t = useT();
  const country = supplier.country ? (countryNames.of(supplier.country) ?? supplier.country) : '–';
  return (
    <li className="flex flex-col gap-4 rounded-xl bg-muted p-5">
      <h2 className="font-semibold text-lg">{supplier.name}</h2>
      <dl className="flex flex-1 flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{t.suppliers.country}</dt>
          <dd>{country}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{t.suppliers.category}</dt>
          <dd>{supplier.category}</dd>
        </div>
      </dl>
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-sm">
          {t.suppliers.annualSpend(supplier.spendYear)}
        </span>
        <span className="font-semibold text-base tabular-nums">
          {formatMoney(supplier.annualSpend, 'de', { wholeUnits: true })}
        </span>
      </p>
    </li>
  );
}
