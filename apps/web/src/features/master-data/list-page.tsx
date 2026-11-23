import { PlusIcon, TagsIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import type { MasterDataKind } from '@/lib/api';
import { useFlash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { type Entry, kinds } from './kinds';
import { useEntries } from './use-entries';

/**
 * Einstellungen › Business Units bzw. › Warengruppen (PLT-06): Liste mit Name, Code, Anzahl
 * Lieferanten und Status. Jedes Mitglied sieht sie; nur Admins legen an und bearbeiten.
 */
export function MasterDataListPage({ kind }: { kind: MasterDataKind }) {
  const t = useT();
  const config = kinds[kind];
  const manage = useCan('stammdaten.verwalten');
  const { entries, isError } = useEntries(kind);
  const [message, hideMessage] = useFlash();
  const title = config.title(t);
  const newLink = (label: string) =>
    routerLink({
      href: `${config.path}/neu`,
      className: buttonVariants(),
      children: (
        <>
          <PlusIcon aria-hidden />
          {label}
        </>
      ),
    });

  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={title}
      />
      <PageHeader title={title} purpose={config.purpose(t)} />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {isError ? (
        <ErrorState title={t.masterData.failed} />
      ) : !entries ? (
        <LoadingState label={t.masterData.loading} />
      ) : entries.length === 0 ? (
        <EmptyState
          size="lg"
          icon={<TagsIcon aria-hidden />}
          title={config.emptyTitle(t)}
          description={manage ? t.masterData.emptyDescription : t.masterData.readOnly}
          action={
            manage ? (
              <div className="flex flex-wrap justify-center gap-2">
                {newLink(config.createFirst(t))}
                {kind === 'material-groups' &&
                  routerLink({
                    href: `${config.path}/import`,
                    className: buttonVariants({ variant: 'secondary' }),
                    children: t.materialGroupsPage.import,
                  })}
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          {manage ? (
            <div className="flex flex-wrap justify-end gap-2">
              {/* WG-01: Warengruppen importieren und eigene Bezeichnung */}
              {kind === 'material-groups' && (
                <>
                  {routerLink({
                    href: `${config.path}/kennzahlen`,
                    className: buttonVariants({ variant: 'secondary' }),
                    children: t.strategy.settings.kpiTitle,
                  })}
                  {routerLink({
                    href: `${config.path}/hebel`,
                    className: buttonVariants({ variant: 'secondary' }),
                    children: t.strategy.settings.leversTitle,
                  })}
                  {routerLink({
                    href: `${config.path}/leitfragen`,
                    className: buttonVariants({ variant: 'secondary' }),
                    children: t.strategy.settings.questionsTitle,
                  })}
                  {routerLink({
                    href: `${config.path}/bezeichnung`,
                    className: buttonVariants({ variant: 'secondary' }),
                    children: t.materialGroupsPage.label,
                  })}
                  {routerLink({
                    href: `${config.path}/import`,
                    className: buttonVariants({ variant: 'secondary' }),
                    children: t.materialGroupsPage.import,
                  })}
                </>
              )}
              {newLink(config.newTitle(t))}
            </div>
          ) : (
            <p className="text-muted-foreground">{t.masterData.readOnly}</p>
          )}
          <EntryTable kind={kind} entries={entries} manage={manage} />
        </>
      )}
    </>
  );
}

function EntryTable({
  kind,
  entries,
  manage,
}: {
  kind: MasterDataKind;
  entries: Entry[];
  manage: boolean;
}) {
  const t = useT();
  const config = kinds[kind];
  return (
    <Table>
      <caption className="sr-only">{config.title(t)}</caption>
      <TableHeader>
        <TableRow>
          <TableHead>{t.masterData.name}</TableHead>
          <TableHead>{t.masterData.code}</TableHead>
          <TableHead className="text-right">{t.masterData.suppliers}</TableHead>
          <TableHead>{t.masterData.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            {/* Untergruppen eingerückt unter ihrer Oberebene */}
            <TableCell className={entry.parentId ? 'pl-8 font-medium' : 'font-medium'}>
              {manage
                ? routerLink({
                    href: `${config.path}/${entry.id}/bearbeiten`,
                    'aria-label': t.masterData.edit(entry.name),
                    className:
                      'inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    children: entry.name,
                  })
                : entry.name}
            </TableCell>
            <TableCell className="text-muted-foreground">{entry.code}</TableCell>
            <TableCell className="text-right tabular-nums">{entry.supplierCount}</TableCell>
            <TableCell>
              <Badge variant={entry.active ? 'success' : 'neutral'}>
                {entry.active ? t.masterData.active : t.masterData.inactive}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
