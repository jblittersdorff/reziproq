import { displayNameOf, type RuleSetResponse } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Row, RowGroup } from '@/components/ui/row-group';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { akteHeadQueryOptions, ruleSetQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { AkteSheet } from './akte-sheet';
import { akteSheetMessages } from './akte-sheet-messages';
import { oldPage } from './akte-view';

type Item = NonNullable<RuleSetResponse['current']>['items'][number];

/**
 * Blatt Spielregeln (AK-01, K2-c.5; nach Regeln, es gibt keine Vorlage): Rechte und Pflichten des
 * Lieferanten und die Formate der aktuellen Fassung (PLB-01, PLB-03), dazu, was geteilt ist (SEG-10).
 * Bearbeiten, Teilen und der Vorschlag aus dem Segment führen bis K2-f auf die bisherigen Seiten.
 */
export function RulesSheet({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const all = useMessages(akteSheetMessages);
  const text = all.rules;
  const format = useFormat();
  const { locale } = useLocale();
  const accessToken = useToken();
  const enabled = accessToken !== '';
  const head = useQuery({ ...akteHeadQueryOptions(accessToken, relationshipId), enabled });
  const query = useQuery({ ...ruleSetQueryOptions(accessToken, relationshipId), enabled });
  const name = head.data ? displayNameOf(head.data.name).name : '';
  const data = query.data;
  const current = data?.current ?? null;
  const shared = data?.shared ?? null;
  const unshared = current !== null && (shared === null || shared.version !== current.version);
  const base = oldPage(relationshipId, '/beziehung/spielregeln');
  const subtitle = current
    ? text.subtitle(
        shared?.typeName ?? current.target.typeName,
        current.version,
        !unshared && shared
          ? text.sharedOn(format.date(shared.sharedAt))
          : shared
            ? text.unshared
            : text.draft,
      )
    : undefined;
  const items = (kind: Item['kind']) => (current?.items ?? []).filter((item) => item.kind === kind);
  const cadence = (item: Item) =>
    [
      item.cadence ? t.touchpoints.cadences[item.cadence] : null,
      item.level ? t.touchpoints.levels[item.level] : null,
    ]
      .filter(Boolean)
      .join(' · ');
  const row = (item: Item, detail: string) => (
    <Row
      key={item.id}
      title={item.title[locale]}
      detail={[detail, item.description[locale]].filter(Boolean).join(' · ')}
      value={
        item.group ? <Badge variant="neutral">{t.playbook.groups[item.group]}</Badge> : undefined
      }
      wrap
    />
  );

  return (
    <AkteSheet relationshipId={relationshipId} title={text.title} subtitle={subtitle}>
      {query.isError ? (
        <ErrorState title={all.failed} />
      ) : !data ? (
        <LoadingState label={all.loading} />
      ) : !current ? (
        <RowGroup>
          <Row
            href={`${base}/vorschlag`}
            title={text.none}
            detail={text.noneText}
            wrap
            renderLink={routerLink}
          />
        </RowGroup>
      ) : (
        <div className="flex flex-col gap-5.5">
          {shared && <p className="text-base text-pretty">{shared.typeDescription}</p>}
          {data.targetChanged && data.target && (
            <RowGroup>
              <Row
                href={`${base}/vorschlag`}
                title={text.targetChanged(data.target.typeName)}
                detail={text.targetChangedText}
                wrap
                renderLink={routerLink}
              />
            </RowGroup>
          )}
          {items('right').length > 0 && (
            <RowGroup id="rechte" label={text.rights(name)}>
              {items('right').map((item) => row(item, ''))}
            </RowGroup>
          )}
          {items('obligation').length > 0 && (
            <RowGroup id="pflichten" label={text.duties(name)}>
              {items('obligation').map((item) => row(item, cadence(item) || text.ongoing))}
            </RowGroup>
          )}
          {items('format').length > 0 && (
            <RowGroup id="formate" label={text.formats}>
              {items('format').map((item) => row(item, cadence(item)))}
            </RowGroup>
          )}
          {data.canManage && (
            <div className="flex flex-wrap gap-2">
              {unshared &&
                current.status !== 'draft' &&
                routerLink({
                  href: `${base}/teilen`,
                  className: buttonVariants({ variant: 'secondary' }),
                  children: text.share,
                })}
              {routerLink({
                href: `${base}/bearbeiten`,
                className: buttonVariants({ variant: 'secondary' }),
                children: text.edit,
              })}
            </div>
          )}
        </div>
      )}
    </AkteSheet>
  );
}
