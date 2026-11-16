import { minSearchLength, type SearchKind, searchKinds } from '@reziproq/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ListCard, ListCardHeader, ListRow, ListRowText } from '@/components/ui/list-card';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { searchQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** Wartet kurz, bis das Tippen pausiert, damit nicht jeder Buchstabe eine Anfrage auslöst. */
function useSettled(value: string, delay = 200) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * QS-05: Treffer zu einem Suchwort, gruppiert nach Art, höchstens fünf je Art. Ein Klick führt
 * zum Ort. Erscheint ab drei Zeichen; Arten ohne Treffer fehlen.
 */
export function SearchHits({ term, customer }: { term: string; customer?: string | undefined }) {
  const text = useT().prompt.search;
  const accessToken = useToken();
  const q = useSettled(term.trim());
  const ready = q.length >= minSearchLength;
  const query = useQuery({
    ...searchQueryOptions(accessToken, q, customer),
    enabled: accessToken !== '' && ready,
    placeholderData: keepPreviousData,
  });
  if (!ready) return null;
  const data = query.data;
  const kinds = searchKinds.filter((kind: SearchKind) => (data?.[kind].length ?? 0) > 0);

  return (
    <section aria-labelledby="suche-treffer" className="flex flex-col gap-3">
      <h2 id="suche-treffer" className="font-semibold text-lg">
        {text.title}
      </h2>
      {query.isError ? (
        <p role="alert" className="text-muted-foreground">
          {text.failed}
        </p>
      ) : !data ? (
        <p role="status" className="text-muted-foreground">
          {text.loading}
        </p>
      ) : kinds.length === 0 ? (
        <p role="status" className="text-muted-foreground">
          {text.none(data.query)}
        </p>
      ) : (
        kinds.map((kind) => (
          <ListCard key={kind} aria-label={text.kinds[kind]}>
            <ListCardHeader title={text.kinds[kind]} headingAs="h3" />
            <ul>
              {data[kind].map((hit) => (
                <li key={hit.id}>
                  <ListRow asChild>
                    {routerLink({
                      href: hit.href,
                      className: '',
                      children: <ListRowText title={hit.title} detail={hit.detail ?? undefined} />,
                    })}
                  </ListRow>
                </li>
              ))}
            </ul>
          </ListCard>
        ))
      )}
    </section>
  );
}
