import { type AnyHintRuleKey, type HintSeverity, hintSeverities } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRightIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { BackLink } from '@/components/ui/back-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NativeSelect } from '@/components/ui/native-select';
import { PageTitle } from '@/components/ui/page-title';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { hintQueryOptions, hintsQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useNarrow } from '@/lib/use-narrow';
import { cn } from '@/lib/utils';
import { HintPanel, isActive, SeverityBadge, useHintWhy } from './hint-panel';
import { HintsSummary } from './hints-summary';

function useAccessToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

type StatusFilter = 'active' | 'decided' | 'all';

/**
 * Hinweise (FS-01, KI-16, nach Hinweise.dc.html): nach score sortiert, Filter nach eigenen
 * Beziehungen, Schwere, Regel, Warengruppe und Stand. Ein Klick öffnet rechts die Leiste mit Beleg,
 * Begründung und nächstem Schritt; unter 760 px öffnet der Hinweis seine eigene Seite.
 */
export function HintsPage({ selectedId }: { selectedId?: string | undefined }) {
  const t = useT();
  const text = t.hints;
  const accessToken = useAccessToken();
  const navigate = useNavigate();
  const narrow = useNarrow();
  const query = useQuery({ ...hintsQueryOptions(accessToken), enabled: accessToken !== '' });
  const why = useHintWhy();
  const [mine, setMine] = useState(false);
  const [severity, setSeverity] = useState<HintSeverity | ''>('');
  const [rule, setRule] = useState<AnyHintRuleKey | ''>('');
  const [group, setGroup] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const severityId = useId();
  const ruleId = useId();
  const groupId = useId();
  const statusId = useId();

  const all = query.data?.hints ?? [];
  const openCount = all.filter(isActive).length;
  const rules = [...new Set(all.map((hint) => hint.ruleKey))];
  const groups = [
    ...new Set(all.map((hint) => hint.materialGroup).filter((name): name is string => !!name)),
  ].sort();
  // Die API liefert offene und laufende zuerst, dann nach score
  const shown = all.filter(
    (hint) =>
      (!mine || hint.isOwn) &&
      (!severity || hint.severity === severity) &&
      (!rule || hint.ruleKey === rule) &&
      (!group || hint.materialGroup === group) &&
      (status === 'all' || (status === 'active' ? isActive(hint) : !isActive(hint))),
  );
  const selected = all.find((hint) => hint.id === selectedId);
  const select = (id: string | undefined) => {
    if (id && narrow) {
      void navigate({ to: '/hinweise/$id', params: { id } });
      return;
    }
    void navigate({ to: '/hinweise', search: id ? { hinweis: id } : {}, replace: true });
  };
  const pill = 'h-11 rounded-full pl-4 text-sm';

  return (
    <>
      <PageTitle
        back={<BackLink label={t.nav.myDay} href="/heute" renderLink={routerLink} />}
        title={text.title}
        where={query.data ? text.sorted(openCount) : text.purpose}
      />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : all.length === 0 ? (
        <EmptyState title={text.emptyTitle} description={text.emptyText} />
      ) : (
        <>
          <HintsSummary hints={all} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,--spacing(108))]">
            <div className="flex min-w-0 flex-col gap-4">
              <fieldset className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
                <legend className="sr-only">{text.filters}</legend>
                <Button
                  variant="secondary"
                  aria-pressed={mine}
                  className="col-span-2 h-11 justify-self-start rounded-full aria-pressed:bg-mint-soft"
                  onClick={() => setMine((value) => !value)}
                >
                  {text.filterMine}
                </Button>
                <label htmlFor={severityId} className="sr-only">
                  {text.filterSeverity}
                </label>
                <div className="min-w-0 sm:w-40">
                  <NativeSelect
                    id={severityId}
                    className={pill}
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value as HintSeverity | '')}
                  >
                    <option value="">{`${text.filterSeverity}: ${text.filterAll}`}</option>
                    {hintSeverities.map((value) => (
                      <option key={value} value={value}>
                        {text.severityOf(text.severities[value])}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <label htmlFor={ruleId} className="sr-only">
                  {text.filterRule}
                </label>
                <div className="min-w-0 sm:w-56">
                  <NativeSelect
                    id={ruleId}
                    className={pill}
                    value={rule}
                    onChange={(event) => setRule(event.target.value as AnyHintRuleKey | '')}
                  >
                    <option value="">{`${text.filterRule}: ${text.filterAll}`}</option>
                    {rules.map((value) => (
                      <option key={value} value={value}>
                        {text.rules[value]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                {groups.length > 0 && (
                  <>
                    <label htmlFor={groupId} className="sr-only">
                      {text.filterGroup}
                    </label>
                    <div className="min-w-0 sm:w-52">
                      <NativeSelect
                        id={groupId}
                        className={pill}
                        value={group}
                        onChange={(event) => setGroup(event.target.value)}
                      >
                        <option value="">{`${text.filterGroup}: ${text.filterAll}`}</option>
                        {groups.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </>
                )}
                <label htmlFor={statusId} className="sr-only">
                  {text.filterStatus}
                </label>
                <div className="min-w-0 sm:w-52">
                  <NativeSelect
                    id={statusId}
                    className={pill}
                    value={status}
                    onChange={(event) => setStatus(event.target.value as StatusFilter)}
                  >
                    <option value="active">{text.filterActive}</option>
                    <option value="decided">{text.decided}</option>
                    <option value="all">{`${text.filterStatus}: ${text.filterAll}`}</option>
                  </NativeSelect>
                </div>
              </fieldset>
              {shown.length === 0 ? (
                <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
                  {text.filterEmpty}
                </p>
              ) : (
                <ul
                  aria-label={text.navTitle}
                  className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card"
                >
                  {shown.map((hint) => {
                    const supplier = hint.supplier ?? text.organization;
                    const isSelected = hint.id === selected?.id;
                    const title = why(hint);
                    return (
                      <li
                        key={hint.id}
                        className={cn(
                          'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap',
                          isSelected && 'bg-mint-soft',
                        )}
                      >
                        <button
                          type="button"
                          data-slot="hint-row"
                          aria-pressed={isSelected}
                          onClick={() => select(isSelected ? undefined : hint.id)}
                          className="flex min-h-11 min-w-0 grow basis-64 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <Monogram name={supplier} tone={hint.isFocus ? 'shared' : 'neutral'} />
                          <span className="flex min-w-0 flex-col">
                            <strong className="font-semibold text-sm">{title}</strong>
                            <span className="text-muted-foreground text-chip">
                              {`${supplier} · ${text.rules[hint.ruleKey]}`}
                            </span>
                          </span>
                        </button>
                        <span className="flex shrink-0 items-center gap-3 pl-12 sm:pl-0">
                          {isActive(hint) ? (
                            <SeverityBadge hint={hint} />
                          ) : (
                            <Badge variant={hint.status === 'accepted' ? 'success' : 'neutral'}>
                              {text.statuses[hint.status]}
                            </Badge>
                          )}
                          {isActive(hint) &&
                            routerLink({
                              href: hint.href,
                              className:
                                'inline-flex min-h-11 items-center gap-1 whitespace-nowrap font-semibold text-petrol-dark text-sm no-underline hover:underline',
                              'aria-label': `${text.nextSteps[hint.ruleKey]}: ${title}`,
                              children: (
                                <>
                                  {text.nextSteps[hint.ruleKey]}
                                  <ArrowRightIcon aria-hidden className="size-4" />
                                </>
                              ),
                            })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-muted-foreground text-sm">{text.footnote}</p>
            </div>
            {selected && !narrow && (
              <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
                <HintPanel key={selected.id} hint={selected} onClose={() => select(undefined)} />
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

/** Ein Hinweis als eigene Seite: von Links, aus Mein Tag und unter 760 px aus der Liste. */
export function HintPage({ hintId }: { hintId: string }) {
  const t = useT();
  const text = t.hints;
  const accessToken = useAccessToken();
  const query = useQuery({ ...hintQueryOptions(accessToken, hintId), enabled: accessToken !== '' });
  const hint = query.data;
  return (
    <>
      <PagePath trail={[{ label: text.navTitle, href: '/hinweise' }]} current={text.detailTitle} />
      <PageHeader title={text.detailTitle} {...(hint && { purpose: text.rules[hint.ruleKey] })} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !hint ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="max-w-3xl">
          <HintPanel hint={hint} standalone />
        </div>
      )}
    </>
  );
}
