import { useNavigate, useSearch } from '@tanstack/react-router';
import { AreaSwitch } from '@/components/ui/entity-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useCan } from '@/features/auth/use-permissions';
import { MatrixContent } from '@/features/portfolio/matrix-page';
import { PortfolioPage } from '@/features/portfolio/portfolio-page';
import { RoundsPage } from '@/features/rounds/rounds-page';
import { routerLink } from '@/features/shell/navigation';
import { useMessages, useT } from '@/lib/i18n';
import { relationshipsMessages } from './relationships-messages';

/**
 * Linse Segmente der Seite Lieferanten. Übergang bis K2-b.5 (Vorlage K2-Segmente): die bisherigen
 * Ansichten Matrix mit offenen Entscheidungen und Bewertungsrunde, unter dem Umschalter der Seite.
 * Bewusste Abweichung bis dahin: Den Titel trägt die bisherige Ansicht („Matrix“).
 */
export function SegmentsLens() {
  const t = useT();
  const text = useMessages(relationshipsMessages);
  const search = useSearch({ from: '/_app/beziehungen/' });
  const navigate = useNavigate({ from: '/beziehungen/' });
  const rounds = useCan('runden.sehen');
  const view = search.ansicht === 'runde' && rounds ? 'runde' : 'matrix';
  // Titel und Tab-Titel setzen bis K2-b.5 die bisherigen Ansichten (Matrix, Bewertungsrunden)
  return (
    <div className="flex flex-col gap-5.5">
      <div className="max-w-80">
        <AreaSwitch
          label={text.lenses.label}
          active="segmente"
          renderLink={routerLink}
          areas={[
            { key: 'liste', label: text.lenses.list, href: '/beziehungen' },
            { key: 'segmente', label: text.lenses.segments, href: '/beziehungen?linse=segmente' },
          ]}
        />
      </div>
      {rounds && (
        <SegmentedControl<'matrix' | 'runde'>
          className="self-start"
          label={text.lenses.segments}
          value={view}
          options={[
            { value: 'matrix', label: t.portfolio.matrix.title },
            { value: 'runde', label: t.rounds.title },
          ]}
          onChange={(value) =>
            void navigate({
              search: (prev) => ({
                ...prev,
                linse: 'segmente',
                ansicht: value === 'runde' ? 'runde' : undefined,
              }),
            })
          }
        />
      )}
      {view === 'runde' ? (
        <RoundsPage />
      ) : (
        <>
          <MatrixContent
            embedded
            search={{ bu: search.bu, wg: search.wg, ansicht: search.segmente }}
            update={(next) =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  ...('bu' in next ? { bu: next.bu } : {}),
                  ...('wg' in next ? { wg: next.wg } : {}),
                  ...('ansicht' in next ? { segmente: next.ansicht } : {}),
                }),
                replace: true,
              })
            }
          />
          <PortfolioPage />
        </>
      )}
    </div>
  );
}
