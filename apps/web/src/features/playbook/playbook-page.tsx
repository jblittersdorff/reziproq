import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarClockIcon, ScaleIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Tile, TileIcon, TileText, TileTitle } from '@/components/ui/tile';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { segmentModelQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { playbookPath, usePlaybook } from './use-playbook';

export const settingsTrail = (t: ReturnType<typeof useT>) => [
  { label: t.profile.title, href: '/profil' },
  { label: t.settings.title, href: '/einstellungen' },
];

/** Name eines Typs aus dem aktiven Segmentmodell, sonst „Impact … · Qualität …“. */
export function useTypeName() {
  const t = useT();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const model = useQuery({ ...segmentModelQueryOptions(accessToken), enabled: accessToken !== '' });
  return (impact: number, quality: number) =>
    model.data?.active?.types.find(
      (type) => type.impactLevel === impact && type.qualityLevel === quality,
    )?.name ??
    t.playbook.typeLabel(
      t.playbook.impactLevels[impact - 1] as string,
      t.playbook.qualityLevels[quality - 1] as string,
    );
}

/** Einstellungen › Spielregeln (PLB-01): zwei Kacheln und die Vorschau je Typ. */
export function PlaybookPage() {
  const t = useT();
  const text = t.playbook;
  const query = usePlaybook();
  const typeName = useTypeName();

  return (
    <>
      <PagePath trail={settingsTrail(t)} current={text.title} />
      <PageHeader title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Tile asChild interactive size="lg" className="flex flex-col gap-3">
              <Link to={`${playbookPath}/rechte`}>
                <TileIcon>
                  <ScaleIcon aria-hidden />
                </TileIcon>
                <TileTitle>{text.rulesTitle}</TileTitle>
                <TileText>
                  {text.rulesCount(
                    query.data.rules.filter((rule) => rule.kind === 'right' && rule.counterpartId)
                      .length,
                  )}
                </TileText>
                {(() => {
                  const missing = query.data.rules.filter(
                    (rule) => rule.kind === 'right' && !rule.counterpartId,
                  ).length;
                  return missing > 0 ? (
                    <Badge variant="warning">{text.missingCount(missing)}</Badge>
                  ) : null;
                })()}
              </Link>
            </Tile>
            <Tile asChild interactive size="lg" className="flex flex-col gap-3">
              <Link to={`${playbookPath}/formate`}>
                <TileIcon>
                  <CalendarClockIcon aria-hidden />
                </TileIcon>
                <TileTitle>{text.formatsTitle}</TileTitle>
                <TileText>{text.formatsCount(query.data.formats.length)}</TileText>
              </Link>
            </Tile>
          </div>
          <section aria-labelledby="vorschau" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="vorschau" className="font-semibold text-lg">
                {text.previewTitle}
              </h2>
              <p className="text-muted-foreground">{text.previewHint}</p>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[3, 2, 1].flatMap((impact) =>
                [1, 2, 3].map((quality) => (
                  <li key={`${impact}-${quality}`}>
                    <Link
                      to="/einstellungen/spielregeln/typ/$typ"
                      params={{ typ: `${impact}-${quality}` }}
                      className="flex h-full min-h-11 flex-col justify-center rounded-lg bg-secondary px-4 py-3 transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {(() => {
                        const label = text.typeLabel(
                          text.impactLevels[impact - 1] as string,
                          text.qualityLevels[quality - 1] as string,
                        );
                        const name = typeName(impact, quality);
                        return (
                          <>
                            <span className="font-medium">{name}</span>
                            {name !== label && (
                              <span className="text-muted-foreground text-sm">{label}</span>
                            )}
                          </>
                        );
                      })()}
                    </Link>
                  </li>
                )),
              )}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
